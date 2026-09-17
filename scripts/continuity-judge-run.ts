import { mkdir, writeFile } from "node:fs/promises";
import { verifyContinuityEconomics } from "../src/continuity.js";
import { createContinuityEvidence } from "../src/continuity-simulator.js";
import { recoverContinuitySigner } from "../src/signing.js";

const evidence = await createContinuityEvidence();
const signer = await recoverContinuitySigner(
  { chainId: evidence.chainId, vault: evidence.vault },
  evidence.continuityReceipt,
);
const economics = verifyContinuityEconomics(evidence.continuityReceipt.payload);
if (signer.toLowerCase() !== evidence.verifier.toLowerCase()) throw new Error("Continuity Receipt verifier signature mismatch.");
if (!economics.passed) throw new Error("Continuity economics invariant failed.");
await mkdir("evidence", { recursive: true });
await writeFile("evidence/continuity-judge-run.json", `${JSON.stringify(evidence, null, 2)}\n`);

console.log("\nRelayBond Continuity Judge Run");
console.log("The buyer pays once. The task still finishes.\n");
for (const stage of evidence.stages) console.log(`${stage.state.padEnd(22)} ${stage.description}`);
console.log(`\nFinal status: ${evidence.continuityReceipt.payload.finalStatus}`);
console.log(`Buyer paid: ${evidence.economics.buyerPaidAtomic} atomic`);
console.log(`Backup funded from bond: ${evidence.economics.fundedFromPrimaryBondAtomic} atomic`);
console.log(`Buyer double charged: ${evidence.economics.buyerDoubleCharged}`);
console.log(`Evidence: evidence/continuity-judge-run.json`);
console.log(`Hash: ${evidence.evidenceHash}`);
console.log("Mode: DETERMINISTIC_LOCAL_RECOVERY (V2 contract is deployed; this recovery run is not onchain)\n");
