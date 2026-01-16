#!/usr/bin/env node
"use strict";
/**
 * Update the 'package.json' file to the next release and backstage target.
 *
 * Usage:
 *   node update-package-json.js \
 *     --version 1.9 (TSSC Release version)
 *     --target 1.45 (backsage target (MAJOR.MINOR))
 */

const { readFile, writeFile } = require("node:fs/promises");
const { parseArgs, required } = require("./shared");

async function updateVersionFile(version, target) {
  const path = "package.json";

  const raw = await readFile(path, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: ${path} is not valid JSON`);
    process.exit(1);
  }

  json.version = version.trim();
  json.backstageTarget = target.trim();

  await writeFile(path, JSON.stringify(json, null, 2) + "\n", "utf8");

  console.log(`Updated ${path}. Release version: ${json.version}, Backstage target: ${json.backstageTarget}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = required("version", args.version);
  const target = required("target", args.target);
  updateVersionFile(version, target);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
