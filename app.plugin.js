// Expo config plugin entry point: `"plugins": ["react-native-unilitix"]`.
// Built from plugin/src by `yarn prepare` (tsc -p plugin).
const plugin = require('./plugin/build');

module.exports = plugin.default || plugin;
