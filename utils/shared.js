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

module.exports = {
  findPackageJsonFiles,
};
