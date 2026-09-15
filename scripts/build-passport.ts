import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { JudgeEvidence } from "../src/types.js";
import { buildLiveReliabilityPassport, buildReliabilityPassport } from "../src/passport.js";

const evidence = JSON.parse(await readFile("evidence/judge-run.json", "utf8")) as JudgeEvidence;
const passport = buildReliabilityPassport(evidence);
await mkdir("evidence", { recursive: true });
await writeFile("evidence/reliability-passport.json", `${JSON.stringify(passport, null, 2)}\n`);

let livePassport = null;
try {
  const [paid, bond] = await Promise.all([
    readFile("evidence/live/agentic-wallet-paid-delivery.json", "utf8").then(JSON.parse),
    readFile("evidence/live/bond.json", "utf8").then(JSON.parse),
  ]);
  livePassport = buildLiveReliabilityPassport({
    serviceId: paid.delivery.servicePromise.payload.serviceId,
    provider: paid.delivery.servicePromise.payload.provider,
    status: paid.verification.status,
    bondBalanceAtomic: bond.bondBalanceAtomic,
    rebateAtomic: paid.delivery.servicePromise.payload.rebateAtomic,
    paidAtomic: paid.payment.onchainSettlement.amountAtomic,
    evidenceHash: paid.evidenceHash,
    settlementTx: paid.payment.transactionHash,
    generatedAt: paid.capturedAt,
  });
  await writeFile("evidence/live/reliability-passport.json", `${JSON.stringify(livePassport, null, 2)}\n`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

console.log(JSON.stringify({ local: passport, live: livePassport }, null, 2));
