// @ts-nocheck
// Build tooling: the Metro bundle-id plugin, the source-map upload script,
// the Expo config plugin and the native build hooks.
import { it, expect, describe, jest } from '@jest/globals';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const metro = require('../../metro.js');
const maps = require('../../scripts/unilitix-sourcemaps.js');
const plugin = require('../../plugin/src/index.ts');

const tmp = () => mkdtempSync(join(tmpdir(), 'unilitix-'));

describe('metro plugin (bundle id)', () => {
  it('prefixes every run statement with the bundle id', () => {
    const base = {
      resolver: { x: 1 },
      serializer: {
        getRunModuleStatement: (id, prefix) => `${prefix}__r(${id});`,
        other: true,
      },
    };
    const cfg = metro.withUnilitixConfig(base, { bundleId: 'build-42' });
    expect(cfg.resolver).toBe(base.resolver);
    expect(cfg.serializer.other).toBe(true);
    expect(cfg.serializer.getRunModuleStatement(0, 'g.')).toBe(
      'globalThis.__UNILITIX_BUNDLE_ID__="UNILITIX_BUNDLE_ID=build-42";g.__r(0);'
    );
  });

  it('has a default run statement and a UUID per process', () => {
    const cfg = metro.withUnilitixConfig({});
    const stmt = cfg.serializer.getRunModuleStatement('main');
    expect(stmt).toMatch(
      /^globalThis\.__UNILITIX_BUNDLE_ID__="UNILITIX_BUNDLE_ID=[0-9a-f-]{36}";__r\("main"\);$/
    );
  });

  it('the statement sets what the SDK reads', () => {
    const g = {};
    // eslint-disable-next-line no-new-func
    new Function('globalThis', metro.bundleIdStatement('abc'))(g);
    expect(g.__UNILITIX_BUNDLE_ID__).toBe('UNILITIX_BUNDLE_ID=abc');
  });

  it('takes $UNILITIX_BUNDLE_ID and rejects ids the CLI would refuse', () => {
    expect(metro.resolveBundleId({ UNILITIX_BUNDLE_ID: 'ci-77' })).toBe(
      'ci-77'
    );
    expect(() =>
      metro.resolveBundleId({ UNILITIX_BUNDLE_ID: 'a b' })
    ).toThrow();
    expect(() => metro.withUnilitixConfig({}, { bundleId: '../x' })).toThrow();
  });
});

describe('source map upload script', () => {
  function fixture({ hermes = false, id = 'f00d-1' } = {}) {
    const dir = tmp();
    const bundle = join(dir, 'index.android.bundle');
    const literal = `UNILITIX_BUNDLE_ID=${id}`;
    const body = hermes
      ? Buffer.concat([
          Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f, 0, 1]),
          Buffer.from(literal, 'latin1'),
          Buffer.from([0, 0xff]),
        ])
      : `var a=1;\nglobalThis.__UNILITIX_BUNDLE_ID__="${literal}";__r(0);`;
    writeFileSync(bundle, body);
    const map = join(dir, 'index.android.bundle.map');
    writeFileSync(map, '{"version":3,"sources":[],"mappings":""}');
    return { dir, bundle, map };
  }

  const ok = () => ({ status: 0 });

  it('reads the bundle id from plain JS and Hermes bytecode', () => {
    expect(maps.extractBundleId(fixture().bundle)).toBe('f00d-1');
    expect(maps.extractBundleId(fixture({ hermes: true }).bundle)).toBe(
      'f00d-1'
    );
    expect(maps.extractBundleId('/does/not/exist')).toBeNull();
  });

  it('runs unilitix-cli with the contract flags', () => {
    const f = fixture();
    const run = jest.fn(ok);
    const args = maps.upload(
      {
        platform: 'android',
        bundle: f.bundle,
        sourcemap: f.map,
        appVersion: '1.4.2',
        build: '42',
      },
      { UNILITIX_API_KEY: 'k', UNILITIX_CLI: '/opt/unilitix-cli' },
      { run, log: () => undefined }
    );
    expect(run).toHaveBeenCalledWith('/opt/unilitix-cli', args);
    expect(args).toEqual([
      'upload-sourcemap',
      '--platform',
      'android',
      '--sourcemap',
      f.map,
      '--app-version',
      '1.4.2',
      '--build',
      '42',
      '--bundle',
      f.bundle,
      '--bundle-id',
      'f00d-1',
    ]);
  });

  it('composes Hermes maps first when given both halves', () => {
    const f = fixture();
    const run = jest.fn(ok);
    maps.upload(
      {
        platform: 'ios',
        bundle: f.bundle,
        sourcemap: f.map,
        packagerSourcemap: join(f.dir, 'p.map'),
        hermesSourcemap: join(f.dir, 'h.map'),
        appVersion: '1',
        build: '2',
        bundleId: 'explicit',
        dryRun: true,
      },
      {},
      { run, log: () => undefined }
    );
    const [node, [script, packager, hermes, o, out]] = run.mock.calls[0];
    expect(node).toBe(process.execPath);
    expect(script).toMatch(
      /react-native[\\/]scripts[\\/]compose-source-maps\.js$/
    );
    expect([packager, hermes, o, out]).toEqual([
      join(f.dir, 'p.map'),
      join(f.dir, 'h.map'),
      '-o',
      f.map,
    ]);
    expect(run.mock.calls[1][1]).toEqual(
      expect.arrayContaining(['--bundle-id', 'explicit', '--dry-run'])
    );
  });

  it('warns and exits 0 by default, fails in strict mode', () => {
    const f = fixture();
    const warn = jest.fn();
    const argv = [
      'upload',
      '--platform',
      'android',
      '--bundle',
      f.bundle,
      '--sourcemap',
      f.map,
      '--app-version',
      '1',
      '--build',
      '2',
    ];
    // No key.
    expect(maps.main(argv, {}, { warn })).toBe(0);
    expect(warn.mock.calls[0][0]).toMatch(/UNILITIX_API_KEY/);
    expect(maps.main(argv, { UNILITIX_SOURCEMAPS_STRICT: '1' }, { warn })).toBe(
      1
    );
    // CLI missing.
    const enoent = () => ({ error: { code: 'ENOENT' } });
    expect(
      maps.main(
        argv,
        { UNILITIX_API_KEY: 'k' },
        { warn, run: enoent, log: () => {} }
      )
    ).toBe(0);
    expect(warn.mock.calls.at(-1)[0]).toMatch(/not found/);
    // CLI failed.
    const failed = () => ({ status: 3 });
    expect(
      maps.main(
        argv,
        { UNILITIX_API_KEY: 'k', UNILITIX_SOURCEMAPS_STRICT: '1' },
        { warn, run: failed, log: () => {} }
      )
    ).toBe(1);
    // Disabled.
    expect(
      maps.main(argv, { UNILITIX_SOURCEMAPS_DISABLED: '1' }, { warn })
    ).toBe(0);
  });

  it('skips missing bundles, maps and versions; validates input', () => {
    const f = fixture();
    const warn = jest.fn();
    const base = ['upload', '--platform', 'android', '--sourcemap', f.map];
    expect(maps.main([...base, '--app-version', '1'], {}, { warn })).toBe(0);
    expect(warn.mock.calls.at(-1)[0]).toMatch(/no app version/);
    expect(
      maps.main(
        [...base, '--bundle', '/nope', '--app-version', '1', '--build', '2'],
        {},
        { warn }
      )
    ).toBe(0);
    expect(warn.mock.calls.at(-1)[0]).toMatch(/no bundle/);
    expect(
      maps.main(
        [
          'upload',
          '--platform',
          'ios',
          '--sourcemap',
          '/nope.map',
          '--app-version',
          '1',
          '--build',
          '2',
        ],
        {},
        { warn }
      )
    ).toBe(0);
    expect(warn.mock.calls.at(-1)[0]).toMatch(/SOURCEMAP_FILE/);
    for (const argv of [
      ['upload', '--platform', 'web'],
      ['upload', '--platform', 'ios', '--app-version', '1', '--build', '2'],
      [...base, '--app-version', '1', '--build', '2', '--bundle-id', 'a b'],
      ['upload', '--platform'],
      ['nonsense'],
    ]) {
      expect(
        maps.main(argv, { UNILITIX_SOURCEMAPS_STRICT: '1' }, { warn })
      ).toBe(1);
    }
  });

  it('runs a real CLI process with the default runner and logger', () => {
    const f = fixture();
    const cli = join(f.dir, 'fake-cli.sh');
    const seen = join(f.dir, 'args.txt');
    writeFileSync(
      cli,
      `#!/bin/sh\necho "$@" > "${seen}"\n[ -n "$UNILITIX_API_KEY" ]\n`
    );
    require('fs').chmodSync(cli, 0o755);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(
        maps.main(
          [
            'upload',
            '--platform',
            'android',
            '--bundle',
            f.bundle,
            '--sourcemap',
            f.map,
            '--app-version',
            '3.0',
            '--build',
            '30',
          ],
          {
            ...process.env,
            UNILITIX_API_KEY: 'secret',
            UNILITIX_CLI: cli,
            UNILITIX_SOURCEMAPS_STRICT: '1',
          }
        )
      ).toBe(0);
      expect(readFileSync(seen, 'utf8')).toMatch(/--bundle-id f00d-1/);
      expect(readFileSync(seen, 'utf8')).not.toMatch(/secret/);
      expect(log.mock.calls[0][0]).toMatch(/^\[unilitix\] uploading/);
      expect(maps.main(['upload', '--platform', 'x'], {})).toBe(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
    }
  });

  it('prints the bundle id of a bundle', () => {
    const log = jest.fn();
    expect(maps.main(['bundle-id', fixture().bundle], {}, { log })).toBe(0);
    expect(log).toHaveBeenCalledWith('f00d-1');
    expect(maps.main(['bundle-id'], {}, { log })).toBe(1);
  });

  it('the Xcode script reads the built Info.plist and calls the uploader', () => {
    const sh = readFileSync(
      join(root, 'scripts', 'upload-sourcemaps.sh'),
      'utf8'
    );
    expect(sh).toMatch(/CFBundleShortVersionString/);
    expect(sh).toMatch(/CFBundleVersion/);
    expect(sh).toMatch(/unilitix-sourcemaps\.js" upload/);
    expect(sh).toMatch(/--platform ios/);
  });

  it('the Gradle hook finalizes each bundle task with an upload task', () => {
    const gradle = readFileSync(
      join(root, 'android', 'unilitix-sourcemaps.gradle'),
      'utf8'
    );
    expect(gradle).toMatch(/createBundle\$\{cap\}JsAndAssets/);
    expect(gradle).toMatch(/finalizedBy\(upload\)/);
    expect(gradle).toMatch(/"--platform", "android"/);
    expect(gradle).toMatch(/scripts\/unilitix-sourcemaps\.js/);
  });
});

describe('Expo config plugin', () => {
  const appGradle = `apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

react {
}
`;

  it('applies the Gradle hook once, after the React Native plugin', () => {
    const once = plugin.addGradleHook(appGradle);
    expect(plugin.addGradleHook(once)).toBe(once);
    const lines = once.split('\n');
    const react = lines.indexOf('apply plugin: "com.facebook.react"');
    expect(lines[react + 2]).toBe(plugin.GRADLE_MARKER);
    expect(lines[react + 3]).toBe(plugin.GRADLE_LINE);
    expect(plugin.addGradleHook('android {}')).toContain(plugin.GRADLE_LINE);
  });

  it('exports SOURCEMAP_FILE in the bundle phase and adds the upload phase', () => {
    const bundle = {
      name: '"Bundle React Native code and images"',
      shellScript: '"set -e\\nsource \\"$PODS_ROOT/../.xcode.env\\"\\n"',
    };
    const project = {
      hash: {
        project: {
          objects: {
            PBXShellScriptBuildPhase: {
              A: bundle,
              A_comment: 'Bundle React Native code and images',
            },
          },
        },
      },
      getFirstTarget: () => ({ uuid: 'T' }),
      addBuildPhase: jest.fn((files, type, name, target, options) => {
        project.hash.project.objects.PBXShellScriptBuildPhase.B = {
          name: `"${name}"`,
          shellScript: `"${options.shellScript}"`,
        };
      }),
    };
    plugin.configureXcodeProject(project);
    plugin.configureXcodeProject(project);
    expect(bundle.shellScript).toBe(
      '"export SOURCEMAP_FILE=\\"$DERIVED_FILE_DIR/main.jsbundle.map\\"\\nset -e\\nsource \\"$PODS_ROOT/../.xcode.env\\"\\n"'
    );
    expect(project.addBuildPhase).toHaveBeenCalledTimes(1);
    expect(project.addBuildPhase).toHaveBeenCalledWith(
      [],
      'PBXShellScriptBuildPhase',
      'Upload Unilitix source maps',
      'T',
      { shellPath: '/bin/sh', shellScript: plugin.UPLOAD_PHASE_SCRIPT }
    );
    expect(plugin.UPLOAD_PHASE_SCRIPT).toContain(
      'scripts/upload-sourcemaps.sh'
    );
    expect(plugin.addSourcemapExport('x')).toMatch(/^export SOURCEMAP_FILE/);
  });

  it('wires Android, iOS and the manifest through Expo mods', () => {
    const withUnilitix = plugin.default;
    const config = withUnilitix({ name: 'app', slug: 'app' }, {});
    const mods = config.mods;
    expect(typeof mods.android.appBuildGradle).toBe('function');
    expect(typeof mods.android.manifest).toBe('function');
    expect(typeof mods.ios.xcodeproj).toBe('function');

    const xcode = mods.ios.xcodeproj;
    expect(xcode).toBeDefined();
    const off = withUnilitix(
      { name: 'b', slug: 'b' },
      { uploadSourceMaps: false }
    );
    expect(off.mods.android.appBuildGradle).toBeUndefined();
    expect(off.mods.ios?.xcodeproj).toBeUndefined();
  });

  it('runs the mods on Expo-shaped inputs', async () => {
    const withUnilitix = plugin.default;
    const config = withUnilitix(
      { name: 'app', slug: 'app' },
      { cellularGeneration: true }
    );
    const gradle = await config.mods.android.appBuildGradle({
      modResults: { language: 'groovy', contents: appGradle },
      modRequest: { nextMod: (c) => c },
    });
    expect(gradle.modResults.contents).toContain(plugin.GRADLE_LINE);
    const kts = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await config.mods.android.appBuildGradle({
      modResults: { language: 'kt', contents: '' },
      modRequest: { nextMod: (c) => c },
    });
    expect(kts).toHaveBeenCalled();
    const manifest = await config.mods.android.manifest({
      modResults: { manifest: { '$': {}, 'uses-permission': [] } },
      modRequest: { nextMod: (c) => c },
    });
    const perms = manifest.modResults.manifest['uses-permission'].map(
      (p) => p.$['android:name']
    );
    const project = {
      hash: { project: { objects: {} } },
      getFirstTarget: () => null,
      addBuildPhase: jest.fn(),
    };
    await config.mods.ios.xcodeproj({
      modResults: project,
      modRequest: { nextMod: (c) => c },
    });
    expect(project.addBuildPhase).not.toHaveBeenCalled();
    expect(perms).toEqual([
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.READ_PHONE_STATE',
    ]);
  });

  it('app.plugin.js points at the built plugin', () => {
    expect(readFileSync(join(root, 'app.plugin.js'), 'utf8')).toMatch(
      /require\('\.\/plugin\/build'\)/
    );
  });
});
