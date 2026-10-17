const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const readline = require("node:readline");
const { root } = require("../lib/config");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
let hidden = false;
const original = rl._writeToOutput.bind(rl);
rl._writeToOutput = (s) => {
  if (!hidden) original(s);
};
let waitingReject = null;
rl.on("close", () => {
  if (waitingReject) {
    const reject = waitingReject;
    waitingReject = null;
    reject(
      Error(
        "Configuración cancelada: no se guardó .env. Ejecuta configurar-linux.sh solo y responde las preguntas.",
      ),
    );
  }
});
function readAnswer(prompt, secret = false) {
  return new Promise((resolve, reject) => {
    if (rl.closed)
      return reject(Error("La entrada de la terminal está cerrada."));
    waitingReject = reject;
    hidden = false;
    rl.question(prompt, (answer) => {
      hidden = false;
      waitingReject = null;
      if (secret) process.stdout.write("\n");
      resolve(answer);
    });
    hidden = secret && !!process.stdin.isTTY;
  });
}
const settings = {};
async function ask(
  key,
  label,
  {
    secret = false,
    required = false,
    validate = () => true,
    defaultValue = "",
  } = {},
) {
  while (true) {
    const previous = process.env[key] || defaultValue;
    const prompt =
      label +
      (previous
        ? secret
          ? " [Enter conserva el valor]"
          : ` [${previous}]`
        : "") +
      ": ";
    const answer = await readAnswer(prompt, secret);
    const value =
      key === "_PASSWORD"
        ? answer || previous
        : answer.trim() === "-"
          ? ""
          : answer.trim() || previous;
    if (required && !value) {
      console.log("Este campo es obligatorio.");
      continue;
    }
    if (value && !validate(value)) {
      console.log("Formato inválido. Intenta otra vez.");
      continue;
    }
    settings[key] = value;
    return value;
  }
}
(async () => {
  console.log(
    "\nMaesRP · Configuración para localhost\nEnter conserva el valor; escribe - para borrar un valor opcional.\n",
  );
  const port = await ask("PORT", "Puerto web", {
    defaultValue: "3000",
    validate: (v) => /^\d+$/.test(v) && Number(v) > 1023 && Number(v) < 65536,
  });
  const existingUrl = process.env.BASE_URL;
  settings.BASE_URL = existingUrl && !['localhost','127.0.0.1','[::1]'].includes(new URL(existingUrl).hostname)
    ? existingUrl : `http://localhost:${port}`;
  settings.LISTEN_HOST = process.env.LISTEN_HOST || '127.0.0.1';
  settings.JWT_SECRET =
    process.env.JWT_SECRET || randomBytes(48).toString("hex");
  console.log(
    "\nEl acceso web es solo con Discord. Sin OAuth configurado podrás visitar la demo, pero no iniciar sesión. El token del bot es independiente del secreto OAuth2.",
  );
  const id = (v) => /^\d{17,20}$/.test(v);
  await ask("DISCORD_TOKEN", "Token del bot de Discord", { secret: true });
  await ask("DISCORD_CLIENT_ID", "ID de la aplicación de Discord", {
    validate: id,
  });
  await ask("DISCORD_CLIENT_SECRET", "Secreto OAuth2 de Discord", {
    secret: true,
  });
  await ask("DISCORD_GUILD_ID", "ID del servidor de Discord", { validate: id });
  await ask("POLICE_ROLE_IDS", "IDs de roles policiales separados por comas", {
    validate: (v) => v.split(",").every((x) => id(x.trim())),
  });
  await ask("MULTA_CHANNEL_ID", "ID del canal de multas", { validate: id });
  await ask("ARRESTO_CHANNEL_ID", "ID del canal de arrestos", { validate: id });
  await ask(
    "LICENSE_ROLE_MAP",
    'Licencias por rol (JSON, ejemplo {"ID":"B1"})',
    {
      defaultValue: "{}",
      validate: (v) => {
        try {
          const m = JSON.parse(v);
          return (
            m &&
            typeof m === "object" &&
            !Array.isArray(m) &&
            Object.entries(m).every(
              ([k, val]) =>
                id(k) &&
                typeof val === "string" &&
                /^[A-Za-z0-9 -]{1,20}$/.test(val),
            )
          );
        } catch {
          return false;
        }
      },
    },
  );
  await ask(
    "ADMIN_GUILD_ID",
    "ID del servidor Discord de administración (opcional)",
    { validate: id },
  );
  await ask(
    "ADMIN_ROLE_IDS",
    "IDs de roles administrativos separados por comas (opcional)",
    { validate: (v) => v.split(",").every((x) => id(x.trim())) },
  );
  console.log(
    "\nRoblox es opcional. Su proveedor puede requerir HTTPS para el callback; lee README.md.",
  );
  await ask("ROBLOX_CLIENT_ID", "ID de aplicación Roblox");
  await ask("ROBLOX_CLIENT_SECRET", "Secreto OAuth2 Roblox", { secret: true });
  await ask("PRC_SERVER_KEY", "Clave del servidor ER:LC (API Pass, opcional)", {
    secret: true,
  });
  await ask("PRC_AUTH_KEY", "Clave global PRC (opcional)", { secret: true });
  await ask(
    "UNBELIEVABOT_TOKEN",
    "Token de economía UnbelievaBoat (opcional)",
    { secret: true },
  );
  const botConfig = path.join(root, "bot/config.json");
  if (!fs.existsSync(botConfig))
    fs.copyFileSync(path.join(root, "bot/config.example.json"), botConfig);
  await ask("_BOT_ADVANCED", "Configurar ahora roles y canales adicionales del bot (s/n)", { defaultValue: "n", validate: v => /^[sn]$/i.test(v) });
  if (settings._BOT_ADVANCED.toLowerCase() === "s") {
    const config = { ...require("../bot/settings").defaults, ...JSON.parse(fs.readFileSync(botConfig, "utf8")) };
    config.channels = { ...require("../bot/settings").defaults.channels, ...config.channels };
    for (const [key, label] of [
      ["staffRoleIds", "Roles de staff"], ["moderatorRoleIds", "Roles de moderación"], ["adminRoleIds", "Roles de administración"], ["policeRoleIds", "Roles policiales"], ["acceptedRoleIds", "Roles que se otorgan al aceptar whitelist"], ["voiceExemptRoleIds", "Roles exentos del canal de voz"],
    ]) {
      await ask("_" + key, label + " (IDs separados por comas)", { defaultValue: (config[key] || []).join(","), validate: value => value.split(",").every(x => id(x.trim())) });
      config[key] = settings["_" + key].split(",").map(x => x.trim()).filter(Boolean);
      delete settings["_" + key];
    }
    for (const key of ["verifiedRoleId", "pendingRoleId"]) {
      await ask("_" + key, key + " (ID del rol)", { defaultValue: config[key], validate: id });
      config[key] = settings["_" + key]; delete settings["_" + key];
    }
    for (const key of Object.keys(config.channels)) {
      await ask("_channel_" + key, "Canal " + key + " (ID)", { defaultValue: config.channels[key], validate: id });
      config.channels[key] = settings["_channel_" + key]; delete settings["_channel_" + key];
    }
    for (const type of Object.keys(config.licenseRoles)) {
      await ask("_license_" + type, "Rol de licencia " + type + " (ID)", { defaultValue: config.licenseRoles[type], validate: id });
      config.licenseRoles[type] = settings["_license_" + type]; delete settings["_license_" + type];
    }
    for (const family of ["sanctionRoles", "banRoles"]) {
      for (const level of Object.keys(config[family])) {
        await ask("_role", "Rol " + family + " nivel " + level + " (ID)", { defaultValue: config[family][level], validate: id });
        config[family][level] = settings._role; delete settings._role;
      }
    }
    await ask("_hierarchy", 'Jerarquía ordenada en JSON (ejemplo [{"name":"Dueño","roleId":"ID"}])', { defaultValue: JSON.stringify(config.hierarchy), validate: value => { try { return Array.isArray(JSON.parse(value)); } catch { return false; } } });
    config.hierarchy = JSON.parse(settings._hierarchy); delete settings._hierarchy;
    await ask("_activity", "Publicar panel de turnos al iniciar (s/n)", { defaultValue: config.activityPanelEnabled ? "s" : "n", validate: value => /^[sn]$/i.test(value) });
    config.activityPanelEnabled = settings._activity.toLowerCase() === "s"; delete settings._activity;
    require("../bot/settings").validate(config);
    fs.writeFileSync(botConfig, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  }
  delete settings._BOT_ADVANCED;
  const file = path.join(root, ".env");
  for(const key of ['LEGAL_OWNER_NAME','LEGAL_CONTACT_EMAIL','LEGAL_JURISDICTION'])settings[key]=process.env[key]||'';
  const configureLegal=await ask('_legal','Configurar información legal pública ahora (s/n)',{defaultValue:'n',validate:v=>/^[sn]$/i.test(v)});
  if(configureLegal.toLowerCase()==='s'){
    await ask('LEGAL_OWNER_NAME','Nombre legal público del responsable o empresa',{required:true,validate:v=>v.length>=2&&v.length<=160});
    await ask('LEGAL_CONTACT_EMAIL','Correo público de privacidad',{required:true,validate:v=>v.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)});
    await ask('LEGAL_JURISDICTION','País o jurisdicción de operación',{required:true,validate:v=>v.length>=2&&v.length<=100});
  }
  delete settings._legal;
  fs.writeFileSync(
    file,
    Object.entries(settings)
      .map(
        ([k, v]) =>
          `${k}=${k === "LICENSE_ROLE_MAP" ? "'" + v + "'" : JSON.stringify(v)}`,
      )
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  fs.chmodSync(file, 0o600);
  require("../lib/store").init();
  console.log(
    `\nConfiguración guardada. Inicia con npm start y abre ${settings.BASE_URL}\nCallback Discord: ${settings.BASE_URL}/auth/discord/callback\nCallback Admin: ${settings.BASE_URL}/admin/auth/discord/callback`,
  );
})()
  .catch((e) => {
    console.error("No se pudo configurar:", e.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
