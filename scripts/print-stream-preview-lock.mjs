import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const lockfile = gzipSync(readFileSync("package-lock.json")).toString("base64");
const chunks = lockfile.match(/.{1,950}/g);
console.log("STREAM-LOCK-COUNT " + chunks.length);
chunks.forEach((chunk, index) => console.log("STREAM-LOCK " + index + " " + chunk));
