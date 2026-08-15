/**
 * Metro bundler configuration.
 *
 * Two things here are load-bearing and non-obvious:
 *
 * - `sourceExts` gains `sql` so Drizzle's generated migrations can be imported as modules. There is
 *   no filesystem to read them from on device, so they are bundled as strings (see babel.config.js).
 *   Omit this and the failure is a syntax error while importing migrations, which reads like a
 *   bundler fault rather than a missing config line.
 * - `withNativewind` wires the Tailwind pipeline. NativeWind v5 resolves its CSS entry itself; it
 *   does not take an `input` option the way v4 did.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');

module.exports = withNativewind(config);
