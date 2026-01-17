#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import {
  PackageJson,
  CliArgs,
  DependencyMap,
  STRING_FLAGS,
  BOOLEAN_FLAGS,
  ALLOWED_FLAGS,
} from "./types";

// Find all package.json files recursively
export function findPackageJsonFiles(
  dir: string,
  ignoreDirs = ["node_modules", ".git"],
): string[] {
  let results: string[] = [];
  const items: string[] = fs.readdirSync(dir);

  for (const item of items) {
    if (ignoreDirs.includes(item)) continue;

    const itemPath: string = path.join(dir, item);
    const stat: fs.Stats = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      results = results.concat(findPackageJsonFiles(itemPath, ignoreDirs));
    } else if (stat.isFile() && item === "package.json") {
      results.push(itemPath);
    }
  }

  return results;
}

export function extractDependencyFromPackageName(name: string): string {
  return name.replace(/@tssc-plugins|backstage-community-/g, (substring) => {
    return substring === "@tssc-plugins" ? "@backstage-community" : "";
  });
}

export function updateDependencies(
  pkg: PackageJson,
  upstreamDependency: string,
  latest: PackageJson,
): Pick<PackageJson, "dependencies" | "devDependencies"> | null {
  const initialDeps: DependencyMap = {};

  const dependencies = Object.keys(pkg.dependencies || {}).reduce(
    (acc, key) => {
      acc[key] =
        key === upstreamDependency ? latest.version : pkg!.dependencies[key];
      return acc;
    },
    initialDeps,
  );

  const initialDevDeps: DependencyMap = {};
  const devDependencies = Object.keys(pkg?.devDependencies || {}).reduce(
    (acc, key) => {
      acc[key] =
        key in latest.devDependencies
          ? latest.devDependencies[key]
          : pkg.devDependencies[key];
      return acc;
    },
    initialDevDeps,
  );

  return { dependencies, devDependencies };
}

// Check if a required arg was passed correctly.
export function required(name: string, value: unknown): string {
  if (!value || typeof value !== "string") {
    console.error(`Missing required --${name}`);
    process.exit(1);
  }
  return value;
}

/**
 * Parses the arguments passed through the CLI
 */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    version: "",
    debug: false,
  };
  // Loop through args
  for (let i = 0; i < argv.length; i++) {
    // Grab the current argument value
    const a: string = argv[i];
    if (!a.startsWith("--")) continue;

    const rawKey: string = a.slice(2);

    // Only allow known keys
    if (!ALLOWED_FLAGS.has(rawKey)) continue;
    const key = rawKey as keyof CliArgs;
    const next: string = argv[i + 1];

    // Boolean flag: --debug (or --somethingElse)
    if (BOOLEAN_FLAGS.has(key)) {
      args.debug = true;
      continue;
    }

    // --version 1.9 / --target 1.45
    if (STRING_FLAGS.has(key) && next && !next.startsWith("--")) {
      if (rawKey === "version") args.version = next;
      if (rawKey === "target") args.target = next;
      // Increment so next flag is used
      i++;
    }
  }
  return args;
}
