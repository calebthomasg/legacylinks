// Rasterize existing brand vectors for email clients that do not display SVG.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const root = path.join(__dirname, '..');
  const output = path.join(root, 'public/images/email');
  await fs.mkdir(output, { recursive: true });
  await sharp(path.join(root, 'public/images/ll-logo.svg')).resize({ width: 456 }).png().toFile(path.join(output, 'brand-logo-v1.png'));
  const ranger = Buffer.from(await fs.readFile(path.join(root, 'public/images/ranger-rowan.svg'))).toString('base64');
  for (const [kind, height, fill] of [['signup', 344, '#eef8f1'], ['find', 286, '#fff6d9']]) {
    const circle = height - 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${height}"><circle cx="210" cy="${height / 2 + 10}" r="${circle / 2}" fill="${fill}"/><circle cx="366" cy="70" r="14" fill="#ffc83d"/><circle cx="48" cy="${height - 30}" r="7" fill="#14b8a6"/><image href="data:image/svg+xml;base64,${ranger}" x="56" y="4" width="308" height="${height - 8}"/></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(output, `ranger-${kind}-v1.png`));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
