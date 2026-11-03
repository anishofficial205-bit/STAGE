// Builds the landing page into public/welcome/, so it ships with the app at /welcome/.
// Edit landing/manch.html, then run: npm run landing
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'landing');
const out = path.join(root, 'public', 'welcome');

const page = fs.readFileSync(path.join(src, 'manch.html'), 'utf8')
  .replaceAll('src="img/', 'src="/welcome/img/')
  .replaceAll('url(img/', 'url(/welcome/img/')
  .replaceAll('src="img/${', 'src="/welcome/img/${');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(src, 'img'), path.join(out, 'img'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'index.html'),
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<link rel="icon" href="/logo.svg" type="image/svg+xml">\n</head>\n<body>\n' + page + '\n</body>\n</html>\n',
);
console.log('Landing page written to public/welcome/');
