module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
    'plugin:sonarjs/recommended'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2018,
    project: 'tsconfig.json',
    sourceType: 'module'
  },
  env: {
    node: true,
    browser: true,
    jest: true
  },
  plugins: ['@typescript-eslint', 'eslint-plugin-import-helpers', 'sonarjs'],
  rules: {
    'import/prefer-default-export': 'off',
    'import-helpers/order-imports': [
      'error',
      {
        groups: ['module', ['parent', 'sibling', 'index'], '/.*(css|scss)$/'],
        alphabetize: { order: 'asc', ignoreCase: true },
        newlinesBetween: 'always'
      }
    ],
    'no-multiple-empty-lines': [
      'error',
      {
        max: 1
      }
    ],
    'no-console': ['error', { allow: ['warn', 'error'] }]
  }
};
