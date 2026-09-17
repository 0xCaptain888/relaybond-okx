import assert from "node:assert/strict";
import test from "node:test";
import { backupAuthorizationMatches } from "../src/v2-provider-runtime.js";

test("backup authorization uses an exact constant-time token match", () => {
  const token = "a".repeat(64);
  assert.equal(backupAuthorizationMatches(token, token), true);
  assert.equal(backupAuthorizationMatches(`${token}x`, token), false);
  assert.equal(backupAuthorizationMatches("a".repeat(63), token), false);
  assert.equal(backupAuthorizationMatches(undefined, token), false);
});

test("backup authorization refuses weak configured tokens", () => {
  assert.equal(backupAuthorizationMatches("short", "short"), false);
});
