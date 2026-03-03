# Utils

Utility scripts used for various purposes.

## bump-plugins.ts

Bumps local plugin `package.json` versions to match a specific Backstage minor release.

```bash
yarn tsx bump-plugins.ts --target 1.46 --debug
```

- `--target` — The Backstage minor version to align plugins with (e.g., `1.46`). The script resolves the **latest patch** of that minor version (e.g., `1.46` → `1.46.3`) by walking the commit history of the upstream [backstage/community-plugins](https://github.com/backstage/community-plugins) repo.
- `--debug` — (optional) Print additional info about resolved packages.

## generate-annotations.mjs

Finds all `package.json` files recursively and transforms them into annotations for Konflux CI/CD integration. Written as plain `.mjs` because it runs in an offline `nodejs-20` image where no dependencies can be installed.

> **Note:** No external dependencies — `tsc`/`tsx` cannot be used.

## update-package-json.ts

Updates the root `package.json` with the release version and Backstage target version. Used by the release workflows.

```bash
yarn tsx update-package-json.ts --version 1.9 --target 1.45
```

- `--version` — The TSSC release version.
- `--target` — The Backstage target (`MAJOR.MINOR`).

## update-container-release-version.ts

Updates the `version` and `release` metadata in the `Containerfile`. Used by the release workflows.

```bash
yarn tsx update-container-release-version.ts --version 1.9
```

- `--version` — The release version (e.g., `1.9`). The value before the dot becomes `version`, the value after becomes `release`.

## update-tkn-release-version.ts

Updates `.tekton` pipeline files for a new release (cel expressions, labels, image refs, etc.). Used by the release workflows.

```bash
yarn tsx update-tkn-release-version.ts --version 1.9
```

- `--version` — The release version.

## update-rhdh-dynamic-plugin-tags.ts

Resolves `<tag>` placeholders in `dynamic-plugins.yaml` with the latest GHCR OCI artifact tags. Entries containing `tssc-plugins` or already-resolved tags are skipped. Requires `GITHUB_TOKEN`. Used by the release-testing workflow.

```bash
GITHUB_TOKEN=ghp_xxx yarn tsx utils/update-rhdh-dynamic-plugin-tags.ts [options]
```

- `--file <path>` — Path to `dynamic-plugins.yaml` (default: `development/configuration/rhdh/dynamic-plugins.yaml`).
- `--dry-run` — Print changes without writing the file.
- `--check` — CI mode: exit non-zero if changes would be made.
- `--verbose` — Enable verbose logging.

## update-tssc-dynamic-plugin-tags.ts

Updates `dynamic-plugins.yaml` for TSSC plugin releases. Reads the version from the root `package.json` and replaces `release-x.y` tags and optional placeholders. Used by the release-testing workflow.

```bash
yarn tsx utils/update-tssc-dynamic-plugin-tags.ts [options]
```

- `--registry <value>` — Replace `<registry>` placeholders.
- `--username <value>` — Replace `<username>` placeholders.
- `--repository <value>` — Replace `<repository>` placeholders.

## version-mismatch.ts

Verifies that each plugin's `package.json` version matches its self-dependency version. Exits with an error on mismatch. Used as a CI check.

```bash
yarn tsx version-mismatch.ts
```
