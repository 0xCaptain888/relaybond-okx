import { mkdir, writeFile } from "node:fs/promises";
import { createJudgeEvidence } from "../src/simulator.js";

const evidence = await createJudgeEvidence();
await mkdir("evidence", { recursive: true });
await writeFile("evidence/judge-run.json", `${JSON.stringify(evidence, null, 2)}\n`);

console.log("\nRelayBond Judge Run");
console.log("The payment worked. The service must work too.\n");
for (const scenario of evidence.scenarios) {
  const state = scenario.verification.status === "ACCEPTED" ? "ACCEPTED" : "BREACH → REBATED";
  console.log(`${scenario.name.padEnd(22)} ${state}`);
  if (scenario.verification.violations.length > 0) {
    console.log(`  violations: ${scenario.verification.violations.join(", ")}`);
  }
  console.log(`  bond: ${scenario.settlement.bondBeforeAtomic} → ${scenario.settlement.bondAfterAtomic}`);
}
console.log(`\nEvidence: evidence/judge-run.json`);
console.log(`Hash: ${evidence.evidenceHash}`);
console.log("Mode: DETERMINISTIC_LOCAL_SIMULATION (not a live X Layer claim)\n");
