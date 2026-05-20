// Генератор latest.json для Tauri auto-updater'а.
//
// Tauri-updater опрашивает endpoint (см. tauri.conf.json → updater.endpoints):
//   https://github.com/<owner>/<repo>/releases/latest/download/latest.json
//
// Файл должен содержать version + url installer'а + base64-signature
// (содержимое .sig файла Tauri-bundler'а). Updater сравнивает version с
// текущей, скачивает url, верифицирует signature через embedded
// minisign-pubkey, ставит NSIS-installer в `passive` mode.
//
// Usage:
//   node scripts/build-latest-json.mjs <version> <repo> [notes-file]
//
// Output: latest.json в src-tauri/target/release/bundle/nsis/

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , versionArg, repoArg, notesArg] = process.argv;
if (!versionArg || !repoArg) {
  console.error('Usage: node scripts/build-latest-json.mjs <version> <owner/repo> [notes-file]');
  console.error('Example: node scripts/build-latest-json.mjs 0.2.0-beta.10 MeinCain/ariy-vpn-desktop notes.md');
  process.exit(1);
}

// productName из tauri.conf.json — нужно для имени .exe (с пробелом)
const tauriConfPath = resolve('src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
const productName = tauriConf.productName ?? 'App';

// Bundler сохраняет под именем `<productName>_<version>_x64-setup.exe`,
// но в GitHub Release asset мы загружаем с подчёркиваниями (т.к. пробелы
// в URL ломают auto-updater HTTP fetch).
const bundleName = `${productName}_${versionArg}_x64-setup.exe`;
const bundleNameSafe = bundleName.replace(/\s+/g, '_');
const bundleDir = resolve('src-tauri/target/release/bundle/nsis');
const sigPath = resolve(bundleDir, `${bundleName}.sig`);

if (!existsSync(sigPath)) {
  console.error(`SIG file not found: ${sigPath}`);
  console.error('Run `npm run tauri:bundle` first to produce the installer + .sig.');
  process.exit(1);
}

const signature = readFileSync(sigPath, 'utf8').trim();

const notes = notesArg && existsSync(notesArg)
  ? readFileSync(notesArg, 'utf8').trim()
  : `See https://github.com/${repoArg}/releases/tag/v${versionArg}`;

const downloadUrl = `https://github.com/${repoArg}/releases/download/v${versionArg}/${bundleNameSafe}`;

const latest = {
  version: versionArg,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: downloadUrl,
    },
  },
};

const outPath = resolve(bundleDir, 'latest.json');
writeFileSync(outPath, JSON.stringify(latest, null, 2), 'utf8');
console.log(`OK: wrote ${outPath}`);
console.log(`  version:   ${latest.version}`);
console.log(`  url:       ${downloadUrl}`);
console.log(`  signature: ${signature.slice(0, 40)}...`);
