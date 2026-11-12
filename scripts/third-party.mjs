// Writes THIRD-PARTY.txt: every package that ends up in the built app (production dependencies,
// direct and indirect), with its version and licence. Run with `npm run licenses` after changing
// dependencies; the release checks the file is up to date.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { encoding: 'utf8' }));
const found = new Map();

function walk(dependencies = {}) {
  for (const [name, info] of Object.entries(dependencies)) {
    const key = `${name}@${info.version}`;
    if (found.has(key) || !info.version) continue;
    let license = 'UNKNOWN';
    let repository = '';
    try {
      const pkg = JSON.parse(readFileSync(join('node_modules', name, 'package.json'), 'utf8'));
      license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? license);
      repository = typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '');
    } catch {
      // nested copy of a package with another version: keep UNKNOWN rather than guess
    }
    found.set(key, { name, version: info.version, license, repository });
    walk(info.dependencies);
  }
}
walk(tree.dependencies);

const rows = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
const byLicense = rows.reduce((counts, row) => counts.set(row.license, (counts.get(row.license) ?? 0) + 1), new Map());
const lines = [
  'Third-party software in Duewise Web',
  '',
  'The built app (the files nginx serves) contains these packages. Each is licensed under its own',
  'terms; the licence texts are in each package (node_modules/<name>/LICENSE) and at its repository.',
  '',
  `Licences: ${[...byLicense].map(([license, count]) => `${license} (${count})`).join(', ')}`,
  '',
  ...rows.map(
    (row) =>
      `${row.name} ${row.version} - ${row.license}${row.repository ? ` - ${row.repository.replace(/^git\+/, '')}` : ''}`,
  ),
  '',
];
writeFileSync('THIRD-PARTY.txt', lines.join('\n'));
console.log(`THIRD-PARTY.txt: ${rows.length} packages; ${lines[5]}`);
