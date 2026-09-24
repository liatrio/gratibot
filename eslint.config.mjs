import globals from "globals";
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import mochaPlugin from "eslint-plugin-mocha";

export default [
  eslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: { mocha: mochaPlugin },
    ignores: ["test/setup.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    rules: {
      "prettier/prettier": "error",
      ...mochaPlugin.configs.recommended.rules,
      "mocha/no-mocha-arrows": "off", // Temporary to not include excessive changes in eslint upgrade
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
];
