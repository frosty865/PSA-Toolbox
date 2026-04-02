import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Dependencies
    "node_modules/**",
    // Scripts (Node.js .js files use require() - normal)
    "scripts/**",
    // Data / corpus / analytics (NOT CODE)
    "analytics/**",
    "corpus/**",
    "documents/**",
    "docs/_archive/**",
    "tools/_archive/**",
    // Generated artifacts
    "*.log",
    "*.json",
  ]),
]);

export default eslintConfig;
