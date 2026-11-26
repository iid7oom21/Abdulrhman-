import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';

const probe = '__raven_layout_probe__.js'; // seeded before the build in CI

function filesIn(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)));
}

function sameFile(source, destination) {
  const stat = statSync(destination, { throwIfNoEntry: false });
  return stat?.isFile() && stat.size === statSync(source).size
    && readFileSync(source).equals(readFileSync(destination));
}

function assertStudioLayout(root) {
  const raven = join(root, 'dist/raven');
  const bundle = existsSync(raven) ? filesIn(raven).filter(name => name !== probe) : [];
  const anchor = bundle.includes('index.html') ? 'index.html' : bundle[0];
  for (const target of ['studio', 'dist/studio']) {
    const studio = join(root, target);
    if (!existsSync(studio)) continue;
    for (const reserved of ['raven', 'dist/raven']) {
      assert.ok(!statSync(join(studio, reserved), { throwIfNoEntry: false })?.isDirectory(), `Unexpected ${target}/${reserved}/ from dist/raven/`);
    }
    for (const name of filesIn(studio)) {
      assert.notEqual(basename(name), probe, `Unexpected ${target}/${name} from dist/raven/`);
      // A copy of the *contents* need not have a directory called "raven".
      // Match the whole bundle, not just a shared font or a file named index.html.
      if (!anchor || (name !== anchor && !name.endsWith(sep + anchor))) continue;
      const candidate = join(studio, name.slice(0, -anchor.length));
      const copied = bundle.every(file => sameFile(join(raven, file), join(candidate, file)));
      assert.ok(!copied, `Contents of dist/raven/ were copied into ${relative(root, candidate)}/`);
    }
  }
}

test('the checkout and build output keep the Raven bundle out of Studio', () => {
  assertStudioLayout(resolve(import.meta.dirname, '..'));
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'raven-layout-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const raven = join(root, 'dist/raven');
  mkdirSync(join(raven, 'assets'), { recursive: true });
  writeFileSync(join(raven, 'index.html'), '<title>RAVEN</title>');
  writeFileSync(join(raven, 'assets/site.css'), 'body {}');
  return { root, raven };
}

test('independent Studio entries can share individual assets', t => {
  const { root, raven } = fixture(t);
  cpSync(raven, join(root, 'studio'), { recursive: true });
  writeFileSync(join(root, 'studio/index.html'), '<title>Stage</title>');
  assertStudioLayout(root);
});

test('detects a copied probe even after the build removes its input', t => {
  const { root, raven } = fixture(t);
  writeFileSync(join(raven, probe), '// layout probe');
  cpSync(raven, join(root, 'studio/public'), { recursive: true });
  rmSync(raven, { recursive: true });
  assert.throws(() => assertStudioLayout(root), /studio\/public\/__raven_layout_probe__/);
});

for (const path of ['studio/raven', 'studio/dist/raven', 'studio', 'studio/public', 'dist/studio/raven', 'dist/studio']) {
  test(`rejects a Raven bundle copied to ${path}/`, t => {
    const { root, raven } = fixture(t);
    cpSync(raven, join(root, path), { recursive: true });
    assert.throws(() => assertStudioLayout(root), /dist\/raven\//);
  });
}
