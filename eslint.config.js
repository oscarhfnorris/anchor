// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * The `core/` purity zone.
 *
 * `src/core/` must import nothing platform-specific — no `expo-*`, no `react-native`, no `react`,
 * and none of the adapter folders. It is the only part of the app that can be verified without
 * sleeping, the only part an Android port would reuse, and the only part where the behaviour rules
 * live. Everything else in the architecture rests on that.
 *
 * This is a hard error rather than an advisory scan, because it is the one convention whose
 * violation silently destroys the architecture and, unlike most house rules, is trivially
 * detectable statically. It is proven to fire in Phase 0 rather than assumed to be wired.
 */
const CORE_PURITY = {
  files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              'expo',
              'expo-*',
              'expo/*',
              'react',
              'react-dom',
              'react-native',
              'react-native-*',
              '@react-native/*',
              'nativewind',
              'drizzle-orm/*',
              '@/app/*',
              '@/db/*',
              '@/ui/*',
              '@/alarm/*',
              '@/nfc/*',
              '@/geo/*',
              '@/proximity/*',
            ],
            message:
              'src/core/ is pure TypeScript. It must not import platform or adapter code — that is what makes it testable and portable. Move the platform-facing part outside core/ and pass what it needs in through Context.',
          },
        ],
      },
    ],
  },
};

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'src/db/migrations/*'] },
  CORE_PURITY,
]);
