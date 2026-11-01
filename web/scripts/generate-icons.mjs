import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The component imports this exact SVG; all installed-app assets derive from it.
const source = await readFile(new URL('../src/assets/nightseek.svg', import.meta.url), 'utf8');
const background = source.match(/<rect\b[^>]*fill="(#[\da-f]{6})"/i)?.[1];
if (!background) throw new Error('The master SVG must define its opaque background rectangle.');
const inner = source.replace(/<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
// Keep the entire foreground inside the maskable icon's central 80% safe circle.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${background}"/><g transform="translate(11 11) scale(.78)">${inner}</g></svg>\n`;
const check = process.argv.includes('--check');
let stale = false;

async function output(relative, buffer) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  if (check) {
    const existing = await readFile(path).catch(() => null);
    // PNG encoding and subpixel rounding can differ between renderer platforms.
    let equal = existing?.equals(buffer) ?? false;
    if (!equal && existing && relative.endsWith('.png')) {
      const a = await sharp(existing).raw().toBuffer({ resolveWithObject: true });
      const b = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
      equal =
        JSON.stringify(a.info) === JSON.stringify(b.info) &&
        a.data.every((value, index) => Math.abs(value - b.data[index]) <= 2);
    }
    if (!equal) {
      process.stderr.write(`Stale icon: ${relative}. Run pnpm icons:generate in web/.\n`);
      stale = true;
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }
}

await output('../public/favicon.svg', Buffer.from(source));
await output('../public/icons/maskable.svg', Buffer.from(maskable));
for (const [path, size, svg] of [
  ['../public/icons/icon-192.png', 192, source],
  ['../public/icons/icon-512.png', 512, source],
  ['../public/icons/apple-touch-icon.png', 180, source],
  ['../public/icons/maskable-192.png', 192, maskable],
  ['../public/icons/maskable-512.png', 512, maskable],
  ['../../mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, source],
]) {
  const png = await sharp(Buffer.from(svg), { density: 768 })
    .resize(size, size)
    .flatten({ background })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  await output(path, png);
}
// The launch storyboard uses aspect-fill; keep the mark centred and compact.
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="${background}"/><g transform="translate(1186 1186) scale(3.6)">${inner}</g></svg>`;
const splash = await sharp(Buffer.from(splashSvg))
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();
for (const suffix of ['', '-1', '-2']) {
  await output(
    `../../mobile/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${suffix}.png`,
    splash
  );
}
if (stale) process.exitCode = 1;
else
  process.stdout.write(
    `${check ? 'All icons match the master SVG.' : 'Generated web and iOS icons from the master SVG.'}\n`
  );
