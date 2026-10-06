// Сборка статического сайта «Удача» в dist/ — обычные файлы для любого хостинга (Vercel, Timeweb).
// Фото берутся из карточки кафе на Яндекс Картах и сжимаются в webp, шрифты — из пакетов @fontsource.
import { mkdir, readFile, writeFile, cp, rm, access, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const OUT = 'dist';
const IMG = `${OUT}/assets/img`;
const FONTS = `${OUT}/assets/fonts`;
// Адрес сайта — ЕДИНСТВЕННОЕ место, откуда берутся абсолютные ссылки (canonical, og:url, og:image, twitter:image,
// JSON-LD, sitemap.xml, robots.txt). Порядок: переменная SITE_URL → адрес проекта на Vercel → адрес по умолчанию.
// Свой домен: SITE_URL=https://example.ru npm run build   (кириллический домен — в punycode, xn--…)
const DEFAULT_SITE_URL = 'https://udacha-hosta.vercel.app';
const SITE_URL = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(SITE_URL)) {
  throw new Error(`SITE_URL должен быть вида https://example.ru (без пути, кириллица — в punycode), получено: ${SITE_URL}`);
}
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

await rm(OUT, { recursive: true, force: true });
await cp('src', OUT, { recursive: true });
await mkdir(IMG, { recursive: true });
await mkdir(FONTS, { recursive: true });

// 1. Шрифты: только кириллица + латиница
const fontFiles = [
  ['@fontsource/yeseva-one', ['yeseva-one-cyrillic-400-normal.woff2', 'yeseva-one-latin-400-normal.woff2']],
  ['@fontsource-variable/manrope', ['manrope-cyrillic-wght-normal.woff2', 'manrope-latin-wght-normal.woff2']],
  ['@fontsource/caveat', ['caveat-cyrillic-600-normal.woff2', 'caveat-latin-600-normal.woff2']],
];
for (const [pkg, files] of fontFiles) {
  const dir = path.dirname(require.resolve(`${pkg}/package.json`));
  for (const f of files) await cp(path.join(dir, 'files', f), path.join(FONTS, f));
}

// 2. Фото первого экрана — из локального файла в папке hero/ (улучшенная версия фото из карточки).
//    Берётся первый найденный: hero/hero.jpg, .jpeg, .png, .webp, .avif, иначе части hero/hero.avif.b64.1, .2, … (картинка в base64,
//    потому что GitHub-коннектор умеет класть в репозиторий только текст).
async function exists(f) { try { await access(f); return true; } catch { return false; } }
async function localHero() {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'avif']) if (await exists(`hero/hero.${ext}`)) return readFile(`hero/hero.${ext}`);
  if (!(await exists('hero'))) return null;
  const parts = (await readdir('hero')).filter((f) => /^hero\.avif\.b64(\.\d+)?$/.test(f))
    .sort((x, y) => (+x.split('.').pop() || 0) - (+y.split('.').pop() || 0));
  if (!parts.length) return null;
  let b64 = '';
  for (const f of parts) b64 += await readFile(`hero/${f}`, 'utf8');
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64');
}
const heroBuf = await localHero();

// Остальные фото — из карточки на Яндекс Картах
const photos = JSON.parse(await readFile('photos.json', 'utf8'));
async function download(id) {
  const url = `https://avatars.mds.yandex.net/get-altay/${id}/XXL`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      console.warn(`HTTP ${r.status} ${url}`);
    } catch (e) { console.warn(`retry ${url}: ${e.message}`); }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`Не удалось скачать ${url}`);
}
const entries = Object.entries(photos).filter(([k]) => !k.startsWith('_'));
const buffers = {};
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }
await pool(entries, 6, async ([name, id]) => {
  const buf = name === 'hero' && heroBuf ? heroBuf : await download(id);
  buffers[name] = buf;
  const base = sharp(buf).rotate();
  const max = name === 'hero' ? 1920 : 1200; // первый экран во всю ширину — нужен крупнее
  await base.clone().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).webp({ quality: name === 'hero' ? 82 : 78, effort: 6 }).toFile(`${IMG}/${name}.webp`);
  await base.clone().resize({ width: 560, height: 560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(`${IMG}/${name}-s.webp`);
});

// Вертикальный кадр первого экрана для телефона и картинка для соцсетей
{
  const meta = await sharp(buffers.hero).metadata();
  const cw = Math.round(meta.height * 0.62);
  const left = Math.round(meta.width * 0.58 - cw / 2);
  await sharp(buffers.hero).extract({ left, top: 0, width: cw, height: meta.height }).resize({ height: 2000, withoutEnlargement: true }).webp({ quality: 80, effort: 6 }).toFile(`${IMG}/hero-m.webp`);
  await sharp(buffers.hero).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${IMG}/og.jpg`);
}

// 3. Иконки из favicon.svg
const svg = await readFile('src/assets/img/favicon.svg');
await sharp(svg, { density: 300 }).resize(32, 32).png().toFile(`${IMG}/favicon-32.png`);
await sharp(svg, { density: 600 }).resize(180, 180).png().toFile(`${IMG}/apple-touch-icon.png`);

// 4. Адрес сайта: подставляем SITE_URL вместо __SITE_URL__ в index.html, делаем robots.txt и sitemap.xml
{
  const html = (await readFile(`${OUT}/index.html`, 'utf8')).replaceAll('__SITE_URL__', SITE_URL);
  if (html.includes('__SITE_URL__')) throw new Error('В index.html остался __SITE_URL__');
  await writeFile(`${OUT}/index.html`, html);
  await writeFile(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  await writeFile(`${OUT}/sitemap.xml`,
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + `  <url><loc>${SITE_URL}/</loc></url>\n</urlset>\n`);
}

// 5. .htaccess для обычного хостинга на Apache (Timeweb). Шаблон — hosting/htaccess.
//    На Vercel не кладём: там он не нужен, заголовки задаёт vercel.json.
if (!process.env.VERCEL) await cp('hosting/htaccess', `${OUT}/.htaccess`);

console.log(`Первый экран: ${heroBuf ? 'локальный файл из hero/' : 'фото из Яндекса'}`);
console.log(`Готово: ${entries.length} фото, ${fontFiles.length * 2} файлов шрифтов → ${OUT}/ (адрес сайта: ${SITE_URL})`);
