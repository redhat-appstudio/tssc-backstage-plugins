#!/usr/bin/env node
"use strict";
/**
 * Update the .tekton files for a release
 *
 * Usage:
 *   node update-tkn-release-version.js \
 *     --version 1.9
 */

const { readFile, writeFile } = require("node:fs/promises");
const { parseArgs, required } = require("./shared");

const file_regex = {
  cel_expression:
    /pipelinesascode.tekton.dev\/on-cel-expression: event == \"(pull_request|push)\" && target_branch == \"main"/g,
  application_label:
    /appstudio.openshift.io\/application: tssc-backstage-plugins/g,
  component_label: /appstudio.openshift.io\/component: tssc-backstage-plugins/g,
  pipeline_name: /tssc-backstage-plugins-on-(push|pull-request)/g,
  output_image_value: {
    push: /quay\.io\/redhat-user-workloads\/rhtap-shared-team-tenant\/rhtap-shared-team-tenant-tenant\/tssc-backstage-plugins\/tssc-backstage-plugins:\{\{revision}}/g,
    pull: /quay\.io\/redhat-user-workloads\/rhtap-shared-team-tenant\/rhtap-shared-team-tenant-tenant\/tssc-backstage-plugins\/tssc-backstage-plugins:on-pr-\{\{revision}}/g,
  },
  service_account_name: /build-pipeline-tssc-backstage-plugins/g,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = required("version", args.version);
  const versionInsert = `${version.replace(".", "-")}`;
  const paths = [
    ".tekton/rhtap-backstage-plugins-pull-request.yaml",
    ".tekton/rhtap-backstage-plugins-push.yaml",
  ];
  for (const path of paths) {
    const forOnPush = path.includes("push.yaml");
    const raw = await readFile(path, "utf8");
    // update cel-expression label
    const celEvent = forOnPush ? "push" : "pull_request";
    const updatedCel = raw.replace(
      file_regex.cel_expression,
      `pipelinesascode.tekton.dev/on-cel-expression: event == "${celEvent}" && target_branch == "release-${version}"`,
    );
    // update application label
    const updatedApplicationLabel = updatedCel.replace(
      file_regex.application_label,
      `appstudio.openshift.io/application: tssc-backstage-plugins-${versionInsert}`,
    );
    // and so on.
    const updatedComponentLabel = updatedApplicationLabel.replace(
      file_regex.component_label,
      `appstudio.openshift.io/component: tssc-backstage-plugins-${versionInsert}`,
    );
    const pipelineName = forOnPush
      ? `tssc-backstage-plugins-${versionInsert}-on-push`
      : `tssc-backstage-plugins-${versionInsert}-on-pull-request`;
    const updatedPipelineName = updatedComponentLabel.replace(
      file_regex.pipeline_name,
      pipelineName,
    );
    const outputImageRegex = forOnPush
      ? file_regex.output_image_value.push
      : file_regex.output_image_value.pull;
    const updatedOutputImagevalue = updatedPipelineName.replace(
      outputImageRegex,
      `quay.io/redhat-user-workloads/rhtap-shared-team-tenant/tssc-backstage-plugins-${versionInsert}:${forOnPush ? "" : "on-pr-"}{{revision}}`,
    );
    const finalEdit = updatedOutputImagevalue.replace(
      file_regex.service_account_name,
      `build-pipeline-tssc-backstage-plugins-${versionInsert}`,
    );

    await writeFile(path, finalEdit, "utf8");

    console.log(`Updated ${path} version -> ${version}`);
  }
}

main().catch((e) => {
  console.log(`Error: ${e.message}`);
});
