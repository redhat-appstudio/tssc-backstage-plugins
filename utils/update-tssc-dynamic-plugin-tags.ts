#!/usr/bin/env node
"use strict";
/**
 * Update the dynamic-plugins.yaml file for a release
 *
 * Usage:
 *   yarn tsx utils/update-tssc-dynamic-plugin-tags.ts [--image <value>]
 *
 * Options:
 *   --image <value>    Full OCI image reference (e.g. quay.io/org/namespace/repo:tag).
 *                      Replaces <image> placeholders in TSSC plugin lines.
 *
 * This script:
 * 1. Reads the version from the root package.json
 * 2. Finds the dynamic-plugins.yaml file
 * 3. Updates any 'release-x.y' values to match the current version
 * 4. Optionally updates <image> placeholders if --image flag is provided
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const DYNAMIC_PLUGINS_PATH =
  "development/configuration/rhdh/dynamic-plugins.yaml";
const PACKAGE_JSON_PATH = "package.json";

// Matches release-x.y patterns (literal x.y or numeric like release-1.8, release-2.0)
const RELEASE_VERSION_REGEX = /release-(?:x\.y|\d+\.\d+)/g;
const IMAGE_REGEX = /<image>/g;

async function getLatestVersion(): Promise<string> {
  const packageJsonPath = path.resolve(PACKAGE_JSON_PATH);
  const content = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(content);

  if (!packageJson.version) {
    throw new Error("No version field found in package.json");
  }

  return packageJson.version;
}

function parseCliArgs(): {
  image?: string;
} {
  const { values } = parseArgs({
    options: {
      image: {
        type: "string",
        short: "i",
      },
    },
    strict: true,
  });
  return values;
}

async function main(): Promise<void> {
  const args = parseCliArgs();

  const version = await getLatestVersion();
  console.log(`Found version ${version} in package.json`);
  const dynamicPluginsPath = path.resolve(DYNAMIC_PLUGINS_PATH);
  const content = await readFile(dynamicPluginsPath, "utf8");

  const releaseVersion = `release-${version}`;
  let updatedContent = content.replace(RELEASE_VERSION_REGEX, releaseVersion);

  if (content === updatedContent) {
    console.log(
      "No release-x.y patterns found to update in dynamic-plugins.yaml",
    );
  } else {
    console.log(
      `Updated dynamic-plugins.yaml with version: ${releaseVersion}`,
    );
  }

  if (args.image) {
    const imageUpdated = updatedContent.replace(IMAGE_REGEX, args.image);
    if (updatedContent === imageUpdated) {
      console.log(
        "No <image> placeholders found to update in dynamic-plugins.yaml",
      );
    } else {
      console.log(`Updated dynamic-plugins.yaml with image: ${args.image}`);
      updatedContent = imageUpdated;
    }
  }

  if (content !== updatedContent) {
    await writeFile(dynamicPluginsPath, updatedContent, "utf8");
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
