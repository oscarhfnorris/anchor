/**
 * Babel configuration.
 *
 * `inline-import` turns `.sql` imports into string literals at build time. Drizzle's migrations
 * ship as `.sql` files, and on device there is no filesystem to read them from at runtime, so they
 * have to be inlined into the bundle. Metro must also treat `sql` as a source extension — see
 * metro.config.js; the two settings only work as a pair.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
