// Minimal react-native for the Node test environment. Tests replace
// NativeModules.Unilitix per case; TurboModuleRegistry.get returns null
// (legacy bridge) unless a test sets `turboModules.Unilitix`.
const React = require('react');

const NativeModules = {};
const turboModules = {};
const appStateListeners = new Set();

function hostComponent(name) {
  const C = (props) => React.createElement(name, props, props.children);
  C.displayName = name;
  return C;
}

module.exports = {
  NativeModules,
  turboModules,
  TurboModuleRegistry: {
    get: (name) => turboModules[name] ?? null,
    getEnforcing: (name) => {
      const m = turboModules[name];
      if (!m) throw new Error(`TurboModule ${name} not found`);
      return m;
    },
  },
  Platform: {
    OS: 'android',
    select: (spec) => spec.android ?? spec.default ?? '',
  },
  AppState: {
    currentState: 'active',
    addEventListener: (type, listener) => {
      appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    },
    /** Test helper: deliver an AppState change. */
    _emit: (state) => {
      for (const l of [...appStateListeners]) l(state);
    },
    _listenerCount: () => appStateListeners.size,
  },
  View: hostComponent('View'),
  codegenNativeComponent: (name) => hostComponent(name),
};
