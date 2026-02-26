import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractImageName,
  shouldUpdate,
} from "./update-rhdh-dynamic-plugin-tags";
import { Document, parseDocument } from "yaml";

// ---------------------------------------------------------------------------
// extractImageName
// ---------------------------------------------------------------------------

describe("extractImageName", () => {
  it("extracts image name from a frontend plugin OCI URL", () => {
    assert.equal(
      extractImageName(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-azure-devops:<tag>",
      ),
      "backstage-community-plugin-azure-devops",
    );
  });

  it("extracts image name from a backend plugin OCI URL", () => {
    assert.equal(
      extractImageName(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-rbac-backend:<tag>",
      ),
      "backstage-community-plugin-rbac-backend",
    );
  });

  it("extracts image name from a third-party plugin OCI URL", () => {
    assert.equal(
      extractImageName(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/immobiliarelabs-backstage-plugin-gitlab:<tag>",
      ),
      "immobiliarelabs-backstage-plugin-gitlab",
    );
  });

  it("extracts image name from a kubernetes plugin OCI URL", () => {
    assert.equal(
      extractImageName(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-plugin-kubernetes-backend:<tag>",
      ),
      "backstage-plugin-kubernetes-backend",
    );
  });
});

// ---------------------------------------------------------------------------
// shouldUpdate
// ---------------------------------------------------------------------------

describe("shouldUpdate", () => {
  it("returns true for OCI entries with <tag> placeholder", () => {
    assert.equal(
      shouldUpdate(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-azure-devops:<tag>",
      ),
      true,
    );
  });

  it("returns true for backend OCI entries with <tag> placeholder", () => {
    assert.equal(
      shouldUpdate(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-rbac-backend:<tag>",
      ),
      true,
    );
  });

  it("returns false for entries containing tssc-plugins", () => {
    assert.equal(
      shouldUpdate(
        "oci://<registry>/<username>/<repository>:release-x.y!tssc-plugins-backstage-community-plugin-tekton",
      ),
      false,
    );
  });

  it("returns false for oci:// placeholder entries with tssc-plugins", () => {
    assert.equal(
      shouldUpdate(
        "oci://<registry>/<username>/<repository>:release-x.y!tssc-plugins-backstage-community-plugin-quay",
      ),
      false,
    );
  });

  it("returns false for already-resolved oci:// entries", () => {
    assert.equal(
      shouldUpdate(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-azure-devops:bs_1.0",
      ),
      false,
    );
  });

  it("returns false for random non-oci paths", () => {
    assert.equal(shouldUpdate("some-other-package"), false);
  });

  it("returns false for local dist paths", () => {
    assert.equal(
      shouldUpdate(
        "./dynamic-plugins/dist/backstage-community-plugin-azure-devops",
      ),
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// YAML comment preservation
// ---------------------------------------------------------------------------

describe("YAML comment preservation", () => {
  it("preserves comments when modifying package values", () => {
    const input = `# Top-level comment
plugins:
  # Github Actions
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-github-actions:<tag>
    disabled: false

  # RBAC
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-rbac:<tag>
    disabled: false
`;

    const doc = parseDocument(input, { keepSourceTokens: true });
    const plugins = doc.get("plugins", true) as any;

    // Simulate updating the first plugin
    const firstItem = plugins.items[0];
    const packagePair = firstItem.items.find(
      (p: any) => p.key?.value === "package",
    );
    packagePair.value.value =
      "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-github-actions:bs_1.0";

    const output = doc.toString();

    // Comments should be preserved
    assert.ok(
      output.includes("# Top-level comment"),
      "Top-level comment preserved",
    );
    assert.ok(output.includes("# Github Actions"), "Inline comment preserved");
    assert.ok(output.includes("# RBAC"), "Section comment preserved");

    // Updated value should be present
    assert.ok(
      output.includes(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-github-actions:bs_1.0",
      ),
      "Updated value present",
    );

    // Untouched plugin should remain with <tag>
    assert.ok(
      output.includes(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-rbac:<tag>",
      ),
      "Untouched plugin preserved",
    );
  });
});

// ---------------------------------------------------------------------------
// Mixed entries (selective update)
// ---------------------------------------------------------------------------

describe("selective update logic", () => {
  it("only updates <tag> entries, leaving tssc-plugins and already-resolved entries untouched", () => {
    const input = `plugins:
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-github-actions:<tag>
    disabled: false
  - package: oci://<registry>/<username>/<repository>:release-x.y!tssc-plugins-backstage-community-plugin-tekton
    disabled: false
  - package: oci://ghcr.io/some/image:resolved-tag
    disabled: false
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-rbac-backend:<tag>
    disabled: false
`;

    const doc = parseDocument(input, { keepSourceTokens: true });
    const plugins = doc.get("plugins", true) as any;

    const updates: string[] = [];

    for (const item of plugins.items) {
      const packagePair = item.items?.find(
        (p: any) => p.key?.value === "package",
      );
      if (!packagePair) continue;

      const val: string = packagePair.value?.value;
      if (shouldUpdate(val)) {
        updates.push(val);
        // Simulate update: replace <tag> with test-tag
        const imageName = extractImageName(val);
        packagePair.value.value = val.replace("<tag>", "test-tag");
      }
    }

    // Exactly 2 entries should be updated
    assert.equal(updates.length, 2);
    assert.ok(updates[0].includes("github-actions"));
    assert.ok(updates[1].includes("rbac-backend"));

    const output = doc.toString();

    // tssc-plugins entry unchanged
    assert.ok(
      output.includes(
        "oci://<registry>/<username>/<repository>:release-x.y!tssc-plugins-backstage-community-plugin-tekton",
      ),
      "tssc-plugins entry unchanged",
    );

    // already-resolved entry unchanged
    assert.ok(
      output.includes("oci://ghcr.io/some/image:resolved-tag"),
      "already-resolved entry unchanged",
    );

    // Updated entries have new values
    assert.ok(
      output.includes(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-github-actions:test-tag",
      ),
      "frontend plugin updated",
    );
    assert.ok(
      output.includes(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-rbac-backend:test-tag",
      ),
      "backend plugin updated",
    );
  });
});
