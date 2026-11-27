// ESLint "flat config" (ESLint 9+). Next.js 16 removed `next lint`, so `npm run lint`
// now calls the ESLint CLI directly and reads this file instead of .eslintrc.json.
// Same rules as before: Next's Core Web Vitals set plus its TypeScript set.
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Build output and generated files are not ours to lint.
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);
