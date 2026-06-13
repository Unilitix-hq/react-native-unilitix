module.exports = {
  NativeModules: {},
  Platform: {
    OS: 'android',
    select: (spec) => spec.android ?? spec.default ?? '',
  },
};
