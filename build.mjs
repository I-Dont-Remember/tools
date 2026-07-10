#!/usr/bin/env node
// Builds every tool folder into _site/<folder>/ for a single Cloudflare Pages deploy.
//
// Per folder, in priority order:
//   1. build.sh present    -> run it, then copy its dist/ (or the folder itself if no dist/)
//   2. package.json has a "build" script -> npm ci && npm run build, then copy dist/
//   3. index.html present  -> copy the folder as static output
//   4. otherwise           -> skipped
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  cpSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '_site');
const IGNORE_DIRS = new Set(['_site', 'node_modules']);

// Files/dirs that shouldn't leak into static-copy output (source metadata, not site assets).
const STATIC_COPY_FILTER = new Set([
  '.git',
  '.claude',
  '.gitignore',
  'node_modules',
  'README.md',
  'notes.md',
]);

function isToolDir(name) {
  if (name.startsWith('.') || IGNORE_DIRS.has(name)) return false;
  return statSync(path.join(ROOT, name)).isDirectory();
}

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(' ')}  (in ${path.relative(ROOT, cwd) || '.'})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest, filter) {
  cpSync(src, dest, {
    recursive: true,
    filter: filter ? (p) => !filter.has(path.basename(p)) : undefined,
  });
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const tools = readdirSync(ROOT).filter(isToolDir).sort();
const built = [];

for (const name of tools) {
  const dir = path.join(ROOT, name);
  const dest = path.join(OUT_DIR, name);
  const buildShPath = path.join(dir, 'build.sh');
  const pkgPath = path.join(dir, 'package.json');

  if (existsSync(buildShPath)) {
    console.log(`\n=== ${name}: build.sh ===`);
    run('./build.sh', [], dir);
    const distDir = path.join(dir, 'dist');
    copyDir(existsSync(distDir) ? distDir : dir, dest, existsSync(distDir) ? undefined : STATIC_COPY_FILTER);
  } else if (existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, 'utf8')).scripts?.build) {
    console.log(`\n=== ${name}: npm build ===`);
    run('npm', ['ci'], dir);
    run('npm', ['run', 'build'], dir);
    const distDir = path.join(dir, 'dist');
    if (!existsSync(distDir)) {
      throw new Error(`${name}: "npm run build" did not produce ${path.relative(ROOT, distDir)}`);
    }
    copyDir(distDir, dest);
  } else if (existsSync(path.join(dir, 'index.html'))) {
    console.log(`\n=== ${name}: static copy ===`);
    copyDir(dir, dest, STATIC_COPY_FILTER);
  } else {
    console.log(`\n=== ${name}: skipped (no index.html, build.sh, or package.json build script) ===`);
    continue;
  }
  built.push(name);
}

const links = built.map((name) => `    <li><a href="/${name}/">${name}</a></li>`).join('\n');
writeFileSync(
  path.join(OUT_DIR, 'index.html'),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>tools</title>
</head>
<body>
  <h1>tools</h1>
  <ul>
${links}
  </ul>
</body>
</html>
`,
);

console.log(`\nBuilt ${built.length} tool(s) into ${path.relative(ROOT, OUT_DIR)}/`);
