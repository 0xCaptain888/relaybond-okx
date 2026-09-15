import { readFile } from "node:fs/promises";
import { hashCanonical, sha256Canonical } from "../src/canonical.js";
import type { JudgeEvidence } from "../src/types.js";

const path = process.argv[2];
if (!path) throw new Error("Usage: npm run verify:evidence -- <evidence.json>");
const evidence = JSON.parse(await readFile(path, "utf8")) as JudgeEvidence;
const { evidenceHash, portableIntegrity, ...unsigned } = evidence;
const calculated = hashCanonical(unsigned);
const portableCalculated = sha256Canonical({ ...unsigned, evidenceHash });
if (calculated !== evidenceHash || portableCalculated !== portableIntegrity.hash) {
  console.error(JSON.stringify({
    verified: false,
    expected: evidenceHash,
    calculated,
    portableExpected: portableIntegrity.hash,
    portableCalculated,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    verified: true,
    mode: evidence.mode,
    evidenceHash,
    portableIntegrity,
  }, null, 2));
}
