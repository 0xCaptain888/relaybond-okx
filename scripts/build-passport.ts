import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { JudgeEvidence } from "../src/types.js";
import { buildReliabilityPassport } from "../src/passport.js";

const evidence = JSON.parse(await readFile("evidence/judge-run.json", "utf8")) as JudgeEvidence;
const passport = buildReliabilityPassport(evidence);
await mkdir("evidence", { recursive: true });
await writeFile("evidence/reliability-passport.json", `${JSON.stringify(passport, null, 2)}\n`);
console.log(JSON.stringify(passport, null, 2));
