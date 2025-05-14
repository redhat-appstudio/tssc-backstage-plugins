#!/usr/bin/env node
"use strict";

const {
  extractDependencyFromPackageName,
  findPackageJsonFiles,
  updateDependencies,
} = require("./shared");
const fs = require("fs");
const semver = require("semver");

// Get the pkg versions of the plugin and check if there is an update
async function lookForUpdate(pkg) {
  const dependency = extractDependencyFromPackageName(pkg.name);
  const lookup = await fetch(`https://registry.npmjs.org/${dependency}/latest`);

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
  const pluginsDir = "./plugins";
  // Find all package.json files in plugins dir
  const packageJsonFiles = findPackageJsonFiles(pluginsDir);
  console.log(
    `Found ${packageJsonFiles.length} package.json files in ${pluginsDir}`,
  );

  // Iterate and look for pkg udpates
  for (const pkgPath of packageJsonFiles) {
    const data = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(data);
    const update = await lookForUpdate(pkg);

    if (semver.lt(pkg.version, update.version)) {
      console.log(`Updating ${pkg.name}: ${pkg.version} => ${update.version}`);
      const newValues = { ...pkg, ...update };
      const jsonFileContent = JSON.stringify(newValues, null, 2);
      fs.writeFileSync(pkgPath, jsonFileContent + "\n", "utf8");
    }
  }
}

main();
