const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, FileBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const footer = '© Todos los derechos reservados, Maes Roleplay | ER:LC';
function container(title, body, { error = false, success = false, accent } = {}) {
  const templates = require("../lib/store").read("textTemplates");
  const originalTitle = title;
  title = templates["titulo:" + originalTitle] || title;
  const template = templates["cuerpo:" + originalTitle];
  if (template) body = template.replaceAll("{contenido}", String(body || "")).replaceAll("{titulo}", String(originalTitle || ""));
  const box = new ContainerBuilder();
  if (accent !== undefined) box.setAccentColor(accent);
  let remaining = 4000 - Math.min(500, ("-# " + (templates.pie || footer)).length);
  const emoji = error ? '<a:1340350330516406355:1448152756757201050> ' : success ? '<a:check:1448095572665045094> ' : '';
  if (title) {
    const heading = `### ${emoji}${title}`.slice(0, 256);
    remaining -= heading.length;
    box.addTextDisplayComponents(new TextDisplayBuilder().setContent(heading));
  }
  for (const part of String(body || '').split(/\[separador\]/i)) {
    if (box.components.length) box.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    if (part.trim()) {
      const content = part.trim();
      if (content.length > remaining) throw Error("El texto supera el límite de Discord. Reduce la plantilla o consulta los registros por páginas.");
      box.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
      remaining -= content.length;
    }
  }
  box.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  box.addTextDisplayComponents(new TextDisplayBuilder().setContent(('-# ' + (templates.pie || footer)).slice(0, 500)));
  return box;
}
function v2Payload(input) {
  const payload = typeof input === 'string' ? { content: input } : { ...input };
  if (payload.classic) { delete payload.classic; return payload; }
  const flags = Number(payload.flags?.bitfield ?? payload.flags ?? 0);
  if (flags & MessageFlags.IsComponentsV2) return payload;
  const embeds = payload.embeds || [];
  const boxes = [];
  if (payload.content) boxes.push(container('', payload.content));
  for (const value of embeds) {
    const e = value.toJSON ? value.toJSON() : value;
    const fields = (e.fields || []).map(f => `**${f.name}**\n${f.value}`).join('\n[separador]\n');
    const box = container(e.title || '', [e.description, fields].filter(Boolean).join('\n[separador]\n'), { error: e.error, success: e.success, accent: e.accent });
    for (const image of [e.image, e.thumbnail].filter(Boolean)) box.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image.url)));
    boxes.push(box);
  }
  if (!boxes.length && !payload.components?.length) boxes.push(container('Maes RP', 'Sin contenido.'));
  const box = boxes.at(-1);
  for (const component of payload.components || []) {
    const data = component.toJSON ? component.toJSON() : component;
    if (data.type === 1 && box) box.addActionRowComponents(component);
    else boxes.push(component);
  }
  for (const file of payload.files || []) {
    const name = file.name || (typeof file.attachment === 'string' ? require('node:path').basename(file.attachment) : null);
    if (name && box) {
      if (/\.(png|jpe?g|gif|webp)$/i.test(name)) box.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://' + name)));
      else box.addFileComponents(new FileBuilder().setURL('attachment://' + name));
    }
  }
  delete payload.content; delete payload.embeds;
  payload.components = boxes;
  payload.flags = flags | MessageFlags.IsComponentsV2;
  payload.allowedMentions ??= { parse: [] };
  return payload;
}
module.exports = { container, v2Payload, footer };
