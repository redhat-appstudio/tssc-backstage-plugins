#!/usr/bin/env node
"use strict";
/**
 * Update the .tekton files for a release
 *
 * Usage:
 *   node update-tkn-release-version.js \
 *     --version 1.9
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs, required } from "./shared";

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
    const celEvent = forOnPush ? "push" : "pull_request";
    const pipelineName = forOnPush
      ? `tssc-backstage-plugins-${versionInsert}-on-push`
      : `tssc-backstage-plugins-${versionInsert}-on-pull-request`;
    const outputImageRegex = forOnPush
      ? file_regex.output_image_value.push
      : file_regex.output_image_value.pull;
    const replacements: [RegExp, string][] = [
      [file_regex.cel_expression, `pipelinesascode.tekton.dev/on-cel-expression: event == "${celEvent}" && target_branch == "release-${version}"`],
      [file_regex.application_label, `appstudio.openshift.io/application: tssc-backstage-plugins-${versionInsert}`],
      [file_regex.component_label, `appstudio.openshift.io/component: tssc-backstage-plugins-${versionInsert}`],
      [file_regex.pipeline_name, pipelineName],
      [outputImageRegex, `quay.io/redhat-user-workloads/rhtap-shared-team-tenant/tssc-backstage-plugins-${versionInsert}:${forOnPush ? "" : "on-pr-"}{{revision}}`],
      [file_regex.service_account_name, `build-pipeline-tssc-backstage-plugins-${versionInsert}`],
    ];
    const result = replacements.reduce((content, [regex, replacement]) => content.replace(regex, replacement), raw);
    await writeFile(path, result, "utf8");

    console.log(`Updated ${path} version -> ${version}`);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
