const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");
function buildMessage(message) {
  const container = new ContainerBuilder();
  if (message.color) container.setAccentColor(parseInt(message.color, 16));
  let count = 1;
  for (const [index, part] of message.content
    .split(/\[separador\]/i)
    .entries()) {
    if (index) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      count++;
    }
    const images =
      part.match(
        /https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?/gi,
      ) || [];
    if (images.length > 10) throw Error("Máximo 10 imágenes por galería.");
    let text = part;
    for (const url of images) text = text.replace(url, "");
    if (text.trim()) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text.trim()),
      );
      count++;
    }
    if (images.length) {
      const gallery = new MediaGalleryBuilder().addItems(
        ...images.map((url) => new MediaGalleryItemBuilder().setURL(url)),
      );
      container.addMediaGalleryComponents(gallery);
      count += 1 + images.length;
    }
  }
  if (count > 40)
    throw Error("El mensaje supera el límite de componentes de Discord.");
  return container;
}
module.exports = { buildMessage };
