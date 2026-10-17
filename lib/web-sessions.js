const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { privateDirectory, privateFile } = require('./private-files');
const SESSION_MS = 30 * 24 * 3600000;
// Server-side OAuth tokens never enter browser storage or plaintext data exports.
class WebSessions extends Map {
  constructor({ directory, secret }) {
    super();
    privateDirectory(directory);
    const file = path.join(directory, 'web-sessions.sqlite');
    privateFile(file);
    this.db = new DatabaseSync(file);privateFile(file);
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, expires INTEGER NOT NULL, payload TEXT NOT NULL)');
    this.key = crypto.createHash('sha256').update(secret).digest();
    for (const row of this.db.prepare('SELECT * FROM sessions').all()) {
      try {
        if(row.expires <= Date.now()) throw Error('expired');
        const packed = Buffer.from(row.payload, 'base64'), decipher = crypto.createDecipheriv('aes-256-gcm',this.key,packed.subarray(0,12));
        decipher.setAAD(Buffer.from(row.id));decipher.setAuthTag(packed.subarray(12,28));
        const value=JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)),decipher.final()]).toString());
        if(value.user?.mode!=='discord'||!value.oauth||value.expires!==row.expires)throw Error('invalid');
        value.permissionsChecked=0;super.set(row.id,value);
      } catch {this.db.prepare('DELETE FROM sessions WHERE id=?').run(row.id);}
    }
  }
  save(id) {
    const value=super.get(id);if(!value)return;
    const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(id));
    const body=Buffer.from(JSON.stringify({user:value.user,expires:value.expires,oauth:value.oauth}));
    const encrypted=Buffer.concat([cipher.update(body),cipher.final()]);
    const payload=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
    this.db.prepare('INSERT OR REPLACE INTO sessions(id,expires,payload) VALUES(?,?,?)').run(id,value.expires,payload);
  }
  set(id,value){super.set(id,value);try{this.save(id);}catch(error){super.delete(id);throw error;}return this;}
  delete(id){this.db.prepare('DELETE FROM sessions WHERE id=?').run(id);return super.delete(id);}
  close(){if(!this.closed){this.closed=true;this.db.close();}}
}
module.exports={WebSessions,SESSION_MS};
