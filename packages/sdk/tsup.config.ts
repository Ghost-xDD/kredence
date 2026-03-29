import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  // Bundle @credence/types so the published package has zero runtime deps
  noExternal: ["@credence/types"],
  target: "es2022",
});
