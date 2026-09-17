import { mkdir, writeFile } from "node:fs/promises";
import { createOfficialCoordinatorEvidence } from "../src/official-build-simulator.js";

const evidence = await createOfficialCoordinatorEvidence();
await mkdir("evidence/official-build", { recursive: true });
await writeFile("evidence/official-build/coordinator-v1.json", `${JSON.stringify(evidence, null, 2)}\n`);

console.log("\nRelayBond Official Build Coordinator v1");
console.log("Automatic routing and fail-closed recovery began after the official start.\n");
console.log(`Recovered run: ${evidence.recovered.task.events.map((event) => event.state).join(" → ")}`);
console.log(`Frozen run:    ${evidence.frozen.task.events.map((event) => event.state).join(" → ")}`);
console.log(`Attestation:   ${evidence.recoveryAttestationDigest}`);
console.log(`Evidence:      ${evidence.evidenceHash}`);
console.log("Settlement:    LOCAL / NOT YET BROADCAST\n");
