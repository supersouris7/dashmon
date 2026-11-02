// Static analysis: ESLint's recommended rules, plus the ones that catch dead
// code (unused variables and imports). The layout is Prettier's job, so no
// formatting rule is enabled here.
import js from "@eslint/js";
import globals from "globals";

const unused = [
  "error",
  {
    args: "after-used",
    argsIgnorePattern: "^_",
    caughtErrors: "all",
    caughtErrorsIgnorePattern: "^_",
    varsIgnorePattern: "^_"
  }
];

export default [
  { ignores: ["node_modules/", "graphify-out/", "data/", "screenshots/", ".opencode/"] },
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": unused,
      // "catch (_error) {}" is how the code says "a failure here is expected".
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      // A variable read by a closure before its single assignment stays "let".
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
      eqeqeq: ["error", "always", { null: "ignore" }]
    }
  },
  // Server, agent, widget backends and tests: CommonJS on Node.
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node }
  },
  // Browser modules and widget renderers.
  {
    files: ["public/js/**/*.js", "widgets/**/*.mjs"],
    languageOptions: { sourceType: "module", globals: globals.browser }
  },
  // The browser test drives Chromium and runs code inside the page.
  {
    files: ["test/browser.test.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ["eslint.config.mjs"],
    languageOptions: { sourceType: "module", globals: globals.node }
  }
];
