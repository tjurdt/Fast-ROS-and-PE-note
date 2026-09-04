import globals from "globals";
import tseslint from "typescript-eslint";

const sharedRules = {
  eqeqeq: ["error", "always"],
  "no-constant-condition": ["error", { checkLoops: false }],
  "no-undef": "error",
  "no-unreachable": "error",
  "no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
  ],
};

export default [
  {
    ignores: [
      "index.html",
      "node_modules/",
      "coverage/",
      "dist-v2/",
      "playwright-report/",
      "test-results/",
      "src/index.template.html",
      "src/legacy/",
    ],
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
    rules: sharedRules,
  },
  {
    files: ["src/core/**/*.js", "src/features/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      sourceType: "script",
    },
    rules: sharedRules,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      eqeqeq: ["error", "always"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-unreachable": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];
