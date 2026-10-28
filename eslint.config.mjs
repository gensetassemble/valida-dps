import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
export default defineConfig([
  globalIgnores([".next/**", ".tools/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
  { files: ["**/*.ts", "**/*.tsx"], extends: [js.configs.recommended, ...ts.configs.recommended], plugins: { "@next/next": next, "react-hooks": hooks }, rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules, ...hooks.configs.recommended.rules } },
]);
