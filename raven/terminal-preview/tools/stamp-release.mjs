#!/usr/bin/env node
// Stamp the browser module graph as one release. Canonical shared files are
// hashed, but never rewritten. No generated manifest or dependency is needed.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HTML_ENTRIES = Object.freeze([
  'index.html', 'raven-17/index.html',
  'raven-17/part-1/index.html', 'raven-17/part-2/index.html',
  'raven-17/part-3/index.html', 'zarqa/index.html'
]);
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = value => /^(?:\.\.?\/|\/(?!\/))/.test(value);
const pathname = value => value.split(/[?#]/, 1)[0];

/** Only the raw v parameter changes; other query bytes and fragments survive. */
export function versionURL(value, token = '') {
  const hashAt = value.indexOf('#');
  const fragment = hashAt < 0 ? '' : value.slice(hashAt);
  const before = hashAt < 0 ? value : value.slice(0, hashAt);
  const queryAt = before.indexOf('?');
  const path = queryAt < 0 ? before : before.slice(0, queryAt);
  const params = queryAt < 0 ? [] : before.slice(queryAt + 1).split('&');
  const retained = params.filter(part => part.split('=', 1)[0] !== 'v');
  if (retained.length === 1 && retained[0] === '') retained.length = 0;
  if (token) retained.push(`v=${token}`);
  return path + (retained.length ? `?${retained.join('&')}` : '') + fragment;
}

// A lexical scan, not a search over arbitrary text: quoted examples, comments,
// regexes and template text cannot become accidental import specifiers.
function tokens(source) {
  const out = [];
  let i = 0;
  const regexAfter = new Set(['=', '(', '[', '{', ':', ',', ';', '!', '?', '&&', '||', 'return', 'throw', '=>']);
  function code(templateExpression = false) {
    let depth = 0;
    while (i < source.length) {
      const c = source[i];
      if (/\s/.test(c)) { i++; continue; }
      if (source.startsWith('//', i)) { i = source.indexOf('\n', i); if (i < 0) i = source.length; continue; }
      if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); if (end < 0) throw new Error('Unclosed JavaScript comment'); i = end + 2; continue; }
      if (c === '"' || c === "'") {
        const quote = c, start = ++i;
        while (i < source.length && source[i] !== quote) { if (source[i] === '\\') i++; i++; }
        if (i >= source.length) throw new Error('Unclosed JavaScript string');
        out.push({ kind: 'string', value: source.slice(start, i), start, end: i }); i++; continue;
      }
      if (c === '`') {
        i++;
        while (i < source.length && source[i] !== '`') {
          if (source[i] === '\\') { i += 2; continue; }
          if (source.startsWith('${', i)) { i += 2; code(true); continue; }
          i++;
        }
        if (i >= source.length) throw new Error('Unclosed JavaScript template');
        i++; out.push({ kind: 'template', value: '`' }); continue;
      }
      if (c === '/' && (!out.length || regexAfter.has(out.at(-1).value))) {
        i++; let inClass = false;
        while (i < source.length) {
          if (source[i] === '\\') { i += 2; continue; }
          if (source[i] === '[') inClass = true;
          if (source[i] === ']') inClass = false;
          if (source[i++] === '/' && !inClass) break;
        }
        while (/[a-z]/i.test(source[i] || '') && i < source.length) i++;
        out.push({ kind: 'regex', value: '/' }); continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        const start = i++;
        while (i < source.length && /[\w$]/.test(source[i])) i++;
        out.push({ kind: 'word', value: source.slice(start, i) }); continue;
      }
      if (templateExpression && c === '}' && depth === 0) { i++; return; }
      if (c === '{') depth++;
      if (c === '}') depth--;
      const pair = source.slice(i, i + 2);
      if (['=>', '&&', '||'].includes(pair)) { out.push({ kind: 'punct', value: pair }); i += 2; }
      else { out.push({ kind: 'punct', value: c }); i++; }
    }
  }
  code();
  return out;
}

export function importSpecifiers(source) {
  const list = tokens(source), found = new Map();
  const add = token => {
    if (token?.kind === 'string' && local(token.value) && /\.(?:m?js)$/.test(pathname(token.value))) {
      if (token.value.includes('\\')) throw new Error('Escaped local import paths are unsupported; use a literal path');
      found.set(token.start, token);
    }
  };
  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (token.kind !== 'word' || !['import', 'export'].includes(token.value)) continue;
    if (list[i - 1]?.value === '.') continue;
    const next = list[i + 1];
    if (token.value === 'import' && next?.kind === 'string') { add(next); continue; }
    if (token.value === 'import' && next?.value === '(') { add(list[i + 2]); continue; }
    if (next?.value === '.' || (token.value === 'export' && !['{', '*'].includes(next?.value))) continue;
    for (let j = i + 1; j < list.length && list[j].value !== ';'; j++) {
      if (list[j].kind === 'word' && list[j].value === 'from') { add(list[j + 1]); break; }
    }
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}

function replaceRanges(source, refs, token) {
  for (const ref of [...refs].sort((a, b) => b.start - a.start)) {
    source = source.slice(0, ref.start) + versionURL(ref.value, token) + source.slice(ref.end);
  }
  return source;
}
export const stampJavaScript = (source, token = '') => replaceRanges(source, importSpecifiers(source), token);

export function htmlReferences(source) {
  const refs = [];
  const visible = source.replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length));
  for (const match of visible.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attrs = new Map();
    for (const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
      const start = match.index + attr.index + attr[0].indexOf(attr[2]) + 1;
      attrs.set(attr[1].toLowerCase(), { value: attr[3], start, end: start + attr[3].length });
    }
    const script = match[1].toLowerCase() === 'script';
    const ref = attrs.get(script ? 'src' : 'href');
    if (!ref || !local(ref.value)) continue;
    if (script && /(?:^|\/)modules\/app\.js$/.test(pathname(ref.value))) refs.push(ref);
    if (!script && /\bstylesheet\b/i.test(attrs.get('rel')?.value || '') && /\.css$/.test(pathname(ref.value))) refs.push(ref);
  }
  return refs;
}
export const stampHTML = (source, token = '') => replaceRanges(source, htmlReferences(source), token);

/** Compute all proposed writes before touching any file. */
export async function planRelease(root = DEFAULT_ROOT) {
  root = resolve(root);
  const moduleNames = (await readdir(resolve(root, 'modules'))).filter(name => /\.(?:js|css)$/.test(name)).sort();
  const files = new Map();
  for (const name of [...HTML_ENTRIES, 'styles.css', ...moduleNames.map(name => `modules/${name}`)]) {
    const original = await readFile(resolve(root, name), 'utf8');
    const kind = name.endsWith('.html') ? 'html' : name.endsWith('.js') ? 'js' : 'css';
    const normalized = kind === 'js' ? stampJavaScript(original) : kind === 'html' ? stampHTML(original) : original;
    files.set(name, { original, normalized, kind });
  }
  // Shared canonical documents are leaves, outside the mutable release graph.
  // Their bytes still contribute so a factual source update gets a new URL.
  const external = new Map();
  for (const [name, file] of files) {
    if (file.kind !== 'js') continue;
    for (const ref of importSpecifiers(file.original)) {
      if (ref.value.startsWith('/')) throw new Error(`Use relative local module paths: ${name}: ${ref.value}`);
      const target = resolve(root, dirname(name), pathname(ref.value));
      const key = relative(root, target).split(sep).join('/');
      if (files.has(key) || external.has(key)) continue;
      const source = await readFile(target, 'utf8');
      if (importSpecifiers(source).length) throw new Error(`Shared import is not a leaf: ${key}`);
      external.set(key, source);
    }
  }
  const inputs = [...files].map(([name, file]) => [name, file.normalized]).concat([...external]);
  inputs.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const hash = createHash('sha256');
  for (const [name, source] of inputs) hash.update(`${Buffer.byteLength(name)}:${name}${Buffer.byteLength(source)}:`).update(source);
  const token = hash.digest('hex').slice(0, 16);
  const changes = [];
  for (const [name, file] of files) {
    const content = file.kind === 'js' ? stampJavaScript(file.original, token) : file.kind === 'html' ? stampHTML(file.original, token) : file.original;
    if (content !== file.original) changes.push({ path: name, content });
  }
  return { root, token, changes, inputs: inputs.map(([name]) => name) };
}

export async function stampRelease(root = DEFAULT_ROOT, { check = false } = {}) {
  const plan = await planRelease(root);
  if (!check) for (const change of plan.changes) await writeFile(resolve(plan.root, change.path), change.content);
  return { ...plan, ok: !check || plan.changes.length === 0 };
}

async function main(args) {
  let root = DEFAULT_ROOT, check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--root' && args[i + 1]) root = resolve(args[++i]);
    else throw new Error('Usage: node tools/stamp-release.mjs [--check] [--root PATH]');
  }
  const result = await stampRelease(root, { check });
  console.log(`RAVEN release ${result.token}: ${check ? (result.ok ? 'verified' : 'stamping required') : `stamped ${result.changes.length} files`}`);
  if (check && !result.ok) {
    for (const change of result.changes) console.error(`  ${change.path}`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
