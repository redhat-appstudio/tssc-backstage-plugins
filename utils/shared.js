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

// Check if a required arg was passed correctly.
function required(name, value) {
  if (!value || typeof value !== "string") {
    console.error(`Missing required --${name}`);
    process.exit(1);
  }
  return value;
}

/**
  * Parses the arguments passed through the CLI
  */
function parseArgs(argv) {
  const args = {};
  // Loop through args
  for (let i = 0; i < argv.length; i++) {
    // Grab the current argument value
    const a = argv[i];
    // Identify args with --
    if (a.startsWith("--")) {
      // Get key, anything after '--'
      const key = a.slice(2);
      // Get next arg, should be value
      // example: key: target, value: 1.46.0
      const val = argv[i + 1];
      // If there is no value after the initial key
      // for example '--json'
      // This means we want the option set.
      if (!val || val.startsWith("--")) {
        args[key] = true;
      }
      else {
        // Assign arg to val passed.
        args[key] = val;
        // Increment to go to next set of args.
        i++;
      }
    }
  }
  return args;
}

module.exports = {
  findPackageJsonFiles,
  extractDependencyFromPackageName,
  updateDependencies,
  parseArgs,
  required,
};
