#!/usr/bin/env node
"use strict";
/**
 * Bump plugin package versions to match a specific Backstage minor release.
 *
 * Given a target like "1.46", this script finds the highest patch release
 * of that minor version (e.g., 1.46.3) in the upstream Backstage
 * community-plugins repo. It then updates local plugin package.json files
 * to match the plugin versions at that release.
 *
 * Usage:
 *   yarn tsx bump-plugins.ts \
 *     --target 1.46 \
 *     --debug (optional)
 *
 * --target  The Backstage minor version to align plugins with.
 *           The script resolves the latest patch (e.g., 1.46 -> 1.46.3).
 * --debug   Print additional info about resolved packages.
 */
import {
  extractDependencyFromPackageName,
  findPackageJsonFiles,
  updateDependencies,
  parseArgs,
  required,
} from "./shared";
import { getPluginPackagesForBackstageVersion } from "./get-plugin-versions-at-backstage-version";
import { CliArgs, PackageJson, Workspace } from "./types";
import fs from "node:fs";
import semver from "semver";

// Workspaces used to get updates.
const WORKSPACES: Workspace[] = [
  "tekton",
  "argocd",
  "quay",
  "multi-source-security-viewer",
];

// Get the pkg versions of the plugin and check if there is an update
async function lookForUpdate(pkg: PackageJson, version = "latest") {
  const dependency = extractDependencyFromPackageName(pkg.name);
  const lookup = await fetch(
    `https://registry.npmjs.org/${dependency}/${version}`,
  );

  if (!lookup.ok) {
    throw new Error(`HTTP response ${lookup.status}: ${lookup.statusText}`);
  }

  const latest: PackageJson = await lookup
    .json()
    .then((value) => value as PackageJson);
  const packageDeps = updateDependencies(pkg, dependency, latest);

  if (!packageDeps) {
    console.error(
      "Failed to retrieve package dependencies for the following package:",
      pkg,
    );
    return;
  }

  const { dependencies, devDependencies } = packageDeps;

  return {
    version: latest.version,
    dependencies: {
      [dependency]: latest.version,
      ...dependencies,
    },
    devDependencies,
  };
}

async function main() {
  const args: CliArgs = parseArgs(process.argv.slice(2)); //Ignore 'node <filename>'
  const target: string = required("target", args.target);
  const debugEnabled: boolean | undefined = args.debug;

  // Get all package updates at backstage version target
  const results = await Promise.all(
    WORKSPACES.map((w: Workspace) =>
      getPluginPackagesForBackstageVersion(w, target),
    ),
  );

  const packageUpdates = Object.assign({}, ...results);
  if (debugEnabled) {
    console.log("🔍 Debug info on packages with Backstage target", target);
    console.log(packageUpdates);
    console.log("\n");
  }

  const pluginsDir = "./plugins";
  // Find all package.json files in plugins dir
  const packageJsonFiles = findPackageJsonFiles(pluginsDir);
  console.log(
    `Found ${packageJsonFiles.length} package.json files in ${pluginsDir}`,
  );

  console.log("⏳ Starting plugin bumps\n");
  // Keep count of how many packages were updated.
  let updated = 0;
  // Look for pkg updates
  for (const pkgPath of packageJsonFiles) {
    const data = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(data);
    const dependency = extractDependencyFromPackageName(pkg.name);
    const foundPackage = packageUpdates[dependency];

    if (!foundPackage) {
      continue;
    }
    // Using the version that matches the backstage target
    // apply updates.
    const version = foundPackage.version;
    const update = await lookForUpdate(pkg, version);
    if (!update) {
      throw new Error("Failed to retrieve package updates");
    }

    if (semver.lt(pkg.version, update.version)) {
      console.log(
        `🚀 Updating ${pkg.name}: ${pkg.version} => ${update.version}`,
      );
      const newValues = { ...pkg, ...update };
      const jsonFileContent = JSON.stringify(newValues, null, 2);
      fs.writeFileSync(pkgPath, jsonFileContent + "\n", "utf8");
      updated += 1;
    }
  }

  if (!updated) {
    console.warn(
      "🤔 Nothing was updated, please ensure you used the correct target",
    );
  }

  console.log("\n🏁 Bump process completed");
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
