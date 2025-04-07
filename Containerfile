FROM registry.redhat.io/ubi9/nodejs-20:latest AS builder

WORKDIR /plugin-workspace

ENV PLUGINS_OUTPUT="/plugin-output"
ENV PLUGINS_WORKSPACE="/plugin-workspace"
ENV TURBO_TELEMETRY_DISABLED=1

USER root

COPY . .

# Remove local settings
RUN rm -f .npmrc

# The recommended way of using yarn is via corepack. However, corepack is not included in the UBI
# image. Below we install corepack so we can install yarn.
# https://github.com/nodejs/corepack?tab=readme-ov-file#default-installs
RUN \
    node --version && \
    npm install -g corepack && \
    corepack --version && \
    corepack enable yarn && \
    corepack use 'yarn@4' && \
    yarn --version && \
    mkdir -p $PLUGINS_OUTPUT && \
    dnf -y install jq


RUN yarn plugins:prepare && \
    yarn plugins:build

RUN for plugin in $(ls ${PLUGINS_WORKSPACE}/plugins); do \
     mv "${PLUGINS_WORKSPACE}/plugins/${plugin}/dist-plugin/index.json" "${PLUGINS_WORKSPACE}/plugins/${plugin}/dist-plugin/${plugin}-index.json" && \
     cp -R ${PLUGINS_WORKSPACE}/plugins/${plugin}/dist-plugin/* ${PLUGINS_OUTPUT}; \
   done && \
   jq -c -s 'flatten' ${PLUGINS_OUTPUT}/*-index.json > ${PLUGINS_OUTPUT}/index.json && \
   rm -f ${PLUGINS_OUTPUT}/*-index.json

RUN mkdir -p $PLUGINS_OUTPUT/licenses && \
    cp $PLUGINS_WORKSPACE/LICENSE.TXT $PLUGINS_OUTPUT/licenses

FROM scratch

LABEL name="RHTAP backstage plugins" \
      com.redhat.component="rhtap" \
      vendor="Red Hat, Inc." \
      version="1" \
      release="5" \
      description="Artifact with Backstage plugins for RHTAP" \
      summary="Artifact with Backstage plugins for RHTAP" \
      url="https://github.com/redhat-appstudio/backstage-community-plugins" \
      distribution-scope="public"

COPY --chown=1001:1001 --from=builder /plugin-output /

USER 1001
