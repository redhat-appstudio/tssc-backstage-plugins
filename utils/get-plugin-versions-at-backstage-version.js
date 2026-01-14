#!/usr/bin/env node
"use strict";

const path = require("node:path");

// Formats request headers for Github
function ghHeaders() {
  //
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tssc-backstage-workspace-npm-version-finder",
  };
  // Use passed GITHUB_TOKEN if available.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// Function that sends fetch requests to Github with:
// - custom GitHub media type: application/vnd.github+json
// - a valid User-Agent header (or else we get 403)
// - optional: Authorization header using Github Token
async function ghJson(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GitHub API error ${res.status} ${res.statusText}: ${text}`,
    );
  }
  return res.json();
}

// Fetch raw file content from GitHub using:
// - specified owner and repo
// - commit SHA or ref
// - path to file
async function fetchRawJson(owner, repo, shaOrRef, filePath) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${shaOrRef}/${filePath}`;
  const res = await fetch(rawUrl);
  if (!res.ok) {
    return null;
  }
  const text = await res.text();
  try {
    return { rawUrl, json: JSON.parse(text) };
  } catch {
    return null;
  }
}

async function findCommitWhereBackstageVersionMatches({
  owner,
  repo,
  ref,
  backstageJsonPath,
  target,
}) {
  // Fast check at ref passed or default: 'main'
  const current = await fetchRawJson(owner, repo, ref, backstageJsonPath);
  if (!current) {
    console.error(`Could not fetch/parse ${backstageJsonPath} at ref "${ref}"`);
  }

  // Check if we already found the version we want.
  const currentVersion = String(current.json?.version);
  if (currentVersion === target) {
    return {
      sha: ref,
      info: { date: null, msg: null },
      rawUrl: current.rawUrl,
    };
  }

  // Walk commit history for that file
  let page = 1;
  const perPage = 100;
  // In the event we do not find our target version
  // collect the versions we did find.
  const versionsFound = {};

  while (true) {
    // Grab all commits related to backstage.json file.
    // Grab 100 commits at at time and paginate.
    const commitsUrl =
      `https://api.github.com/repos/${owner}/${repo}/commits` +
      `?sha=${encodeURIComponent(ref)}` +
      `&path=${encodeURIComponent(backstageJsonPath)}` +
      `&per_page=${perPage}` +
      `&page=${page}`;

    const commits = await ghJson(commitsUrl);

    // Reached the end, no target found.
    if (!Array.isArray(commits) || commits.length === 0) {
      // Log the targets we did find.
      const debugJson = { [backstageJsonPath]: versionsFound };
      console.log("\n");
      console.warn(
        `🚨 No commit found where ${backstageJsonPath} has version=${target}`,
      );
      console.debug("🕵️ Logging what was found:");
      console.debug(debugJson);
      console.debug("\n");
      return null;
    }

    for (const c of commits) {
      // Grab commit SHA
      const sha = c.sha;
      // Grab backstage.json file at that commit SHA
      const fileAtCommit = await fetchRawJson(
        owner,
        repo,
        sha,
        backstageJsonPath,
      );
      // No file? Skip.
      if (!fileAtCommit) continue;

      // Extract version from file, return data.
      const v = String(fileAtCommit.json?.version);

      // Collect version found for debug logs.
      versionsFound[v] = {
        commitSha: sha,
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${backstageJsonPath}`,
      };

      // We found a version that matches or Backstage target
      if (v === target) {
        const date =
          c.commit?.committer?.date ?? c.commit?.author?.date ?? null;
        const msg = c.commit?.message?.split("\n")[0] ?? null;
        return { sha, info: { date, msg }, rawUrl: fileAtCommit.rawUrl };
      }
    }
    // Next page
    page++;
  }
}

/**
 * Gets the repository contents at the specified directory and commit ref
 */
async function listRepoContents({ owner, repo, dirPath, ref }) {
  // GET /repos/{owner}/{repo}/contents/{path}?ref=
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
    dirPath,
  )}?ref=${encodeURIComponent(ref)}`;
  const data = await ghJson(url);

  if (!Array.isArray(data)) {
    // Could be a file or error; treat as empty
    return [];
  }
  return data; // entries: { type: "file"|"dir", name, path, ... }
}

async function collectPluginPackageJsons({
  owner,
  repo,
  ref,
  startDir,
  backstageJsonPath,
}) {
  let result = {};

  // Grab all the stuff under the specified repo at the specified SHA.
  const entries = await listRepoContents({
    owner,
    repo,
    dirPath: startDir,
    ref,
  });

  for (const e of entries) {
    if (e.type !== "dir") {
      // most likely README.md file.
      continue;
    }

    // Get package.json file in that plugin directory
    const pkgPath = path.posix.join(e.path, "package.json");
    const pkg = await fetchRawJson(owner, repo, ref, pkgPath);

    // Found a package.json file
    if (pkg?.json && typeof pkg.json === "object") {
      const { name, version } = pkg.json;
      result[name] = {
        version,
        path: pkgPath,
        rawUrl: pkg.rawUrl,
        // Used to verify that the target version matches what we want.
        verifyTarget: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${backstageJsonPath}`,
      };
    }
  }

  return result;
}

async function getPluginPackagesForBackstageVersion(
  workspace,
  target,
  ref = "main",
) {
  const owner = "backstage";
  const repo = "community-plugins";
  const backstageJsonPath = `workspaces/${workspace}/backstage.json`;
  const pluginsDir = `workspaces/${workspace}/plugins`;

  // Find the commit that has the version we want.
  const match = await findCommitWhereBackstageVersionMatches({
    owner,
    repo,
    ref,
    backstageJsonPath,
    target,
  });

  if (!match) {
    return;
  }

  // Get all the package.json files for each plugin
  const packages = await collectPluginPackageJsons({
    owner,
    repo,
    ref: match.sha,
    startDir: pluginsDir,
    backstageJsonPath,
  });

  return packages;
}

module.exports = {
  getPluginPackagesForBackstageVersion,
};
