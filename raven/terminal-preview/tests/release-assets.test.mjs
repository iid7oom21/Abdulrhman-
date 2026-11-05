import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HTML_ENTRIES, versionURL, importSpecifiers, stampJavaScript, stampHTML, planRelease, stampRelease } from '../tools/stamp-release.mjs';

const TOOL = fileURLToPath(new URL('../tools/stamp-release.mjs', import.meta.url));
async function fixture(t) {
  const temp = await mkdtemp(resolve(tmpdir(), 'raven-release-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = resolve(temp, 'repo/raven/terminal-preview');
  const put = async (name, content) => { const path = resolve(root, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, content); };
  await put('modules/app.js', "import { core } from './core.js?v=old';\nconst route = () => import('./home.js?mode=full&v=old#screen');\n");
  await put('modules/core.js', "import { FACT } from '../../../fourth-signature/case-data.js?v=fourth-1';\nexport const core = FACT;\n");
  await put('modules/home.js', "import './nested.js';\nexport { value } from './nested.js';\n");
  await put('modules/nested.js', 'export const value = 1;\n');
  await put('../../fourth-signature/case-data.js', "export const FACT = 'unaltered';\n");
  await put('styles.css', 'body { color: gold; }\n');
  await put('modules/case.css', '.case { display: grid; }\n');
  for (const entry of HTML_ENTRIES) {
    const prefix = '../'.repeat(entry.split('/').length - 1) || './';
    await put(entry, `<!doctype html>\n<link rel="stylesheet" href="${prefix}styles.css?v=old">\n<link href='${prefix}modules/case.css?theme=dark&v=old#rules' rel='stylesheet'>\n<script type="module" src="${prefix}modules/app.js?v=old"></script>\n`);
  }
  return { root, put, read: name => readFile(resolve(root, name), 'utf8') };
}

test('version replacement preserves query values, fragments, and unrelated bytes', () => {
  assert.equal(versionURL('./a.js?lang=ar%20SA&v=old&mode=x+y#x', 'next'), './a.js?lang=ar%20SA&mode=x+y&v=next#x');
  assert.equal(versionURL('./a.js?v=old&v=older#x'), './a.js#x');
  assert.equal(versionURL('./a.js?view=1#v=old', 'next'), './a.js?view=1&v=next#v=old');
});

test('static, dynamic, shared and re-export imports are stamped without rewriting examples or URLs', () => {
  const source = [
    "import { x } from './core.js';",
    "import './side.js';",
    "export { x } from '../shared.js?v=old';",
    "const load = () => import('./lazy.js?mode=a%2Bb#top');",
    "import { facts } from '../../../fourth-signature/case-data.js?v=fourth-1';",
    "import remote from 'https://example.com/x.js';",
    "const text = \"import('./quoted.js')\";",
    "// import './comment.js';",
    "/* import('./block.js') */",
    "const pattern = /import\('example'\)/;",
    "const template = `import('./template-text.js') ${import('./in-expression.js')}`;",
    "const asset = new URL('./asset.js', import.meta.url);"
  ].join('\n');
  const refs = importSpecifiers(source);
  assert.equal(refs.length, 6);
  const stamped = stampJavaScript(source, 'abc');
  for (const ref of refs) assert.ok(stamped.includes(versionURL(ref.value, 'abc')));
  for (const unchanged of ["import('./quoted.js')", "import './comment.js'", "import('./block.js')", "import('./template-text.js')", "new URL('./asset.js'", 'https://example.com/x.js']) assert.ok(stamped.includes(unchanged));
  assert.equal(stampJavaScript(stamped), stampJavaScript(source));
});

test('HTML stamps only app module and local styles while preserving formatting', () => {
  const source = `<!-- <script src="./modules/app.js"></script> -->\n<link rel='stylesheet' href='./styles.css?x=%20#theme'>\n<script type="module" src="../modules/app.js"></script>\n<link rel="icon" href="./favicon.svg">\n<link rel="stylesheet" href="https://example.com/x.css">`;
  const stamped = stampHTML(source, 'abc');
  assert.equal(stamped, source.replace("href='./styles.css?x=%20#theme'", "href='./styles.css?x=%20&v=abc#theme'").replace('src="../modules/app.js"', 'src="../modules/app.js?v=abc"'));
});

test('release is deterministic and idempotent, including all seven HTML entries and shared leaf URLs', async t => {
  const f = await fixture(t);
  const canonical = await f.read('../../fourth-signature/case-data.js');
  const initial = await planRelease(f.root);
  const applied = await stampRelease(f.root);
  const after = await planRelease(f.root);
  assert.equal(initial.token, applied.token);
  assert.equal(initial.token, after.token);
  assert.deepEqual(after.changes, []);
  assert.equal(await f.read('../../fourth-signature/case-data.js'), canonical);
  assert.match(await f.read('modules/core.js'), new RegExp(`case-data\\.js\\?v=${initial.token}`));
  for (const entry of HTML_ENTRIES) {
    const html = await f.read(entry);
    assert.equal((html.match(new RegExp(`v=${initial.token}`, 'g')) || []).length, 3, entry);
  }
  const checked = await stampRelease(f.root, { check: true });
  assert.equal(checked.ok, true);
});

test('a transitive browser dependency, canonical leaf, module CSS, main CSS or HTML changes the release', async t => {
  const f = await fixture(t);
  let token = (await stampRelease(f.root)).token;
  for (const name of ['modules/nested.js', '../../fourth-signature/case-data.js', 'modules/case.css', 'styles.css', 'zarqa/index.html']) {
    await f.put(name, `${await f.read(name)}\n/* content changed */\n`);
    const next = await planRelease(f.root);
    assert.notEqual(next.token, token, name);
    token = (await stampRelease(f.root)).token;
  }
});

test('old v values do not influence release token', async t => {
  const f = await fixture(t);
  const before = await planRelease(f.root);
  await f.put('modules/app.js', (await f.read('modules/app.js')).replaceAll('v=old', 'v=completely-different'));
  await f.put('index.html', (await f.read('index.html')).replaceAll('v=old', 'v=another'));
  assert.equal((await planRelease(f.root)).token, before.token);
});

test('--check reports drift without changing any files and CLI default repairs it', async t => {
  const f = await fixture(t);
  const original = await f.read('modules/app.js');
  const failed = spawnSync(process.execPath, [TOOL, '--root', f.root, '--check'], { encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /stamping required/);
  assert.equal(await f.read('modules/app.js'), original);
  execFileSync(process.execPath, [TOOL, '--root', f.root]);
  const passed = spawnSync(process.execPath, [TOOL, '--root', f.root, '--check'], { encoding: 'utf8' });
  assert.equal(passed.status, 0);
  const stamped = await f.read('modules/app.js');
  await f.put('modules/case.css', 'body { color: white; }');
  assert.equal(spawnSync(process.execPath, [TOOL, '--root', f.root, '--check']).status, 1);
  assert.equal(await f.read('modules/app.js'), stamped);
});

test('shared non-leaf imports fail before writes, instead of silently shipping an incoherent graph', async t => {
  const f = await fixture(t);
  const original = await f.read('modules/app.js');
  await f.put('../../fourth-signature/case-data.js', "import './other.js'; export const FACT = 1;");
  await assert.rejects(stampRelease(f.root), /not a leaf/);
  assert.equal(await f.read('modules/app.js'), original);
});
