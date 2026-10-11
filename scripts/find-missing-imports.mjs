import fs from 'fs';
import path from 'path';

const root = path.resolve('.');
const src = path.join(root, 'src');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const missing = [];
const re = /from\s+['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g;

for (const file of walk(src)) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = re.exec(content))) {
    const spec = match[1];
    let resolved;
    if (spec.startsWith('@/')) {
      resolved = path.join(src, spec.slice(2));
    } else {
      resolved = path.resolve(path.dirname(file), spec);
    }
    const candidates = [
      resolved,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      path.join(resolved, 'index.js'),
      path.join(resolved, 'index.jsx'),
      path.join(resolved, 'index.ts'),
    ];
    if (!candidates.some((c) => fs.existsSync(c))) {
      missing.push({ file: path.relative(root, file), spec });
    }
  }
}

if (missing.length === 0) {
  console.log('No missing local imports');
} else {
  console.log(JSON.stringify(missing, null, 2));
  process.exitCode = 1;
}
