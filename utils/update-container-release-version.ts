#!/usr/bin/env node
"use strict";
/**
 * Update the release metadata value in the Containerfile.
 *
 * Usage:
 *   yarn tsx update-container-release-version.ts \
 *     --version 1.9
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs, required } from "./shared";

const VERSION_REGEX = /version\=\".+\"/g;
const RELEASE_REGEX = /release\=\".+\"/g;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const versionArg = required("version", args.version);
  const [version, release] = versionArg.split(".");
  const path = "Containerfile";
  const raw = await readFile(path, "utf8");
  const updatedVersion = raw.replace(VERSION_REGEX, `version="${version}"`);
  const updatedRelease = updatedVersion.replace(
    RELEASE_REGEX,
    `release="${release}"`,
  );

  await writeFile(path, updatedRelease, "utf8");

  console.log(`Updated ${path} version -> ${versionArg}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
