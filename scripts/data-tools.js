const fs = require("node:fs"),
  path = require("node:path");
const store = require("../lib/store");
const crypto = require("node:crypto");
const { privateDirectory } = require("../lib/private-files");
store.init();
const [action, input] = process.argv.slice(2);
function load(file) {
  let text = fs.readFileSync(file, "utf8").trim();
  if (file.endsWith(".js")) {
    const match = text.match(/^module\.exports\s*=\s*(\{[\s\S]*\})\s*;?$/);
    if (!match)
      throw Error(
        "Solo se admite un export de JSON literal, sin ejecutar JavaScript.",
      );
    text = match[1];
  }
  return JSON.parse(text);
}
function normalize(name, data) {
  if (name === "cedulas") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        !value?.numeroCedula ||
        !/^[\w-]{2,40}$/.test(String(value.numeroCedula))
      )
        throw Error("Cédula incompleta o inválida.");
      result[String(value.numeroCedula)] = {
        ...value,
        discordId: String(
          value.discordId || (/^\d{17,20}$/.test(key) ? key : ""),
        ),
        apellidos: value.apellidos || "",
      };
    }
    return result;
  }
  if (name === "licencias")
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        Array.isArray(v) ? v : v.licencias || [],
      ]),
    );
  if (name === "infostaff")
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        { ...v, discordId: k, estado: v.estado || "Activo" },
      ]),
    );
  if (name === "multas" || name === "arrestos") {
    if (!Array.isArray(data))
      throw Error(
        "El historial debe ser un array; la variante antigua que escribía un único arresto necesita reparación manual.",
      );
    return data.map((r) => ({
      ...r,
      id: String(
        r.id ||
          "import_" +
            crypto
              .createHash("sha256")
              .update(JSON.stringify(r))
              .digest("hex")
              .slice(0, 24),
      ),
      userId: String(r.userId || r.usuarioId || ""),
      documento: String(r.documento || r.ciudadanoCedula || ""),
      articulos: r.articulos || r.articulo || "",
      createdAt:
        r.createdAt ||
        (r.timestamp && new Date(r.timestamp).toISOString()) ||
        "",
      fecha: r.fecha || "Fecha desconocida",
      ...(name === "multas"
        ? { monto: Number(r.monto) }
        : { tiempo: Number(r.tiempo) }),
      pdfFileName: r.pdfFileName || r.archivoNombre || null,
      pdfUrl:
        r.pdfFileName || r.archivoNombre
          ? "/pdfs/" + path.basename(r.pdfFileName || r.archivoNombre)
          : r.pdfUrl,
    }));
  }
  return data;
}
try {
  if (action === "export") {
    const dest = path.resolve(input || "exportacion-datos");
    privateDirectory(dest);
    for (const name of Object.keys(store.defaults))
      store.atomic(
        path.join(dest, name + ".json"),
        store.read(name),
      );
    console.log("Datos exportados a " + dest + " (sin tokens).");
  } else if (action === "import") {
    if (!input) throw Error("Indica una carpeta con JSON revisados.");
    const dir = path.resolve(input);
    let count = 0;
    store.transaction(() => {
      for (const file of fs.readdirSync(dir)) {
        const name = file.replace(/\.(json|js)$/, "");
        if (!(name in store.defaults) || !/\.(json|js)$/.test(file)) continue;
        const incoming = normalize(name, load(path.join(dir, file))),
          current = store.read(name);
        if (Array.isArray(current)) {
          if (!Array.isArray(incoming))
            throw Error("Tipo incorrecto para " + name);
          const ids = new Set(current.map((v) => v.id));
          for (const r of incoming)
            if (!ids.has(r.id)) {
              current.push(r);
              ids.add(r.id);
            }
          store.write(name, current);
        } else {
          if (
            !incoming ||
            typeof incoming !== "object" ||
            Array.isArray(incoming)
          )
            throw Error("Tipo incorrecto para " + name);
          for (const [k, v] of Object.entries(incoming)) {
            if (k in current)
              throw Error(
                "Colisión en " +
                  name +
                  ": " +
                  k +
                  ". No se sobrescribieron los datos.",
              );
            current[k] = v;
          }
          store.write(name, current);
        }
        count++;
      }
    });
    console.log(
      count +
        " colecciones importadas. Copia PDFs/evidencias por separado y revisa sus rutas.",
    );
  } else throw Error("Uso: npm run data -- export [carpeta] | import carpeta");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
