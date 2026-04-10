const globals = require("globals");
const eslint = require("@eslint/js");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const _mochaPlugin = require("eslint-plugin-mocha");
// eslint-plugin-mocha is an ES module; require() interop varies across Node
// versions — use .default if present, otherwise take the module directly.
const mochaPlugin = _mochaPlugin.default ?? _mochaPlugin;

module.exports = [
  eslint.configs.recommended,
  mochaPlugin.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    ignores: ["test/setup.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "prettier/prettier": "error",
      "mocha/no-mocha-arrows": "off", // Temporary to not include excessive changes in eslint upgrade
    },
  },
];
