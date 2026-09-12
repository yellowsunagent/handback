const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
const config = JSON.parse(execFileSync(process.execPath, [expoCli, 'config', '--type', 'introspect', '--json'], { encoding: 'utf8' }));
const ios = config._internal.modResults.ios;
assert.equal(ios.entitlements['aps-environment'], undefined, 'Local reminders must not require APNs signing');
assert.equal(ios.infoPlist.NSMicrophoneUsageDescription, undefined, 'QR scanning must not request microphone access');
assert.ok(ios.infoPlist.NSCameraUsageDescription, 'QR camera needs an understandable usage description');
console.log('Native config: camera enabled, microphone and APNs absent.');
