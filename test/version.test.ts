import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APP_VERSION } from "../src/version.js";

test("runtime health version matches package metadata", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(APP_VERSION, packageJson.version);
});
