#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// Find all package.json files recursively
function findPackageJsonFiles(dir, ignoreDirs = ["node_modules", ".git"]) {
  let results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    if (ignoreDirs.includes(item)) continue;

    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      results = results.concat(findPackageJsonFiles(itemPath, ignoreDirs));
    } else if (stat.isFile() && item === "package.json") {
      results.push(itemPath);
    }
  }

  return results;
}

function extractDependencyFromPackageName(name) {
  return name.replace(/@tssc-plugins|backstage-community-/g, (match) => {
    if (match === "@tssc-plugins") return "@backstage-community";
    if (match === "backstage-community-") return "";
  });
}

function updateDependencies(pkg, upstreamDependency, latest) {
  const dependencies = Object.keys(pkg?.dependencies || {}).reduce(
    (acc, key) => {
      acc[key] =
        key === upstreamDependency ? latest.version : pkg.dependencies[key];
      return acc;
    },
    {},
  );

  const devDependencies = Object.keys(pkg?.devDependencies || {}).reduce(
    (acc, key) => {
      acc[key] =
        key in latest.devDependencies
          ? latest.devDependencies[key]
          : pkg.devDependencies[key];
      return acc;
    },
    {},
  );

  return { dependencies, devDependencies };
}

module.exports = {
  findPackageJsonFiles,
  extractDependencyFromPackageName,
  updateDependencies,
};
