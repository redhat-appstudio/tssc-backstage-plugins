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

/**
 * Returns the most recent commit where the "version" value in `backstage.json`
 * is closest to the the version target we pass.
 * */
async function findCommitsForBackstageTarget({
  owner,
  repo,
  workspace,
  backstageJsonPath,
  target,
}) {
  // Always start at main.
  const ref = "main";
  // Fast check at ref passed or default: 'main'
  const current = await fetchRawJson(owner, repo, ref, backstageJsonPath);
  if (!current) {
    console.error(`Could not fetch/parse ${backstageJsonPath} at ref "${ref}"`);
  }

  // Check if we already found the version we want.
  // Since the check starts at main it's safe to assume
  // this is the highest version.
  const currentVersion = String(current.json?.version);
  console.debug(
    `⚡️ Workspace ${workspace} includes target (${target}) on main: ${currentVersion}`,
  );
  if (currentVersion.includes(target)) {
    return {
      sha: ref,
      info: { date: null, msg: null },
      rawUrl: current.rawUrl,
    };
  }

  let page = 1;
  const perPage = 100;
  // For debug
  const versionsFound = {};
  // Collect any versions close to the target.
  const relatedVersions = {};

  // Walk commit history for that file
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

    // Reached the end of commits
    if (!Array.isArray(commits) || commits.length === 0) {
      // Leave loop
      break;
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

      // We found a version that closely matches backstage target:
      // target: '1.45', v: '1.45.1'
      if (v.includes(target)) {
        const date =
          c.commit?.committer?.date ?? c.commit?.author?.date ?? null;
        const msg = c.commit?.message?.split("\n")[0] ?? null;
        relatedVersions[v] = {
          sha,
          info: { date, msg },
          rawUrl: fileAtCommit.rawUrl,
        };
      }
    }
    // Next page
    page++;
  }

  const foundVersions = Object.keys(relatedVersions);
  if (foundVersions.length >= 1) {
    // Only use the highest version closest to the target.
    const highestVersion = foundVersions.sort().pop();
    const result = relatedVersions[highestVersion];
    console.debug(
      `✅ Workspace ${workspace} includes target (${target}) on ${result.sha}: ${highestVersion}`,
    );
    return result;
  }

  // Log the targets we did find.
  const debugJson = { [backstageJsonPath]: versionsFound };
  console.log("\n");
  console.warn(
    `🚨 No commit found for ${workspace} with version close to ${target}`,
  );
  console.debug("🕵️ Logging what was found:");
  console.debug(debugJson);
  console.debug("\n");
  return null;
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
  workspace,
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
        workspace,
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

async function getPluginPackagesForBackstageVersion(workspace, target) {
  const owner = "backstage";
  const repo = "community-plugins";
  const backstageJsonPath = `workspaces/${workspace}/backstage.json`;
  const pluginsDir = `workspaces/${workspace}/plugins`;

  // Find the commit that has the version we want.
  const match = await findCommitsForBackstageTarget({
    owner,
    repo,
    workspace,
    backstageJsonPath,
    target,
  });

  if (!match) {
    return;
  }

  // Using the commit we found, collect all the packages
  // for each plugin in that workspace at that point in time.
  const packages = await collectPluginPackageJsons({
    owner,
    repo,
    ref: match.sha,
    startDir: pluginsDir,
    workspace,
    backstageJsonPath,
  });

  return packages;
}

module.exports = {
  getPluginPackagesForBackstageVersion,
};
