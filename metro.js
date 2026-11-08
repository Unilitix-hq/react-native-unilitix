'use strict';
/**
 * Metro config wrapper that stamps every bundle with a Unilitix bundle id,
 * so JS errors carry the `metadata.jsBundleId` their source map was
 * uploaded with (`unilitix-cli upload-sourcemap --bundle-id`).
 *
 *   // metro.config.js (bare React Native or Expo)
 *   const { withUnilitixConfig } = require('react-native-unilitix/metro');
 *   module.exports = withUnilitixConfig(config);
 *
 * The id is a random UUID per Metro process (one per release build), or
 * $UNILITIX_BUNDLE_ID when set (e.g. a CI build id). It is written as one
 * string literal, `"UNILITIX_BUNDLE_ID=<id>"`, on the line that starts the
 * app, after every module: source map line/column mappings do not move, and
 * the upload scripts (scripts/unilitix-sourcemaps.js) read the id back from
 * the bundle — plain JS or Hermes bytecode — so nothing else has to be
 * passed between the bundler and the upload step.
 */
const { randomUUID } = require('crypto');

const MARKER = 'UNILITIX_BUNDLE_ID=';
/** What `unilitix-cli upload-sourcemap --bundle-id` accepts. */
const BUNDLE_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

/** The id for this Metro process: $UNILITIX_BUNDLE_ID or a new UUID. */
function resolveBundleId(env = process.env) {
  const fromEnv = env.UNILITIX_BUNDLE_ID;
  if (fromEnv !== undefined && fromEnv !== '') {
    if (!BUNDLE_ID_RE.test(fromEnv)) {
      throw new Error(
        `UNILITIX_BUNDLE_ID "${fromEnv}": use letters, digits and . _ - (max 128)`
      );
    }
    return fromEnv;
  }
  return randomUUID();
}

/** The statement that publishes the id to the SDK at startup. */
function bundleIdStatement(id) {
  return `globalThis.__UNILITIX_BUNDLE_ID__=${JSON.stringify(MARKER + id)};`;
}

/**
 * Returns [config] with `serializer.getRunModuleStatement` wrapped to
 * publish the bundle id before the entry module runs.
 *
 * @param {object} config Metro config (getDefaultConfig / mergeConfig result)
 * @param {{ bundleId?: string }} [options]
 */
function withUnilitixConfig(config, options = {}) {
  const id =
    options.bundleId !== undefined ? options.bundleId : resolveBundleId();
  if (!BUNDLE_ID_RE.test(id)) {
    throw new Error(
      `bundleId "${id}": use letters, digits and . _ - (max 128)`
    );
  }
  const serializer = (config && config.serializer) || {};
  const previous = serializer.getRunModuleStatement;
  const statement = bundleIdStatement(id);
  return {
    ...config,
    serializer: {
      ...serializer,
      getRunModuleStatement(moduleId, globalPrefix) {
        const run =
          typeof previous === 'function'
            ? previous(moduleId, globalPrefix)
            : `${globalPrefix || ''}__r(${JSON.stringify(moduleId)});`;
        return statement + run;
      },
    },
  };
}

module.exports = {
  withUnilitixConfig,
  resolveBundleId,
  bundleIdStatement,
  BUNDLE_ID_MARKER: MARKER,
};
