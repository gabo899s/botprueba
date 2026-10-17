const fs = require('node:fs');
const path = require('node:path');

function privatePathError(file) {
  return Object.assign(Error('Ruta privada no segura: ' + file + '. Usa archivos y carpetas normales, sin enlaces simbólicos internos.'), { code: 'EPRIVATEPATH' });
}

// Only the explicitly selected directory is changed; existing ancestors keep
// their permissions. A configured root directory may itself be a symlink.
function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  try {
    if (!fs.fstatSync(descriptor).isDirectory()) throw privatePathError(directory);
    fs.fchmodSync(descriptor, 0o700);
  } finally { fs.closeSync(descriptor); }
  return directory;
}

function privateFile(file) {
  let descriptor;
  try {
    // Never follow a file symlink while tightening permissions: its target may
    // be unrelated to the application's private storage.
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    if (!fs.fstatSync(descriptor).isFile()) throw privatePathError(file);
    fs.fchmodSync(descriptor, 0o600);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    if (error.code === 'ELOOP') throw privatePathError(file);
    throw error;
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}

function hardenPrivateTree(directory) {
  privateDirectory(directory);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw privatePathError(file);
    if (entry.isDirectory()) hardenPrivateTree(file);
    else if (entry.isFile()) privateFile(file);
    else throw privatePathError(file);
  }
}

module.exports = { privateDirectory, privateFile, hardenPrivateTree };
