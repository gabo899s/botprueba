const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { privateDirectory, privateFile, hardenPrivateTree } = require('../lib/private-files');
const project = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'maes-private-storage-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const mode = file => fs.statSync(file).mode & 0o777;
function fixture(name) {
  const directory = path.join(temporary, name);
  fs.mkdirSync(directory, { mode: 0o755 });
  return directory;
}
function legacyFile(directory, relative, contents) {
  const file = path.join(directory, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o755 });
  fs.writeFileSync(file, contents, { mode: 0o644 });
  fs.chmodSync(file, 0o644);
  return file;
}
function runStore(directory, extra = '') {
  const code = `process.umask(0o022);const cfg=require('./lib/config');cfg.root=process.env.FIXTURE_ROOT;const store=require('./lib/store');store.init();${extra}`;
  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: project,
    env: { ...process.env, FIXTURE_ROOT: directory, MAESRP_DATA_DIR: path.join(directory, 'bot/data') },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test('la migración protege JSON, colas, documentos y secretos existentes sin cambiar datos ni ejecutables', () => {
  const directory = fixture('migration');
  const legacy = legacyFile(directory, 'bot/data/cedulas.json', JSON.stringify({ A: { numeroCedula: 'A', nombre: 'SoloFixture' } }));
  const queued = legacyFile(directory, 'bot/data/processed/old.json', '{"fixture":true}');
  const pdf = legacyFile(directory, 'public/pdfs/old.pdf', 'fixture-pdf');
  const upload = legacyFile(directory, 'public/uploads/old.html', 'fixture-transcript');
  const env = legacyFile(directory, '.env', '# fixture, no credentials\n');
  const config = legacyFile(directory, 'bot/config.json', '{}');
  const executable = legacyFile(directory, '.runtime/node/bin/node', 'fixture-executable');
  fs.chmodSync(executable, 0o755);
  const publicAsset = legacyFile(directory, 'public/css/site.css', 'body{}');
  const result = JSON.parse(runStore(directory, `console.log(JSON.stringify(store.read('cedulas')))`));
  assert.equal(result.A.nombre, 'SoloFixture');
  for (const file of [legacy, queued, pdf, upload, env, config, path.join(directory, 'bot/data/maesrp.sqlite')]) assert.equal(mode(file), 0o600, file);
  for (const relative of ['bot/data', 'bot/data/notifications', 'bot/data/processed', 'bot/data/errors', 'public/pdfs', 'public/uploads', '.runtime']) assert.equal(mode(path.join(directory, relative)), 0o700, relative);
  assert.equal(mode(executable), 0o755);
  assert.equal(mode(publicAsset), 0o644);
  assert.equal(fs.readFileSync(legacy, 'utf8'), JSON.stringify({ A: { numeroCedula: 'A', nombre: 'SoloFixture' } }));
  assert.equal(fs.readFileSync(queued, 'utf8'), '{"fixture":true}');
});

test('exportar sobre archivos existentes produce copias privadas y completas', () => {
  const directory = fixture('export');
  const dest = path.join(directory, 'export');
  legacyFile(directory, 'export/cedulas.json', '{"old":true}');
  fs.chmodSync(dest, 0o755);
  runStore(directory, `store.write('cedulas',{A:{nombre:'ExportFixture'}});process.argv=[process.execPath,'scripts/data-tools.js','export',${JSON.stringify(dest)}];require('./scripts/data-tools');`);
  assert.equal(mode(dest), 0o700);
  for (const name of fs.readdirSync(dest)) assert.equal(mode(path.join(dest, name)), 0o600, name);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'cedulas.json'), 'utf8')), { A: { nombre: 'ExportFixture' } });
  assert.equal(fs.existsSync(path.join(dest, 'web-sessions.sqlite')), false);
});

test('los archivos privados rechazan enlaces sin modificar el destino externo', () => {
  const directory = fixture('symlinks');
  const target = legacyFile(directory, 'external.txt', 'external-fixture');
  const privateRoot = path.join(directory, 'private');
  privateDirectory(privateRoot);
  const link = path.join(privateRoot, 'alias.json');
  fs.symlinkSync(target, link);
  assert.throws(() => privateFile(link), { code: 'EPRIVATEPATH' });
  assert.throws(() => hardenPrivateTree(privateRoot), { code: 'EPRIVATEPATH' });
  assert.equal(mode(target), 0o644);
  assert.equal(fs.readFileSync(target, 'utf8'), 'external-fixture');
});

test('una carpeta de datos raíz enlazada explícitamente sigue siendo compatible', () => {
  const directory = fixture('linked-root');
  const target = path.join(directory, 'dedicated-storage');
  fs.mkdirSync(target, { mode: 0o755 });
  const data = path.join(directory, 'bot/data');
  fs.mkdirSync(path.dirname(data), { recursive: true });
  fs.symlinkSync(target, data, 'dir');
  runStore(directory);
  assert.equal(mode(target), 0o700);
  assert.equal(mode(path.join(target, 'maesrp.sqlite')), 0o600);
  assert.equal(fs.lstatSync(data).isSymbolicLink(), true);
});

test('las cachés de identidad se invalidan al crear, cambiar o borrar una cédula y nunca en rollback', () => {
  const directory = fixture('identity-cache');
  runStore(directory, `
    const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
    const card=path.join(cfg.root,'public/pdfs/cedula_RP-100.pdf');
    const fine=path.join(cfg.root,'public/pdfs/multa_fixture.pdf');
    const citizen={numeroCedula:'RP-100',discordId:'111111111111111111',nombre:'PreviousHolder'};
    fs.writeFileSync(card,'orphaned card');
    fs.writeFileSync(fine,'fine document');
    store.write('cedulas',{'RP-100':citizen});
    assert.equal(fs.existsSync(card),false,'creation removes orphaned identity cache');
    fs.writeFileSync(card,'current card');
    store.write('cedulas',{'RP-100':{...citizen}});
    assert.equal(fs.existsSync(card),true,'unchanged record keeps cache');
    assert.throws(()=>store.transaction(()=>{
      store.write('cedulas',{});
      assert.equal(fs.existsSync(card),true,'deletion is deferred until commit');
      throw Error('fixture rollback');
    }),/fixture rollback/);
    assert.equal(fs.existsSync(card),true,'rollback preserves current identity cache');
    assert.equal(store.read('cedulas')['RP-100'].nombre,'PreviousHolder');
    store.transaction(()=>{
      store.write('cedulas',{'RP-100':{...citizen,discordId:'222222222222222222',nombre:'NextHolder'}});
      assert.equal(fs.existsSync(card),true);
    });
    assert.equal(fs.existsSync(card),false,'committed reassignment removes previous holder cache');
    fs.writeFileSync(card,'next holder card');
    store.write('cedulas',{});
    assert.equal(fs.existsSync(card),false,'deletion removes cache');
    assert.equal(fs.readFileSync(fine,'utf8'),'fine document');
  `);
});
