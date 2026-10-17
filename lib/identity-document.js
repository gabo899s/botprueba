const crypto = require('node:crypto');
// Bind a regenerable identity PDF to the exact owner and rendered fields.
// Old generators finishing after a reassignment cannot publish the former card
// under the new owner's filename.
function identityFilename(c) {
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(c?.numeroCedula || ''))
    throw Object.assign(Error('Número de cédula inválido.'), { status: 400 });
  const fields = ['numeroCedula','discordId','nombre','apellidos','fechaNacimiento','nacionalidad','provincia'];
  const snapshot=Object.fromEntries(fields.map(key=>[key,String(c[key]??'')]));
  snapshot.robloxUsername=String(c.roblox?.username||c.robloxUsername||'');
  const hash=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0,32);
  return 'cedula_'+c.numeroCedula+'_'+hash+'.pdf';
}
module.exports={identityFilename};
