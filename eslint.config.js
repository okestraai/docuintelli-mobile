// https://docs.expo.dev/guides/using-eslint/
const expo = require('eslint-config-expo/flat');

/**
 * Jest + Node globals for the test harness. Spelled out rather than pulled from the `globals`
 * package, which is only an undeclared transitive dep here — a hoisting change would otherwise
 * break `npm run lint` for reasons that have nothing to do with the lint rules.
 */
const testGlobals = Object.fromEntries(
  [
    'jest', 'describe', 'it', 'test', 'expect', 'beforeAll', 'beforeEach', 'afterAll', 'afterEach',
    'xdescribe', 'xit', 'xtest', 'fdescribe', 'fit',
    'module', 'require', 'process', 'global', '__dirname', '__filename',
  ].map((name) => [name, 'readonly']),
);

module.exports = [
  ...expo,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Flat config dropped `/* eslint-env jest */`, so the harness declares its globals here instead.
    files: ['**/__tests__/**/*.{js,ts,tsx}', '**/*.test.{js,ts,tsx}', 'jest.setup.js', 'jest.config.js'],
    languageOptions: { globals: testGlobals },
  },
];
