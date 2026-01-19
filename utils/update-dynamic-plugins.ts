#!/usr/bin/env node
"use strict";
/**
 * Update the dynamic-plugins.yaml file for a release
 *
 * Usage:
 *   yarn tsx utils/update-dynamic-plugins.ts [--registry <value>] [--username <value>] [--repository <value>]
 *
 * Options:
 *   --registry <value>    Replace <registry> placeholders with the given value
 *   --username <value>    Replace <username> placeholders with the given value
 *   --repository <value>  Replace <repository> placeholders with the given value
 *
 * This script:
 * 1. Reads the version from the root package.json
 * 2. Finds the dynamic-plugins.yaml file
 * 3. Updates any 'release-x.y' values to match the current version
 * 4. Optionally updates <registry> placeholders if --registry flag is provided
 * 5. Optionally updates <username> placeholders if --username flag is provided
 * 6. Optionally updates <repository> placeholders if --repository flag is provided
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

type OptionalFlag = "registry" | "username" | "repository";

const DYNAMIC_PLUGINS_PATH =
  "development/configuration/rhdh/dynamic-plugins.yaml";
const PACKAGE_JSON_PATH = "package.json";

// Matches release-x.y patterns (literal x.y or numeric like release-1.8, release-2.0)
const RELEASE_VERSION_REGEX = /release-(?:x\.y|\d+\.\d+)/g;
const REGEX = {
  // Matches <registry> placeholder
  registry: /<registry>/g,
  // Matches <username> placeholder
  username: /<username>/g,
  // Matches <repository> placeholder
  repository: /<repository>/g,
};

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
  registry?: string;
  username?: string;
  repository?: string;
} {
  const { values } = parseArgs({
    options: {
      registry: {
        type: "string",
        short: "r",
      },
      username: {
        type: "string",
        short: "u",
      },
      repository: {
        type: "string",
        short: "p",
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
  const updatedContent = content.replace(RELEASE_VERSION_REGEX, releaseVersion);

  if (content === updatedContent) {
    console.log(
      "No release-x.y patterns found to update in dynamic-plugins.yaml",
    );
    return;
  }

  await writeFile(dynamicPluginsPath, updatedContent, "utf8");
  console.log(`Updated dynamic-plugins.yaml with version: ${releaseVersion}`);

  const finalUpdates = Object.keys(args).reduce((content, option: string) => {
    const replacement = args[option as OptionalFlag];
    const contentUpdate = content.replace(
      REGEX[option as OptionalFlag],
      replacement as string,
    );
    if (content === contentUpdate) {
      console.log(
        `No <${option}> placeholders found to update in dynamic-plugins.yaml`,
      );
      return content;
    }
    console.log(`Updated dynamic-plugins.yaml with ${option}: ${replacement}`);
    return contentUpdate;
  }, updatedContent);

  await writeFile(dynamicPluginsPath, finalUpdates, "utf8");
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
