# Release Preparation

This guide walks through building, pushing, and configuring the TSSC Backstage plugins OCI image for a release.

## Prerequisites

### Credentials

The build script requires authentication to two registries:

- **quay.io** — you must be logged in (`podman login quay.io` or `docker login quay.io`)
- **registry.redhat.io** — you'll need a username and password. You can either:
  - [Get a Red Hat Login](https://access.redhat.com/articles/RegistryAuthentication#getting-a-red-hat-login-2)
  - [Create a Registry Service Account](https://access.redhat.com/articles/RegistryAuthentication#creating-registry-service-accounts-6)

### Environment Variables

Create a `.env` file at the root of this repository:
```bash
export CONTAINER_REGISTRY='quay.io/<username>'
export REDHAT_REGISTRY_USERNAME='<username>'
export REDHAT_REGISTRY_PASSWORD='<password>'
export GITHUB_TOKEN='<github_token>'
```

Then load it:
```bash
source .env
```

| Variable | Required | Description |
|---|---|---|
| `CONTAINER_REGISTRY` | Yes | Target registry URL (e.g. `quay.io/<username>`) |
| `REDHAT_REGISTRY_USERNAME` | Yes | Red Hat registry username |
| `REDHAT_REGISTRY_PASSWORD` | Yes | Red Hat registry password |
| `GITHUB_TOKEN` | Yes | GitHub personal access token with `read:packages` scope. Used by the RHDH plugin tag updater to query GitHub Container Registry package versions. [Create one here](https://github.com/settings/tokens). |
| `REPO_NAME` | No | Override the default repository name (`backstage-plugins`) |

## 1. Build and Push the Image

From the root of the repository:
```bash
# Build and push
yarn build:image --release=1.x --push

# Dry-run (print commands without executing)
yarn build:image --release=1.x --push --dry-run
```

> **NOTE**: The `release-x.y` tag should match the version in the root `package.json` file.

## 2. Update Dynamic Plugin References

After the image is pushed, update the dynamic plugin configuration to point to your image.

### Update TSSC plugin references
```bash
yarn update:tssc-dynamic-plugins \
  --registry '<registry>' \
  --username '<username>' \
  --repository '<repository>'
```

This updates `development/configuration/rhdh/dynamic-plugins.yaml` with your container registry, username, and repository. The updated references will look like:
```
oci://quay.io/redhat-tssc/backstage-plugins:release-1.8!<plugin>
```

### Update RHDH plugin tags
```bash
yarn update:rhdh-dynamic-plugins

# Dry-run
yarn update:rhdh-dynamic-plugins --dry-run
```

## 3. Verify Locally

Use the updated `dynamic-plugins.yaml` in your RHDH configuration to verify.

The easiest way to test locally is with [RHDH-Local](https://github.com/redhat-developer/rhdh-local).

---

## Automated Release Testing Workflow

The [`release-testing.yml`](../.github/workflows/release-testing.yml) GitHub Actions workflow automates much of the release preparation process for testing purposes. It bumps plugin versions, updates configuration files, and opens a PR with all the changes.

### Prerequisites

**The OCI image must be built and pushed before running this workflow.** The workflow updates configuration to point at the image, so the artifact needs to exist in the registry first. Follow [Step 1](#1-build-and-push-the-image) to build and push the image to your test registry.

### Running the Workflow

Trigger the workflow manually from the **Actions** tab in GitHub. It requires the following inputs:

| Input | Description | Example |
|---|---|---|
| `version` | Version to set in `package.json` | `1.9` |
| `backstage_target` | Backstage version to bump to (MAJOR.MINOR) | `1.45` |
| `registry` | Registry hosting the test release artifact | `quay.io` |
| `username` | Username in the registry | `<your-username>` |
| `repository` | Repository name in the registry (default: `backstage-plugins`) | `backstage-plugins` |

### What It Does

The workflow automates the following steps:

1. Bumps plugin versions to the target Backstage version
2. Updates `package.json` with the new version and Backstage target
3. Updates the `Containerfile` with the new version
4. Updates `.tekton` files with the new version
5. Updates `dynamic-plugins.yaml` to point at the test artifact (using the provided registry, username, and repository)
6. Opens a PR on `main` with all changes, labeled `do-not-merge`, `release-testing`, and version tags

> **NOTE**: The PR is explicitly marked **do-not-merge** — it is intended for testing only and should not be merged.
