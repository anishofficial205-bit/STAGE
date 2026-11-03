// Builds the landing page into public/, so it is the site's front page and the app sits at /app/.
// Edit landing/manch.html, then run: npm run landing (the build runs it too).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'landing');
const pub = path.join(root, 'public');
const imgs = path.join(pub, 'landing');

const page = fs.readFileSync(path.join(src, 'manch.html'), 'utf8')
  .replaceAll('src="img/', 'src="/landing/')
  .replaceAll('url(img/', 'url(/landing/');

// Old links to the app's front page (/?show=...) still open the app.
const head = `<script>window.MANCH_APP = '/app/'; if (/[?&]show=/.test(location.search)) location.replace('/app/' + location.search);</script>`;

fs.rmSync(imgs, { recursive: true, force: true });
fs.rmSync(path.join(pub, 'welcome'), { recursive: true, force: true });
fs.cpSync(path.join(src, 'img'), imgs, { recursive: true });
fs.writeFileSync(
  path.join(pub, 'index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<link rel="icon" href="/logo.svg" type="image/svg+xml">\n${head}\n</head>\n<body>\n${page}\n</body>\n</html>\n`,
);
// The landing page used to live at /welcome/.
fs.mkdirSync(path.join(pub, 'welcome'), { recursive: true });
fs.writeFileSync(path.join(pub, 'welcome', 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/"><link rel="canonical" href="/"><title>Manch</title><a href="/">Manch</a>\n');
console.log('Landing page written to public/index.html; the app is at /app/.');
