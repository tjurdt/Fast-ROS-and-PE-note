import globals from "globals";

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
];
