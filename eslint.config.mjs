import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // Playwright llama «use» en los fixtures y el linter lo confunde con un hook de React.
  { files: ["e2e/**"], rules: { "react-hooks/rules-of-hooks": "off" } },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código generado y herramientas de agentes, no del juego.
    "src/generated/**",
    ".claude/**",
    ".qoder/**",
    ".impeccable/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
