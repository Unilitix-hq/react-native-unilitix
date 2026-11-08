const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');
// Stamps the bundle with a Unilitix bundle id (source maps); in an app this
// is require('react-native-unilitix/metro').
const { withUnilitixConfig } = require('../metro');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = withUnilitixConfig(
  withMetroConfig(getDefaultConfig(__dirname), {
    root,
    dirname: __dirname,
  })
);

module.exports = config;
