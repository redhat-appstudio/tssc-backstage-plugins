#!/usr/bin/env node
"use strict";

import { readFile } from "node:fs/promises";
import {
  extractDependencyFromPackageName,
  findPackageJsonFiles,
} from "./shared";
import { PackageJson } from "./types";

function verifyVersions(pkg: PackageJson) {
  const dependency = extractDependencyFromPackageName(pkg.name);

  if (pkg?.dependencies?.[dependency] !== pkg.version) {
    throw new Error(
      `Version mismatch: expected version ${pkg.version} for ${dependency}`,
    );
  }
}

async function main() {
  const pluginsDir = "./plugins";
  // Find all package.json files in plugins dir
  const packageJsonFiles = findPackageJsonFiles(pluginsDir);
  console.log(
    `Found ${packageJsonFiles.length} package.json files in ${pluginsDir}`,
  );

  // Iterate and look for version mismatch
  for (const pkgPath of packageJsonFiles) {
    const data = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(data);

    console.log(`Verifying ${pkgPath}`);
    // Fail on mismatch
    verifyVersions(pkg);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

