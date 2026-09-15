import { build } from "esbuild";

await build({
  entryPoints: ["src/browser-verifier.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  outfile: "web/relaybond-verifier.js",
});

console.log("Browser EIP-712 verifier bundled to web/relaybond-verifier.js");
