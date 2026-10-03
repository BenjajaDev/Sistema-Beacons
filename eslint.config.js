import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/src/generated/**",
      "cms/**",
      "BeaconsAndroid/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // --- Frontend ---
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/web/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["apps/web/src/**/*.tsx"],
    ...jsxA11y.flatConfigs.strict,
  },
  {
    files: ["apps/web/src/shared/theme/theme-init.js"],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Frontera de seguridad: la landing y el código compartido NO pueden importar
  // nada del panel (terminaría en el bundle público). El build lo verifica además
  // con scripts/check-public-bundle.mjs.
  {
    files: ["apps/web/src/public/**", "apps/web/src/shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/admin", "**/admin/**", "@server-theme"],
              message:
                "La landing y src/shared no pueden importar código del panel ni del servidor: terminaría en el bundle público.",
            },
          ],
        },
      ],
    },
  },
);
