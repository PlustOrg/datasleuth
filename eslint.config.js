import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      'docs/api/',
      'test-output.json',
      'coverage-output.json',
      '*.d.ts',
      'scripts/*.js', // Ignore scripts directory for TypeScript ESLint rules
    ],
  },
  {
    // Special config for scripts
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Rules for script files
      '@typescript-eslint/no-require-imports': 'off', // In case we need to support both formats
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-useless-catch': 'error',
    },
  }
);
