#!/bin/bash

# Use this script to update the Tekton Task Bundle references used in a Pipeline or a PipelineRun.
#
# Update bundles in a specific YAML file:
# update-tekton-task-bundles.sh .tekton/build-pipeline.yaml
#
# Update bundles in all YAML files under .tekton/
# update-tekton-task-bundles.sh

set -euo pipefail

FILES="$*"
if [[ -z "${FILES}" ]]; then
  FILES="$(find .tekton/ -name "*.yaml")"
fi

# Determine the flavor of yq and adjust yq commands accordingly
if yq --version 2>/dev/null | grep -q mikefarah; then
  # mikefarah yq (v4)
  YQ_IS_MIKEFARAH=1
  YQ_FRAGMENT1='... | select(has("resolver"))'
  YQ_FRAGMENT2=''
else
  # Python yq (kislyuk)
  YQ_IS_MIKEFARAH=0
  YQ_FRAGMENT1='.. | select(type == "object" and has("resolver"))'
  YQ_FRAGMENT2='-r'
fi

# Find existing image references (bundle param values)
OLD_REFS="$(
  yq "$YQ_FRAGMENT1 | .params // [] | .[] | select(.name == \"bundle\") | .value" ${FILES} |
    grep -v -- '---' |
    sed 's/^"\(.*\)"$/\1/' |
    sort -u
)"

# Build mapping old_ref -> new_ref
old_refs=()
new_refs=()

for old_ref in ${OLD_REFS}; do
  repo_tag="${old_ref%@*}"
  new_digest="$(skopeo inspect --no-tags docker://${repo_tag} | yq ${YQ_FRAGMENT2} '.Digest')"
  new_ref="${repo_tag}@${new_digest}"

  [[ "${new_ref}" == "${old_ref}" ]] && continue

  echo "New digest found! ${old_ref} -> ${new_ref}"
  old_refs+=("${old_ref}")
  new_refs+=("${new_ref}")
done

if [[ ${#new_refs[@]} -eq 0 ]]; then
  echo "All bundles are up-to-date."
  exit 0
fi

update_with_mikefarah_yq() {
  local file="$1"

  # For each old/new pair, update any params[] entry where name=="bundle" AND value=="old"
  local i
  for i in "${!old_refs[@]}"; do
    local old="${old_refs[$i]}"
    local new="${new_refs[$i]}"

    # This walks all objects that have "params" and updates the matching bundle value
    yq eval -i \
      '(... | select(has("params")) | .params[]? | select(.name == "bundle" and .value == "'"${old}"'") | .value) = "'"${new}"'"' \
      "${file}"
  done
}

update_with_fallback_replace() {
  local file="$1"

  # Fallback: exact string replacement (only replaces exact old_ref substrings)
  # Uses perl because it handles escaping more predictably than sed across platforms.
  local i
  for i in "${!old_refs[@]}"; do
    local old="${old_refs[$i]}"
    local new="${new_refs[$i]}"

    perl -0777 -pe 's/\Q'"${old}"'\E/'"${new}"'/g' -i "${file}"
  done
}

# Apply updates
for file in ${FILES}; do
  if [[ ${YQ_IS_MIKEFARAH} -eq 1 ]]; then
    update_with_mikefarah_yq "${file}"
  else
    # If you're using python yq, structured editing is messy/fragile across versions,
    # so we do exact replacements as a practical fallback.
    update_with_fallback_replace "${file}"
  fi
done

echo "Done. Updated bundle digests in:"
for file in ${FILES}; do
  echo " - ${file}"
done
