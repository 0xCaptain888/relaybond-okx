import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { JudgeEvidence } from "../src/types.js";
import { buildLiveReliabilityPassport, buildReliabilityPassport } from "../src/passport.js";

const evidence = JSON.parse(await readFile("evidence/judge-run.json", "utf8")) as JudgeEvidence;
const passport = buildReliabilityPassport(evidence);
await mkdir("evidence", { recursive: true });
await writeFile("evidence/reliability-passport.json", `${JSON.stringify(passport, null, 2)}\n`);

async function readOptional(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

let livePassport = null;
try {
  const [paid, breach, bond, rebate] = await Promise.all([
    readFile("evidence/live/agentic-wallet-paid-delivery.json", "utf8").then(JSON.parse),
    readOptional("evidence/live/agentic-wallet-paid-breach.json"),
    readFile("evidence/live/bond.json", "utf8").then(JSON.parse),
    readOptional("evidence/live/rebate.json"),
  ]);
  const deliveries = [paid, breach].filter(Boolean).map((delivery) => ({
    status: delivery.verification.status,
    paidAtomic: delivery.payment.onchainSettlement.amountAtomic,
    evidenceHash: delivery.evidenceHash,
    settlementTx: delivery.payment.transactionHash,
    violations: delivery.verification.violations,
  }));
  livePassport = buildLiveReliabilityPassport({
    serviceId: paid.delivery.servicePromise.payload.serviceId,
    provider: paid.delivery.servicePromise.payload.provider,
    bondBalanceAtomic: rebate?.bondAfterAtomic || bond.bondBalanceAtomic,
    rebateAtomic: paid.delivery.servicePromise.payload.rebateAtomic,
    currentServiceActive: rebate?.serviceActiveAfter ?? true,
    deliveries,
    rebatedAtomic: rebate?.attestation.rebateAmount || "0",
    rebateTx: rebate?.transactionHash,
    generatedAt: rebate?.generatedAt || breach?.capturedAt || paid.capturedAt,
  });
  await writeFile("evidence/live/reliability-passport.json", `${JSON.stringify(livePassport, null, 2)}\n`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

console.log(JSON.stringify({ local: passport, live: livePassport }, null, 2));
