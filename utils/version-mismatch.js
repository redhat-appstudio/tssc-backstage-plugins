#!/usr/bin/env node
"use strict";

const findPackageJsonFiles = require("./shared").findPackageJsonFiles;
const fs = require("fs");

function verifyVersions(pkg) {
  const name = pkg.name;
  const dependency = name.replace(
    /@rhtap-plugins|backstage-community-/g,
    (match) => {
      if (match === "@rhtap-plugins") return "@backstage-community";
      if (match === "backstage-community-") return "";
    },
  );

  if (pkg.dependencies[dependency] !== pkg.version) {
    throw new Error(
      `Version mismatch: expected version ${pkg.version} for ${dependency}`,
    );
  }
}

function main() {
  const pluginsDir = "./plugins";
  // Find all package.json files in plugins dir
  const packageJsonFiles = findPackageJsonFiles(pluginsDir);
  console.log(
    `Found ${packageJsonFiles.length} package.json files in ${pluginsDir}`,
  );

  // Iterate and look for version mismatch
  for (const pkgPath of packageJsonFiles) {
    const data = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(data);

    console.log(`Verifying ${pkgPath}`);
    // Fail on mismatch
    verifyVersions(pkg);
  }
}

main();
