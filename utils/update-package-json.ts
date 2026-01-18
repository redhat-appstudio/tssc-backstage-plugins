#!/usr/bin/env node
"use strict";
/**
 * Update the 'package.json' file to the next release and backstage target.
 *
 * Usage:
 *   yarn tsx update-package-json.ts \
 *     --version 1.9 (TSSC Release version)
 *     --target 1.45 (backsage target (MAJOR.MINOR))
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs, required } from "./shared";

async function updateVersionFile(version: string, target: string) {
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

  console.log(
    `Updated ${path}. Release version: ${json.version}, Backstage target: ${json.backstageTarget}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = required("version", args.version);
  const target = required("target", args.target);
  await updateVersionFile(version, target).then(() =>
    console.log("Process completed"),
  );
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
