import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paths = execFileSync('git', ['ls-files', '-z', 'app', 'tests', 'scripts'], { encoding: 'utf8' }).split('\0').filter(path => /\.(?:[cm]?[jt]sx?|css)$/.test(path));
const decoder = new TextDecoder('utf-8', { fatal: true });
const failures = [];
for (const path of paths) {
  try {
    const text = decoder.decode(readFileSync(path));
    if (/\u00c3[\u0080-\u00bf]|\u00c2[\u00a0-\u00bf]|\u00e2[\u0080-\u00bf\u2020\u20ac]/u.test(text)) failures.push(`${path}: possible double-encoded text`);
  } catch { failures.push(`${path}: invalid UTF-8 or unreadable source`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Checked UTF-8 source text in ${paths.length} files.`);
