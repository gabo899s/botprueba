const { identityFilename } = require('./identity-document');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const PDFDocument = require('pdfkit');
const { root } = require('./config');
const INK='#192129', RED='#9b2634', MUTED='#68717a', LINE='#dce0e3', PAPER='#f3f4f5';
function document(options) {
  const doc=new PDFDocument(options);
  for(const [name,file]of Object.entries({Body:'OpenSans-Regular.ttf',BodyBold:'OpenSans-Semibold.ttf',Heading:'NotoSerif-Bold.ttf'}))doc.registerFont(name,path.join(__dirname,'pdf-fonts',file));
  return doc;
}
const value = v => v === undefined || v === null || v === '' ? 'No consignado' : String(v);
async function save(doc, filename, render) {
  if (!/^[\w-]+\.pdf$/.test(filename)) {doc.destroy();throw Object.assign(Error('Nombre de documento inválido.'), {status:400});}
  const dir=path.join(root,'public/pdfs');fs.mkdirSync(dir,{recursive:true});
  const temporary=path.join(dir,`.${filename}.${crypto.randomUUID()}.tmp`);
  const done=pipeline(doc,fs.createWriteStream(temporary,{mode:0o600}));
  try {render();doc.end();await done;await fs.promises.rename(temporary,path.join(dir,filename));}
  catch(error){doc.destroy();await done.catch(()=>{});await fs.promises.rm(temporary,{force:true});throw error;}
  return filename;
}
function text(doc,s,x,y,size=10,font='Body',options={}) {
  doc.font(font).fontSize(size).fillColor(INK).text(value(s),x,y,options);
}
function rule(doc,y){doc.moveTo(48,y).lineTo(547,y).strokeColor(LINE).lineWidth(.6).stroke();}
function lines(doc,s,width,size=10,font='Body') {
  doc.font(font).fontSize(size);
  const output=[];
  for(const paragraph of value(s).split(/\r?\n/)) {
    let line='';
    for(const word of paragraph.split(/\s+/)) {
      const candidate=line?line+' '+word:word;
      if(doc.widthOfString(candidate)<=width){line=candidate;continue;}
      if(line){output.push(line);line='';}
      if(doc.widthOfString(word)<=width){line=word;continue;}
      // Los identificadores sin espacios también se conservan íntegros.
      for(const char of word){if(doc.widthOfString(line+char)>width&&line){output.push(line);line='';}line+=char;}
    }
    output.push(line);
  }
  return output;
}
function footer(doc) {
  const range=doc.bufferedPageRange();
  for(let i=0;i<range.count;i++){
    doc.switchToPage(range.start+i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;
    rule(doc,780);
    text(doc,'MAES ROLEPLAY  /  REGISTRO INTERNO',48,791,7,'BodyBold',{lineBreak:false});
    doc.font('Body').fontSize(7).fillColor(MUTED).text(`Página ${i+1} de ${range.count}`,447,791,{width:100,align:'right',lineBreak:false});
    doc.text('Documento de ficción para Maes Roleplay / ER:LC. Sin validez legal.',48,806,{width:499,lineBreak:false});
    doc.page.margins.bottom=bottom;
  }
}
function recordLayout(doc,type,r,image) {
  const isFine=type==='multa';let y;
  function page(){
    doc.addPage();doc.rect(0,0,595.28,9).fill(RED);
    text(doc,'MAES',48,32,24,'BodyBold');text(doc,'ROLEPLAY',126,39,11,'Body');
    doc.fontSize(8).fillColor(MUTED).text('SISTEMA DE REGISTROS POLICIALES',48,64);
    doc.roundedRect(434,33,113,27,4).fill(PAPER);text(doc,isFine?'MULTA':'ARRESTO',434,42,9,'BodyBold',{width:113,align:'center'});
    text(doc,isFine?'Acta de infracción':'Registro de detención',48,91,25,'Heading');
    doc.font('Body').fontSize(8).fillColor(MUTED).text('EXPEDIENTE  '+value(r.id),48,125,{width:499});
    rule(doc,146);y=165;
  }
  function room(height){if(y+height>748)page();}
  function section(number,title){room(53);doc.rect(48,y,3,15).fill(RED);text(doc,number+'  '+title.toUpperCase(),60,y+2,9,'BodyBold');y+=30;}
  function field(label,v){const wrapped=lines(doc,v,342,10);room(19);let first=true;
    for(const line of wrapped){room(15);if(first){doc.font('Body').fontSize(8).fillColor(MUTED).text(label,48,y+1,{width:145});first=false;}text(doc,line,205,y,10);y+=15;}y+=8;
  }
  function paragraph(s){for(const line of lines(doc,s,475,10)){room(16);text(doc,line,60,y,10);y+=16;}y+=14;}
  page();
  room(70);doc.roundedRect(48,y,499,62,5).fill(PAPER);
  text(doc,isFine?'IMPORTE REGISTRADO':'TIEMPO DE SENTENCIA',63,y+12,8,'BodyBold');
  const metric=isFine?'$'+Number(r.monto).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):value(r.tiempo)+' años';
  text(doc,metric,63,y+27,21,'BodyBold');
  text(doc,'ESTADO AL EMITIR',360,y+12,8,'BodyBold');text(doc,value(r.estado),360,y+29,10,'BodyBold',{width:170});y+=84;
  section('01','Datos del registro');field('Fecha de registro',r.fecha);field('Identificador',r.id);
  if(r.createdAt)field('Marca temporal de origen',r.createdAt);
  section('02','Identificación del ciudadano');field('Nombre completo',r.ciudadano);field('Cédula del personaje',r.documento);field('Cuenta Discord',r.userId||'No vinculada');
  if(isFine)field('Placa del vehículo',r.placa||'No aplica');
  section('03','Artículos y fundamento del registro');paragraph(r.articulos);
  section('04','Oficial responsable');field('Nombre del oficial',r.oficialNombre);field('Identificador del oficial',r.oficialId);
  if(r.vence){field('Vencimiento registrado',r.vence);}
  if(r.payment){field('Referencia de pago',r.payment.reference);field('Validado por',r.payment.approvedBy);field('Fecha de validación',r.payment.at);}
  section('05','Trazabilidad');paragraph('Registro emitido por el sistema de Maes Roleplay a partir de los datos consignados por el oficial. El estado indicado corresponde al momento de emisión; consulta el panel para conocer cambios posteriores.');
  if(image){page();section('ANEXO','Evidencia asociada');paragraph('Archivo adjunto al expediente: '+r.imagenFileName);room(280);const available=748-y;doc.rect(48,y,499,available).fillAndStroke('#fafafa',LINE);doc.image(image,60,y+12,{fit:[475,available-24],align:'center',valign:'center'});}
  footer(doc);
}
async function generate(type,r) {
  if(!['multa','arresto'].includes(type))throw Error('Tipo de registro no admitido.');
  const doc=document({autoFirstPage:false,size:'A4',margin:48,bufferPages:true,info:{Title:type==='multa'?'Acta de infracción | Maes Roleplay':'Registro de detención | Maes Roleplay',Author:'Maes Roleplay',Subject:'Documento de ficción para ER:LC. Sin validez legal.'}});
  let image;
  if(r.imagenFileName){try{if(path.basename(r.imagenFileName)!==r.imagenFileName)throw Error();image=doc.openImage(path.join(root,'public/uploads',r.imagenFileName));
    if(!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width<1||image.height<1||image.width>6000||image.height>6000||image.width*image.height>10000000)throw Error('dimensions');}catch{doc.destroy();throw Object.assign(Error('La imagen es inválida o demasiado grande. Usa PNG/JPEG de hasta 6000 px por lado y 10 megapíxeles.'),{status:400});}}
  return save(doc,r.id+'.pdf',()=>recordLayout(doc,type,r,image));
}
function fitText(doc,s,x,y,width,size,min=7,font='Body'){
  s=value(s);doc.font(font);while(size>min&&doc.fontSize(size).widthOfString(s)>width)size-=.5;
  text(doc,s,x,y,size,font,{width,height:34,ellipsis:true});
}
async function identityPdf(c){
  const filename=identityFilename(c);
  const doc=document({size:[600,340],margin:0,info:{Title:'Identidad de personaje | Maes Roleplay',Author:'Maes Roleplay',Subject:'Credencial de roleplay sin validez legal'}});
  return save(doc,filename,()=>{
    doc.rect(0,0,600,340).fill('#f8f7f4');doc.rect(0,0,600,74).fill(INK);doc.rect(0,74,600,4).fill(RED);
    doc.font('BodyBold').fontSize(18).fillColor('#ffffff').text('MAES ROLEPLAY',28,21);doc.font('Body').fontSize(8).fillColor('#cdd2d6').text('REGISTRO DE IDENTIDAD DEL PERSONAJE',29,47);
    doc.font('BodyBold').fontSize(10).fillColor('#ffffff').text('CREDENCIAL RP',418,29,{width:154,align:'right'});
    doc.roundedRect(28,99,98,120,6).fillAndStroke('#eceae6','#ddd9d2');doc.circle(77,134,15).fill('#c5c4c1');doc.roundedRect(50,158,54,37,15).fill('#c5c4c1');text(doc,'PERSONAJE',28,204,7,'BodyBold',{width:98,align:'center'});
    text(doc,'NOMBRE Y APELLIDOS',148,99,7,'BodyBold');fitText(doc,[c.nombre,c.apellidos].filter(Boolean).join(' '),148,114,422,18,9,'BodyBold');
    function field(label,v,x,y,w=198){doc.font('BodyBold').fontSize(7).fillColor(MUTED).text(label,x,y);fitText(doc,v,x,y+13,w,10,7);}
    field('CÉDULA DEL PERSONAJE',c.numeroCedula,148,157);field('NACIMIENTO',c.fechaNacimiento,374,157);
    field('NACIONALIDAD',c.nacionalidad,148,199);field('PROVINCIA',c.provincia,374,199);
    field('CUENTA DISCORD',c.discordId,28,244,300);field('ROBLOX',c.roblox?.username||c.robloxUsername,374,244);
    doc.moveTo(28,294).lineTo(572,294).strokeColor('#d7d5d0').stroke();text(doc,'USO EXCLUSIVO EN MAES ROLEPLAY / ER:LC',28,306,7,'BodyBold');doc.font('Body').fontSize(7).fillColor(MUTED).text('Documento de ficción. Sin validez legal.',28,320);
  });
}
module.exports={generate,identityPdf};
