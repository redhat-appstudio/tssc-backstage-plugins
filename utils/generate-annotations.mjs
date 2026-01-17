#!/usr/bin/env node
"use strict";

/**
 *
 * This file is used by Konflux in an image of nodejs-20, offline.
 * Because of that, no dependencies can be installed, so tsc/tsx cannot be used.
 * This is kept as a plain .mjs file for now.
 *
 */

import path from "node:path";
import fs from "fs";

// Find all package.json files recursively
export function findPackageJsonFiles(
  dir,
  ignoreDirs = ["node_modules", ".git"],
) {
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
// Transform a single package.json
function transformPackageJson(inputJson) {
  if (!inputJson.name || !inputJson.version || !inputJson.backstage)
    return null;

  const dynamicKey = `${inputJson.name.replace("@", "").replace("/", "-")}-dynamic`;

  return {
    [dynamicKey]: {
      name: inputJson.name,
      version: inputJson.version,
      backstage: inputJson.backstage,
      homepage: inputJson.homepage || null,
      repository: inputJson.repository || null,
      license: inputJson.license || null,
      author: inputJson.author || null,
      bugs: inputJson.bugs || null,
      keywords: inputJson.keywords || [],
    },
  };
}

// Main function to process plugins directory
function main() {
  const pluginsDir = "./plugins";
  const outputFilePath = "./temp.json";

  try {
    // Find all package.json files in plugins dir
    const packageJsonFiles = findPackageJsonFiles(pluginsDir);
    console.log(
      `Found ${packageJsonFiles.length} package.json files in ${pluginsDir}`,
    );

    // Process each file and combine results
    const results = [];
    let processedCount = 0;

    for (const filePath of packageJsonFiles) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const packageJson = JSON.parse(content);
        const transformedObject = transformPackageJson(packageJson);

        if (transformedObject) {
          const key = Object.keys(transformedObject)[0];
          results.push({ [key]: transformedObject[key] });
          processedCount++;
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error processing ${filePath}: ${err?.message}`);
        }
        console.error("An unknown error occurred", err);
      }
    }

    // Write the combined result
    fs.writeFileSync(outputFilePath, JSON.stringify(results), "utf8");
    console.log(
      `Successfully processed ${processedCount} plugins and saved to ${outputFilePath}`,
    );

    // Base64 encode the contents, print it.
    const jsonContent = fs.readFileSync(outputFilePath);
    const hash = jsonContent.toString("base64");
    // Delete temp json file
    fs.unlinkSync(outputFilePath);
    fs.writeFileSync(
      "annotations.txt",
      `io.backstage.dynamic-packages=${hash}`,
    );
    // Output so it gets grabbed by next task.
    console.log(hash);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.log("An unknown error occurred", err);
    }
    process.exit(1);
  }
}
// Run the script
main();
