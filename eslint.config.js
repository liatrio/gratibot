const globals = require("globals");
const eslint = require("@eslint/js");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const mochaPlugin = require("eslint-plugin-mocha");

module.exports = [
  eslint.configs.recommended,
  mochaPlugin.configs.flat.recommended,
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
