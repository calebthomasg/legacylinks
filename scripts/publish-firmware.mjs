// Prepares files locally; deployment follows the normal reviewed Git workflow.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
export function validateVersion(value) {
  return /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/.test(value);
}
export function makeRelease(version, bytes, notes) {
  if (!validateVersion(version)) throw new Error('Version must be major.minor.patch');
  if (bytes.length < 32 || bytes.length > 4194304 || bytes[0] !== 0xe9 || bytes.readUInt16LE(12) !== 9) throw new Error('Expected ESP32-S3 app image, up to 4 MB');
  if (!notes || Buffer.byteLength(notes) > 160) throw new Error('Release notes must be 1-160 UTF-8 bytes');
  return {version, hardware:'waveshare-esp32s3-touch-lcd-2.8c', layout:'trailhead-16m-ota4m-v1',
    url:`https://www.legacylinks.io/firmware/trailhead/releases/${version}/trailhead-${version}-app.bin`,
    size:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex'), notes};
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [channel, version, file, notes] = process.argv.slice(2);
  if (!['test', 'stable'].includes(channel)) throw new Error('Usage: node scripts/publish-firmware.mjs test|stable VERSION APP.bin "release notes"');
  const bytes=readFileSync(file), release=makeRelease(version,bytes,notes);
  const root=resolve('public/firmware/trailhead');
  const target=resolve(root,`releases/${version}/trailhead-${version}-app.bin`);
  if(existsSync(target) && !readFileSync(target).equals(bytes)) throw new Error('Published version is immutable. Increment version.');
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
  writeFileSync(resolve(root,`${channel}.json`),JSON.stringify({schema:1,channel,release},null,2)+'\n');
  console.log(`Prepared ${channel} v${version}; ${release.size} bytes; SHA256 ${release.sha256}`);
}
