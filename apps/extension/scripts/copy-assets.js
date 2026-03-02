import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist');
const root = resolve(__dirname, '..');

// Copy manifest.json
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

// Copy icons from public/
for (const icon of ['icon-16.png', 'icon-48.png', 'icon-128.png']) {
  const src = resolve(root, 'public', icon);
  if (existsSync(src)) {
    copyFileSync(src, resolve(dist, icon));
  }
}

// Move popup HTML from nested path to root of dist, fixing asset paths
const nestedPopup = resolve(dist, 'src/popup/index.html');
if (existsSync(nestedPopup)) {
  let html = readFileSync(nestedPopup, 'utf-8');
  // Fix paths: ../../popup.js -> ./popup.js
  html = html.replace(/src="\.\.\/\.\.\//g, 'src="./');
  html = html.replace(/href="\.\.\/\.\.\//g, 'href="./');
  writeFileSync(resolve(dist, 'popup.html'), html);
}

console.log('Assets copied to dist/');
