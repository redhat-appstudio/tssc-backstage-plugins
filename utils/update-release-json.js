#!/usr/bin/env node
"use strict";
/**
 * Update the 'release.json' file to the next release
 *
 * Usage:
 *   node update-release-json.js \
 *     --version 1.9
 */

const { readFile, writeFile } = require("node:fs/promises");
const { parseArgs, required } = require("./shared");

async function updateVersionFile(version) {
  const path = "release.json";

  const raw = await readFile(path, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: ${path} is not valid JSON`);
    process.exit(1);
  }

  json.version = version.trim();

  await writeFile(path, JSON.stringify(json, null, 2) + "\n", "utf8");

  console.log(`Updated ${path} version -> ${json.version}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = required("version", args.version);
  updateVersionFile(version);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
