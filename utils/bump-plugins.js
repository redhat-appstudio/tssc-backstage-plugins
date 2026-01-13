#!/usr/bin/env node
"use strict";
/**
 * Find npm package versions for all plugin packages under a workspace's /plugins
 * directory, at the commit where backstage.json has the requested "version".
 *
 * Use that to update the related package versions in this directory
 *
 * Usage:
 *   node bump-plugins.js \
 *     --target 1.46.0 \
 *     --ref main (optional)
 *
 */
const {
  extractDependencyFromPackageName,
  findPackageJsonFiles,
  updateDependencies,
  parseArgs,
  required,
} = require("./shared");
const {
  getPluginPackagesForBackstageVersion,
} = require("./get-plugin-versions-at-backstage-version");
const fs = require("fs");
const semver = require("semver");

// Workspaces used to get updates.
const WORKSPACES = ["tekton", "argocd", "quay", "multi-source-security-viewer"];

// Get the pkg versions of the plugin and check if there is an update
async function lookForUpdate(pkg, version = "latest") {
  const dependency = extractDependencyFromPackageName(pkg.name);
  const lookup = await fetch(
    `https://registry.npmjs.org/${dependency}/${version}`,
  );

  if (!lookup.ok) {
    throw new Error(`HTTP response ${lookup.status}: ${lookup.statusText}`);
  }

  const latest = await lookup.json().then((value) => value);
  const { dependencies, devDependencies } = updateDependencies(
    pkg,
    dependency,
    latest,
  );

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
  const args = parseArgs(process.argv.slice(2)); //Ignore 'node <filename>'
  const target = required("target", args.target);
  const ref = args.ref || "main";

  // Get all package updates at backstage version target
  const results = await Promise.all(
    WORKSPACES.map((w) => getPluginPackagesForBackstageVersion(w, target, ref)),
  );

  const packageUpdates = Object.assign({}, ...results);

  const pluginsDir = "./plugins";
  // Find all package.json files in plugins dir
  const packageJsonFiles = findPackageJsonFiles(pluginsDir);
  console.log(
    `Found ${packageJsonFiles.length} package.json files in ${pluginsDir}`,
  );

  const updated = [];
  // Iterate and look for pkg udpates
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

    if (semver.lt(pkg.version, update.version)) {
      console.log(`Updating ${pkg.name}: ${pkg.version} => ${update.version}`);
      const newValues = { ...pkg, ...update };
      const jsonFileContent = JSON.stringify(newValues, null, 2);
      fs.writeFileSync(pkgPath, jsonFileContent + "\n", "utf8");

      // Used for final summary data.
      updated.push(pkg.name);
    }
  }
  console.log("🚀 Package bump process finished");

  console.log(
    `The following packages were bumped: ${updated.length ? updated : "no updates"}`,
  );
  console.log("👋 Bye!");
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
