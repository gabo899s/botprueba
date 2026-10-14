function messageText(message) {
  const parts = [];
  function visit(value) {
    if (!value) return;
    const data = value.toJSON ? value.toJSON() : value;
    if (Array.isArray(data)) { data.forEach(visit); return; }
    if (typeof data !== 'object') return;
    for (const key of ['title', 'description', 'content', 'label', 'url']) if (typeof data[key] === 'string') parts.push(data[key]);
    for (const key of ['components','items','media','file','fields','image','thumbnail','accessory']) visit(data[key]);
    if (data.name && data.value) parts.push(data.name + ': ' + data.value);
  }
  visit(message.components);
  visit(message.embeds);
  return parts.join('\n');
}
module.exports = { messageText };
