const fs = require("node:fs");
const path = require("node:path");
const PDFDocument = require("pdfkit");
const { root } = require("./config");
async function generate(type, r) {
  const filename = r.id + ".pdf";
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  if (r.imagenFileName) {
    try {
      doc.openImage(path.join(root, "public/uploads", r.imagenFileName));
    } catch {
      const e = Error(
        "La imagen está dañada o no se puede interpretar. Usa otro PNG o JPEG.",
      );
      e.status = 400;
      throw e;
    }
  }
  const out = fs.createWriteStream(path.join(root, "public/pdfs", filename), {
    mode: 0o600,
  });
  const done = new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
  });
  doc.pipe(out);
  doc
    .fillColor("#123548")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("MAES ROLEPLAY");
  doc
    .fontSize(16)
    .text(type === "multa" ? "REGISTRO DE MULTA" : "REGISTRO DE ARRESTO");
  doc.moveDown().font("Helvetica").fontSize(10).fillColor("#222");
  for (const [label, value] of Object.entries({
    Registro: r.id,
    Fecha: r.fecha,
    Ciudadano: r.ciudadano,
    Cédula: r.documento,
    "Discord ciudadano": r.userId || "No vinculado",
    Oficial: r.oficialNombre,
    "Identidad oficial": r.oficialId,
    Artículos: r.articulos,
    Placa: r.placa || "N/A",
    ...(type === "multa"
      ? { Monto: `$${r.monto.toFixed(2)}` }
      : { Sentencia: `${r.tiempo} años` }),
  }))
    doc.text(`${label}: ${value}`).moveDown(0.4);
  if (r.imagenFileName) {
    doc
      .addPage()
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("EVIDENCIA PROBATORIA")
      .moveDown();
    doc.image(path.join(root, "public/uploads", r.imagenFileName), {
      fit: [490, 620],
      align: "center",
    });
  }
  doc
    .fontSize(8)
    .font("Helvetica-Oblique")
    .text(
      "Documento de ficción para Maes Roleplay / ER:LC. Sin validez legal.",
      50,
      760,
      { align: "center" },
    );
  doc.end();
  await done;
  return filename;
}
module.exports = { generate };
