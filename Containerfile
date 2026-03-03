FROM registry.redhat.io/ubi9/nodejs-20:9.7-1764217677 AS builder


WORKDIR /plugin-workspace

ENV PLUGINS_OUTPUT="/plugin-output"
ENV PLUGINS_WORKSPACE="/plugin-workspace"
ENV TURBO_TELEMETRY_DISABLED=1
# Ensure using local headers. (nodejs-devel)
ENV npm_config_nodedir=/usr
ENV NODE_GYP_FORCE_LOCAL=true

USER root

COPY . .

RUN ln -s $PLUGINS_WORKSPACE/.yarn/releases/yarn-4.8.1.cjs /usr/local/bin/yarn

# Install rpms and packages
RUN \
    node --version && \
    yarn --version && \
    dnf module enable nodejs:20 && \
    dnf install -y jq nodejs-devel && \
    yarn install --inline-builds && \
    mkdir -p $PLUGINS_OUTPUT

# Process dynamic plugins
RUN \
    yarn plugins:prepare && \
    yarn plugins:build:frontend && \
    yarn plugins:build:backend && \
    yarn plugins:build:backend:postinstall && \
    yarn plugins:package

# Compose merged index.json
RUN for plugin in $(ls ${PLUGINS_WORKSPACE}/plugins); do \
     mv "${PLUGINS_WORKSPACE}/plugins/${plugin}/dist-plugin/index.json" "${PLUGINS_WORKSPACE}/plugins/${plugin}/dist-plugin/${plugin}-index.json" && \
     cp -R ${PLUGINS_WORKSPACE}/plugins/${plugin}/dist-plugin/* ${PLUGINS_OUTPUT}; \
   done && \
   jq -c -s 'flatten' ${PLUGINS_OUTPUT}/*-index.json > ${PLUGINS_OUTPUT}/index.json && \
   rm -f ${PLUGINS_OUTPUT}/*-index.json

# Copy to compy ecosystem preflight-checks
RUN mkdir -p $PLUGINS_OUTPUT/licenses && \
    cp $PLUGINS_WORKSPACE/LICENSE.TXT $PLUGINS_OUTPUT/licenses

# Create artifact
FROM scratch

LABEL name="TSSC backstage plugins" \
      com.redhat.component="rhads" \
      vendor="Red Hat, Inc." \
      version="1" \
      release="9" \
      description="Artifact with Backstage plugins for TSSC" \
      io.k8s.description="Artifact with Backstage plugins for TSSC" \
      summary="Artifact with Backstage plugins for TSSC" \
      url="https://github.com/redhat-appstudio/tssc-backstage-plugins" \
      distribution-scope="public"

COPY --chown=1001:1001 --from=builder /plugin-output /

USER 1001
