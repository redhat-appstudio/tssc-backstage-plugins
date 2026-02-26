#!/usr/bin/env node
"use strict";
/**
 * Update dynamic-plugins.yaml to replace `<tag>` placeholders with resolved GHCR OCI artifact tags.
 *
 * Scans plugin entries where `package:` starts with the OCI base URL and ends with `:<tag>`,
 * then replaces `<tag>` with the latest tag from GHCR.
 *
 * Entries containing `tssc-plugins` or already-resolved tags are never modified.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx yarn tsx utils/update-rhdh-dynamic-plugin-tags.ts [options]
 *
 * Options:
 *   --file <path>   Path to dynamic-plugins.yaml (default: development/configuration/rhdh/dynamic-plugins.yaml)
 *   --dry-run       Print changes without writing the file
 *   --check         CI mode: exit non-zero if changes would be made
 *   --verbose       Enable verbose logging
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { Octokit } from "@octokit/rest";
import { Document, parseDocument } from "yaml";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FILE = "development/configuration/rhdh/dynamic-plugins.yaml";
const OCI_BASE = "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays";
const TAG_PLACEHOLDER = "<tag>";
const GITHUB_ORG = "redhat-developer";
const PACKAGE_NAMESPACE = "rhdh-plugin-export-overlays";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  file: string;
  dryRun: boolean;
  check: boolean;
  verbose: boolean;
}

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      file: { type: "string", short: "f", default: DEFAULT_FILE },
      "dry-run": { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      verbose: { type: "boolean", short: "v", default: false },
    },
    strict: true,
  });

  return {
    file: values.file as string,
    dryRun: values["dry-run"] as boolean,
    check: values.check as boolean,
    verbose: values.verbose as boolean,
  };
}

// ---------------------------------------------------------------------------
// Image name extraction from OCI URL
// ---------------------------------------------------------------------------

/**
 * Extracts the image name from an OCI URL that ends with `:<tag>`.
 * E.g. `oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/my-plugin:<tag>`
 * returns `my-plugin`.
 */
export function extractImageName(packageValue: string): string {
  const suffix = `:${TAG_PLACEHOLDER}`;
  const withoutTag = packageValue.slice(0, -suffix.length);
  const lastSlash = withoutTag.lastIndexOf("/");
  return withoutTag.slice(lastSlash + 1);
}

// ---------------------------------------------------------------------------
// GitHub API: resolve latest tag for a container package
// ---------------------------------------------------------------------------

interface ResolvedTag {
  tag: string;
  createdAt: string;
}

async function resolveLatestTag(
  octokit: Octokit,
  imageName: string,
  verbose: boolean,
): Promise<ResolvedTag> {
  const packageName = `${PACKAGE_NAMESPACE}/${imageName}`;

  if (verbose) {
    console.log(`  Fetching versions for container package: ${packageName}`);
  }

  const { data: versions } =
    await octokit.packages.getAllPackageVersionsForPackageOwnedByOrg({
      package_type: "container",
      package_name: packageName,
      org: GITHUB_ORG,
      per_page: 100,
    });

  if (!versions || versions.length === 0) {
    throw new Error(`No versions found for package ${packageName}`);
  }

  // Filter to versions that have at least one tag starting with "bs_",
  // then sort by created_at descending to find the most recent.
  const sorted = versions
    .filter(
      (v) =>
        v.metadata?.container?.tags &&
        v.metadata.container.tags.some((t: string) => t.startsWith("bs_")),
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  if (sorted.length === 0) {
    throw new Error(
      `No versions with a bs_ tag found for package ${packageName}.`,
    );
  }

  const latest = sorted[0];
  const tag = latest.metadata!.container!.tags!.find((t: string) =>
    t.startsWith("bs_"),
  )!;

  if (verbose) {
    console.log(
      `  Resolved ${packageName} → tag: ${tag} (created: ${latest.created_at})`,
    );
  }

  return { tag, createdAt: latest.created_at };
}

// ---------------------------------------------------------------------------
// YAML processing
// ---------------------------------------------------------------------------

interface UpdateResult {
  imageName: string;
  tag: string;
  oldValue: string;
  newValue: string;
}

/**
 * Determines whether a package value should be updated.
 * Only entries that start with the OCI base URL and end with `:<tag>` are eligible.
 */
export function shouldUpdate(packageValue: string): boolean {
  if (!packageValue.startsWith(OCI_BASE)) return false;
  if (!packageValue.endsWith(`:${TAG_PLACEHOLDER}`)) return false;
  return true;
}

async function processPlugins(
  doc: Document,
  octokit: Octokit,
  verbose: boolean,
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  const tagCache = new Map<string, string>();

  // Navigate to plugins array
  const pluginsNode = doc.get("plugins", true);
  if (!pluginsNode || !(pluginsNode as any).items) {
    console.log("No plugins array found in YAML document.");
    return results;
  }

  const items = (pluginsNode as any).items;

  for (const item of items) {
    // Each item is a YAMLMap; find the 'package' key
    const packagePair = item.items?.find(
      (pair: any) => pair.key?.value === "package",
    );
    if (!packagePair) continue;

    const oldValue: string = packagePair.value?.value;
    if (!oldValue || !shouldUpdate(oldValue)) continue;

    // Extract image name from the OCI URL
    const imageName = extractImageName(oldValue);

    // Resolve tag (with caching)
    let tag = tagCache.get(imageName);
    if (!tag) {
      const resolved = await resolveLatestTag(octokit, imageName, verbose);
      tag = resolved.tag;
      tagCache.set(imageName, tag);
    }

    const newValue = oldValue.replace(TAG_PLACEHOLDER, tag);

    // Update the scalar value in-place (preserves comments/formatting)
    packagePair.value.value = newValue;

    results.push({ imageName, tag, oldValue, newValue });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function printSummary(results: UpdateResult[]): void {
  if (results.length === 0) {
    console.log("No plugins with <tag> placeholder found to update.");
    return;
  }

  console.log(`\n${results.length} plugin(s) would be updated:\n`);
  for (const r of results) {
    console.log(`  ${r.imageName}`);
    console.log(`    - ${r.oldValue}`);
    console.log(`    + ${r.newValue}`);
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseCliArgs();

  // Validate GitHub token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Error: GITHUB_TOKEN environment variable is required.");
    console.error(
      "Create a token at https://github.com/settings/tokens with read:packages scope.",
    );
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  // Read YAML file
  const filePath = path.resolve(opts.file);
  if (opts.verbose) {
    console.log(`Reading ${filePath}`);
  }

  const originalContent = await readFile(filePath, "utf8");
  const doc = parseDocument(originalContent, { keepSourceTokens: true });

  // Process plugins
  const results = await processPlugins(doc, octokit, opts.verbose);

  if (results.length === 0) {
    console.log("No changes needed.");
    process.exit(0);
  }

  const updatedContent = doc.toString();

  // --dry-run: print summary and diff, no write
  if (opts.dryRun) {
    printSummary(results);
    console.log("Dry run — no file was modified.");
    process.exit(0);
  }

  // --check: CI mode, exit non-zero if changes detected
  if (opts.check) {
    printSummary(results);
    console.error(
      "Check failed: dynamic-plugins.yaml has <tag> placeholders that need updating.",
    );
    process.exit(1);
  }

  // Write updated file
  await writeFile(filePath, updatedContent, "utf8");
  printSummary(results);
  console.log(`Updated ${filePath}`);
}

// Only run main() when executed directly (not when imported for testing)
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("update-rhdh-dynamic-plugin-tags.ts") ||
    process.argv[1].endsWith("update-rhdh-dynamic-plugin-tags.js"));

if (isDirectRun) {
  main().catch((e) => {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  });
}
