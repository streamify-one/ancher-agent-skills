import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    tabWidth: 2,
    trailingComma: 'es5',
    arrowParens: 'avoid',
    sortPackageJson: false,
    ignorePatterns: ['**/*.md', '**/*.mdc', '**/node_modules/**', '**/dist/**'],
  },
  lint: {
    categories: { correctness: 'error' },
    ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  },
})
