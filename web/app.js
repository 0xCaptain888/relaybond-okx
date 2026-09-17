import { sha256Canonical as sha256 } from "./canonical.js";

const runButton = document.querySelector("#run");
const verifyButton = document.querySelector("#verify");
const probeButton = document.querySelector("#probe");
const verifyLiveButton = document.querySelector("#verify-live");
const runOfficialButton = document.querySelector("#run-official");
const verifyOfficialButton = document.querySelector("#verify-official");
const verifyV2LiveButton = document.querySelector("#verify-v2-live");
const judgeRunButton = document.querySelector("#judge-run");
const judgeRunSecondaryButton = document.querySelector("#judge-run-secondary");
const output = document.querySelector("#output");
const bond = document.querySelector("#bond");
const runState = document.querySelector("#run-state");
const acceptanceRate = document.querySelector("#acceptance-rate");
const bondCoverage = document.querySelector("#bond-coverage");
const verifiedCalls = document.querySelector("#verified-calls");
const liveBond = document.querySelector("#live-bond");
const walletFunding = document.querySelector("#wallet-funding");
const paidProof = document.querySelector("#paid-proof");
const bondStatus = document.querySelector("#bond-status");
const steps = [...document.querySelectorAll("[data-step]")];
const officialSteps = [...document.querySelectorAll("[data-official-step]")];
const officialState = document.querySelector("#official-state");
const v2PlanStatus = document.querySelector("#v2-plan-status");
const v2PlanDetail = document.querySelector("#v2-plan-detail");
const v2SettlementStatus = document.querySelector("#v2-settlement-status");
const v2ReadinessDetail = document.querySelector("#v2-readiness-detail");
const judgeRunState = document.querySelector("#judge-run-state");
const judgeSteps = [...document.querySelectorAll("[data-judge-step]")];

const LIVE_API_BASE = window.location.hostname === "relaybond-okx.vercel.app"
  ? ""
  : "https://relaybond-okx.vercel.app";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadEvidence() {
  const response = await fetch("./evidence/judge-run.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Generate evidence first: npm run demo");
  return response.json();
}

async function loadContinuityEvidence() {
  const response = await fetch("./evidence/continuity-judge-run.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Generate continuity evidence first: npm run demo:continuity");
  return response.json();
}

async function loadOfficialEvidence() {
  const response = await fetch("./evidence/official-build/coordinator-v1.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Generate official evidence first: npm run demo:official-coordinator");
  return response.json();
}

async function loadLiveV2Evidence() {
  const response = await fetch("./evidence/official-build/v2-live-coordinator.json", { cache: "no-store" });
  if (!response.ok) throw new Error("LIVE V2 coordinator evidence is not published yet");
  return response.json();
}

async function loadOfficialSettlement() {
  const response = await fetch(`${LIVE_API_BASE}/v1/official/settlement`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Official settlement endpoint returned HTTP ${response.status}`);
  return response.json();
}

async function loadV2Readiness() {
  const [planResponse, readinessResponse, deploymentResponse, verificationResponse, bondPlanResponse, bondingResponse, settlementPlanResponse, liveCoordinatorResponse] = await Promise.all([
    fetch("./evidence/official-build/v2-deployment-plan.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-readiness.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-deployment.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-contract-verification.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-bond-plan.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-bonding.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-settlement-plan.json", { cache: "no-store" }),
    fetch("./evidence/official-build/v2-live-coordinator.json", { cache: "no-store" }),
  ]);
  if (!planResponse.ok || !readinessResponse.ok || !deploymentResponse.ok || !verificationResponse.ok || !bondPlanResponse.ok || !bondingResponse.ok || !settlementPlanResponse.ok || !liveCoordinatorResponse.ok) {
    throw new Error("V2 deployment evidence is not published yet");
  }
  return {
    plan: await planResponse.json(),
    readiness: await readinessResponse.json(),
    deployment: await deploymentResponse.json(),
    verification: await verificationResponse.json(),
    bondPlan: await bondPlanResponse.json(),
    bonding: await bondingResponse.json(),
    settlementPlan: await settlementPlanResponse.json(),
    liveCoordinator: await liveCoordinatorResponse.json(),
  };
}

async function loadV2Runtime() {
  const base = "https://relaybond-okx.vercel.app";
  const [healthResponse, providersResponse, readinessResponse] = await Promise.all([
    fetch(`${base}/health`, { cache: "no-store" }),
    fetch(`${base}/v1/providers`, { cache: "no-store" }),
    fetch(`${base}/v1/official/readiness`, { cache: "no-store" }),
  ]);
  if (!healthResponse.ok || !providersResponse.ok || !readinessResponse.ok) throw new Error("Public V2 runtime is unavailable");
  return {
    health: await healthResponse.json(),
    providers: await providersResponse.json(),
    readiness: await readinessResponse.json(),
  };
}

async function loadLiveEvidence(name) {
  const response = await fetch(`./evidence/live/${name}.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${name} evidence is not published yet`);
  return response.json();
}

function decodeBase64Json(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function inspectLivePaymentBoundary() {
  const response = await fetch(`${LIVE_API_BASE}/v1/provider/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "BTC-USDT", scenario: "accepted" }),
  });
  if (response.status !== 402) throw new Error(`Expected HTTP 402, received ${response.status}`);
  const header = response.headers.get("payment-required");
  if (!header) throw new Error("PAYMENT-REQUIRED header is missing");
  const challenge = decodeBase64Json(header);
  const terms = challenge.accepts?.[0];
  if (!terms) throw new Error("No payment terms were returned");
  return { challenge, terms };
}

async function probeLivePayment() {
  probeButton.disabled = true;
  runState.textContent = "PROBING LIVE";
  try {
    const { challenge, terms } = await inspectLivePaymentBoundary();
    output.textContent = `$ LIVE x402 PAYMENT BOUNDARY\n\nHTTP:      402 Payment Required\nScheme:    ${terms.scheme}\nNetwork:   ${terms.network}\nAmount:    ${terms.amount} atomic (${Number(terms.amount) / 1_000_000} ${terms.extra?.name || "token"})\nAsset:     ${terms.asset}\nPayee:     ${terms.payTo}\nTimeout:   ${terms.maxTimeoutSeconds}s\nResource:  ${challenge.resource?.url}\n\n✓ No payment was signed. The browser inspected the live production challenge.`;
    runState.textContent = "LIVE 402 VERIFIED";
  } catch (error) {
    output.textContent = `$ Live probe failed\n${error.message}`;
    runState.textContent = "PROBE FAILED";
  } finally {
    probeButton.disabled = false;
  }
}

function resetJudgeProof() {
  judgeSteps.forEach((step) => {
    step.className = "";
    step.lastElementChild.textContent = "WAITING";
  });
}

async function completeJudgeStep(index, status, className = "done") {
  const step = judgeSteps[index];
  step.classList.add("active");
  step.lastElementChild.textContent = "VERIFYING";
  await wait(480);
  step.classList.remove("active");
  step.classList.add(className);
  step.lastElementChild.textContent = status;
}

async function runJudgeProof() {
  const buttons = [judgeRunButton, judgeRunSecondaryButton].filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  resetJudgeProof();
  judgeRunState.textContent = "LIVE VERIFICATION RUNNING";
  document.querySelector("#judge-proof")?.scrollIntoView({ behavior: "smooth", block: "center" });
  output.textContent = "$ RELAYBOND 60-SECOND JUDGE PROOF\n\nRead-only verification started. No wallet prompt. No new transaction.";

  try {
    const { challenge, terms } = await inspectLivePaymentBoundary();
    await completeJudgeStep(0, "HTTP 402 VERIFIED");

    const [evidence, settlement, runtime] = await Promise.all([
      loadLiveV2Evidence(),
      loadOfficialSettlement(),
      loadV2Runtime(),
    ]);

    const primaryBreached = evidence.recovered?.primary?.verification?.status === "BREACH"
      && evidence.primaryPayment?.status === "success";
    if (!primaryBreached) throw new Error("The paid Primary breach is not fully bound");
    await completeJudgeStep(1, "PAID BREACH", "breach");

    const liveVerification = await window.RelayBondVerifier.verifyLiveCoordinatorEvidence(evidence);
    const { portableIntegrity, ...portablePayload } = evidence;
    const portablePassed = await sha256(portablePayload) === portableIntegrity.hash;
    const backupAccepted = evidence.recovered?.backup?.verification?.status === "ACCEPTED";
    if (!liveVerification.passed || !portablePassed || !backupAccepted) {
      throw new Error("Backup delivery or verifier signatures did not verify");
    }
    await completeJudgeStep(2, "ACCEPTED + SIGNED");

    const settlementChecks = Object.values(settlement.checks || {});
    const buyerUnchanged = settlement.balancesBefore?.buyerAtomic === settlement.balancesAfter?.buyerAtomic;
    const settlementPassed = settlement.status === "SETTLED_AND_VERIFIED"
      && settlementChecks.length === 7
      && settlementChecks.every(Boolean)
      && buyerUnchanged;
    if (!settlementPassed) throw new Error("The X Layer settlement invariants did not all pass");
    await completeJudgeStep(3, "7/7 ONCHAIN");

    const publicRuntimeReady = runtime.health?.status === "ok"
      && runtime.providers?.providers?.length === 2
      && runtime.readiness?.configuration?.configured === true;
    if (!publicRuntimeReady) throw new Error("The public Provider runtime is not ready");
    await completeJudgeStep(4, "JUDGE PASS");

    output.textContent = `$ RELAYBOND JUDGE PROOF — 5/5 VERIFIED\n\n1. LIVE PAYMENT BOUNDARY\n   HTTP 402 · ${terms.scheme} · ${terms.network}\n   Price: ${Number(terms.amount) / 1_000_000} ${terms.extra?.name || "USD₮0"}\n\n2. PAID PRIMARY BREACH\n   Payment: ${evidence.primaryPayment.status.toUpperCase()}\n   Result: ${evidence.recovered.primary.verification.status}\n   Transaction: ${evidence.primaryPayment.transactionHash}\n\n3. INDEPENDENT RECOVERY\n   Backup: ${evidence.recovered.backup.verification.status}\n   Final state: ${evidence.recovered.task.state}\n   Recovery signer: VERIFIED\n   Continuity signer: VERIFIED\n   Portable SHA-256: ${portablePassed ? "VERIFIED" : "FAILED"}\n\n4. X LAYER SETTLEMENT\n   Status: ${settlement.status}\n   Checks: ${settlementChecks.filter(Boolean).length}/7\n   Buyer balance unchanged: ${buyerUnchanged}\n   Settlement tx: ${settlement.transactionHash}\n\n5. VERDICT\n   ✓ Buyer paid once\n   ✓ Failed provider funded the Backup\n   ✓ Independent evidence verified in this browser\n   ✓ No new payment or transaction was created by this Judge Run\n\nResource: ${challenge.resource?.url}`;
    judgeRunState.textContent = "5/5 VERIFIED · BUYER PAID ONCE";
    officialState.textContent = "LIVE V2 RECOVERY VERIFIED";
    runState.textContent = "JUDGE PROOF PASSED";
    document.querySelector(".terminal")?.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    output.textContent = `$ JUDGE PROOF FAILED\n\n${error.message}\n\nNo success state was shown.`;
    judgeRunState.textContent = "FAIL-CLOSED";
    runState.textContent = "JUDGE PROOF FAILED";
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function verifyLiveSignatures() {
  verifyLiveButton.disabled = true;
  runState.textContent = "RECOVERING SIGNER";
  try {
    const promiseEvidence = await loadLiveEvidence("service-promise");
    const promiseResult = await window.RelayBondVerifier.verifyPromiseEvidence(promiseEvidence);
    let paidLine = "Paid Delivery Receipt: unavailable";
    try {
      const paidEvidence = await loadLiveEvidence("agentic-wallet-paid-delivery");
      const paidResult = await window.RelayBondVerifier.verifyPaidDelivery(paidEvidence.delivery);
      const integrityResult = window.RelayBondVerifier.verifyPaidEvidenceHash(paidEvidence);
      const { portableIntegrity, evidenceHash, ...unsigned } = paidEvidence;
      const portablePassed = await sha256(unsigned) === portableIntegrity.hash;
      const allChecks = Object.values(paidEvidence.verification.checks).every(Boolean);
      const paidPassed = paidResult.passed && integrityResult.passed && portablePassed && allChecks && paidEvidence.verification.status === "ACCEPTED";
      paidLine = `Paid Delivery:      ${paidPassed ? "ACCEPTED" : "FAILED"}\nDelivery checks:    ${Object.values(paidEvidence.verification.checks).filter(Boolean).length}/9\nEvidence Keccak:    ${integrityResult.passed ? "VERIFIED" : "FAILED"}\nPortable SHA-256:   ${portablePassed ? "VERIFIED" : "FAILED"}\nSettlement tx:      ${paidEvidence.payment.transactionHash}`;
      paidProof.textContent = paidPassed ? "ACCEPTED · 9/9" : "FAILED";
      const [breachEvidence, rebateEvidence] = await Promise.all([
        loadLiveEvidence("agentic-wallet-paid-breach"),
        loadLiveEvidence("rebate"),
      ]);
      const rebateChecks = rebateEvidence.verification;
      const rebatePassed = rebateChecks.receiptStatus === "success"
        && rebateChecks.blockPinnedStateMatched
        && rebateChecks.bondDeltaMatched
        && rebateChecks.breachEventMatched
        && rebateChecks.transferMatched
        && rebateEvidence.serviceActiveAfter === false;
      paidLine += `\n\nPaid Breach:        ${breachEvidence.verification.status}\nBreach reason:      ${breachEvidence.verification.violations.join(", ")}\nBound checks:       ${Object.values(breachEvidence.verification.checks).filter(Boolean).length}/9\nRebate:             ${rebatePassed ? "VERIFIED ONCHAIN" : "FAILED"}\nRebate tx:          ${rebateEvidence.transactionHash}\nBond after:         ${(Number(rebateEvidence.bondAfterAtomic) / 1_000_000).toFixed(2)} USD₮0\nService active:     ${rebateEvidence.serviceActiveAfter}`;
      paidProof.textContent = rebatePassed ? "ACCEPTED → BREACH → REBATED" : "REBATE VERIFY FAILED";
    } catch {
      // The Service Promise remains independently verifiable before the paid run.
    }
    output.textContent = `$ BROWSER EIP-712 RECOVERY\n\nService Promise: ${promiseResult.passed ? "VERIFIED" : "FAILED"}\nRecovered signer: ${promiseResult.recovered}\nExpected provider: ${promiseResult.expectedProvider}\nPromise digest:    ${promiseResult.calculatedHash}\nOnchain digest:    ${promiseResult.expectedHash}\n${paidLine}\n\n${promiseResult.passed ? "✓ The browser independently recovered the provider. No server-side trust required." : "✗ Signature or digest mismatch."}`;
    runState.textContent = promiseResult.passed ? "SIGNER VERIFIED" : "SIGNER FAILED";
  } catch (error) {
    output.textContent = `$ Signature verification failed\n${error.message}`;
    runState.textContent = "VERIFY FAILED";
  } finally {
    verifyLiveButton.disabled = false;
  }
}

async function loadPassport() {
  let response = await fetch("./evidence/live/reliability-passport.json", { cache: "no-store" });
  if (!response.ok) response = await fetch("./evidence/reliability-passport.json", { cache: "no-store" });
  if (!response.ok) return;
  const passport = await response.json();
  acceptanceRate.textContent = `${(passport.acceptanceRateBps / 100).toFixed(2)}%`;
  bondCoverage.textContent = `${passport.bondCoverageCalls} calls`;
  verifiedCalls.textContent = String(passport.calls);
}

async function runFlow() {
  runButton.disabled = true;
  runState.textContent = "LOCAL RECOVERY RUNNING";
  steps.forEach((step) => { step.className = ""; step.lastElementChild.textContent = "WAITING"; });
  output.textContent = "$ Loading deterministic double-pay-free recovery evidence…";
  const evidence = await loadContinuityEvidence();
  for (let index = 0; index < steps.length; index += 1) {
    const stage = evidence.stages[index];
    steps[index].classList.add("active");
    await wait(650);
    steps[index].classList.remove("active");
    steps[index].classList.add(index === 1 ? "breach" : "done");
    steps[index].lastElementChild.textContent = stage.state;
    output.textContent += `\n${index === 1 ? "!" : "✓"} ${stage.state}\n  ${stage.description}`;
  }
  output.textContent += `\n\nPrimary result:       ${evidence.primary.verification.status}\nBackup result:        ${evidence.recovery.verification.status}\nFinal state:          ${evidence.continuityReceipt.payload.finalStatus}\nBuyer paid:           ${(Number(evidence.economics.buyerPaidAtomic) / 1_000_000).toFixed(2)} USD₮0\nBackup funded by bond:${(Number(evidence.economics.fundedFromPrimaryBondAtomic) / 1_000_000).toFixed(2).padStart(6)} USD₮0\nBuyer double charged: ${evidence.economics.buyerDoubleCharged}\n\nEvidence hash\n${evidence.evidenceHash}\n\nMode: ${evidence.mode}`;
  runState.textContent = "RECOVERED · BUYER PAID ONCE";
  runButton.disabled = false;
}

async function runOfficialFlow() {
  runOfficialButton.disabled = true;
  officialState.textContent = "COORDINATOR RUNNING";
  officialSteps.forEach((step) => { step.className = ""; step.lastElementChild.textContent = "WAITING"; });
  try {
    const evidence = await loadOfficialEvidence();
    output.textContent = "$ OFFICIAL BUILD COORDINATOR\n\nPost-start automatic routing evidence loaded.";
    const events = evidence.recovered.task.events;
    for (let index = 0; index < officialSteps.length; index += 1) {
      const event = events[index];
      const step = officialSteps[index];
      step.classList.add("active");
      await wait(550);
      step.classList.remove("active");
      step.classList.add(event.state === "PRIMARY_BREACH" ? "breach" : "done");
      step.lastElementChild.textContent = event.state;
      output.textContent += `\n\n${event.state === "PRIMARY_BREACH" ? "!" : "✓"} ${event.state}\n  ${event.description}`;
    }
    let readinessText = "V2 deployment plan: unavailable";
    try {
      const { readiness, deployment, verification, bondPlan, bonding, settlementPlan } = await loadV2Readiness();
      readinessText = `V2 contract: TESTNET / DEPLOYED\nChain: ${deployment.chainId}\nAddress: ${deployment.address}\nDeployment tx: ${deployment.transactionHash}\nSource verified: ${verification.verified}\nProvider bonding verified: ${bonding.verificationPassed}\nPrimary bond before recovery: ${Number(bonding.final.primary.bondBalanceAtomic) / 1_000_000} USD₮0\nBackup bond: ${Number(bonding.final.backup.bondBalanceAtomic) / 1_000_000} USD₮0\nRegistration transactions: ${bondPlan.totalTransactionCount}\nLIVE evidence accepted: ${settlementPlan.evidenceValidation.checks.liveMode}\nSettlement broadcast: ${settlementPlan.broadcast}\nSettlement tx: ${settlementPlan.transactionHash}`;
    } catch {}
    output.textContent += `\n\nRecovered trail\n${events.map((event) => event.state).join(" → ")}\n\nFail-closed trail\n${evidence.frozen.task.events.map((event) => event.state).join(" → ")}\n\nRecovery Attestation digest\n${evidence.recoveryAttestationDigest}\n\nEvidence hash\n${evidence.evidenceHash}\n\n${readinessText}\n\nOnchain settlement: ${evidence.claims.onchainSettlement}\nMode: ${evidence.mode}`;
    officialState.textContent = "RECOVERED + FROZEN VERIFIED";
  } catch (error) {
    output.textContent = `$ Official coordinator failed\n${error.message}`;
    officialState.textContent = "RUN FAILED";
  } finally {
    runOfficialButton.disabled = false;
  }
}

async function loadLiveStatus() {
  try {
    const rebateEvidence = await loadLiveEvidence("rebate");
    const formattedBond = (Number(rebateEvidence.bondAfterAtomic) / 1_000_000).toFixed(2);
    liveBond.textContent = formattedBond;
    bond.textContent = formattedBond;
    bondStatus.textContent = rebateEvidence.serviceActiveAfter ? "ACTIVE" : "AUTO-PAUSED";
    bondStatus.className = rebateEvidence.serviceActiveAfter ? "live" : "paused";
  } catch {
    try {
      const bondEvidence = await loadLiveEvidence("bond");
      const formattedBond = (Number(bondEvidence.bondBalanceAtomic) / 1_000_000).toFixed(2);
      liveBond.textContent = formattedBond;
      bond.textContent = formattedBond;
    } catch {}
  }
  try {
    const balanceEvidence = await loadLiveEvidence("agentic-wallet-balance");
    walletFunding.textContent = (Number(balanceEvidence.balanceAtomic) / 1_000_000).toFixed(2);
  } catch {}
  try {
    const paidEvidence = await loadLiveEvidence("agentic-wallet-paid-delivery");
    const checks = Object.values(paidEvidence.verification.checks).filter(Boolean).length;
    paidProof.textContent = `${paidEvidence.verification.status} · ${checks}/9`;
    try {
      const breachEvidence = await loadLiveEvidence("agentic-wallet-paid-breach");
      if (breachEvidence.verification.status === "BREACH") {
        paidProof.textContent = "ACCEPTED → BREACH";
        try {
          const rebateEvidence = await loadLiveEvidence("rebate");
          if (rebateEvidence.verification?.receiptStatus === "success") paidProof.textContent = "ACCEPTED → BREACH → REBATED";
        } catch {}
      }
    } catch {}
  } catch {
    try {
      const settlement = await loadLiveEvidence("agentic-wallet-payment-settlement");
      if (settlement.onchainStatus === "success") paidProof.textContent = "Settlement confirmed";
    } catch {}
  }
}

async function loadV2Status() {
  try {
    const [{ readiness, deployment, verification, bonding, settlementPlan, liveCoordinator }, runtime] = await Promise.all([loadV2Readiness(), loadV2Runtime()]);
    const configured = [readiness.checks.primaryConfigured, readiness.checks.backupConfigured].filter(Boolean).length;
    const settlementVerified = settlementPlan.broadcast === true
      && Object.values(settlementPlan.settlementChecks || {}).length >= 7
      && Object.values(settlementPlan.settlementChecks || {}).every(Boolean);
    const publicRuntimeReady = runtime.health.status === "ok" && runtime.providers.providers?.length === 2 && runtime.readiness.configuration?.configured;
    v2PlanStatus.textContent = settlementVerified ? "TESTNET / SETTLED" : publicRuntimeReady ? "PUBLIC / BONDED" : bonding.verificationPassed ? "TESTNET / BONDED" : readiness.checks.v2Deployed && verification.verified ? "TESTNET / DEPLOYED" : "VERIFYING";
    v2PlanDetail.textContent = settlementVerified
      ? `${deployment.chainId} · ${deployment.address.slice(0, 6)}…${deployment.address.slice(-4)} · source verified · 2 registered / 1 active after recovery`
      : `${deployment.chainId} · block ${deployment.blockNumber.toLocaleString()} · ${deployment.address.slice(0, 6)}…${deployment.address.slice(-4)} · source ${verification.verified ? "verified" : "pending"} · ${runtime.providers.providers.length} endpoints`;
    v2SettlementStatus.textContent = settlementVerified ? "SETTLED / VERIFIED" : settlementPlan.ready ? "READY / NOT SENT" : "FAIL-CLOSED";
    v2ReadinessDetail.textContent = settlementVerified
      ? `${configured}/2 identities · buyer unchanged · Backup +0.01 USD₮0 · Primary bond 5.00 → 4.99 · tx ${settlementPlan.transactionHash.slice(0, 8)}…${settlementPlan.transactionHash.slice(-6)}`
      : `${configured}/2 identities · ${liveCoordinator.recovered.task.state} · Primary ${liveCoordinator.recovered.primary.verification.status} · Backup ${liveCoordinator.recovered.backup.verification.status}`;
  } catch {
    v2PlanStatus.textContent = "PENDING";
    v2SettlementStatus.textContent = "PENDING";
  }
}

async function verifyEvidence() {
  verifyButton.disabled = true;
  try {
    const evidence = await loadContinuityEvidence();
    const result = await window.RelayBondVerifier.verifyContinuityEvidence(evidence);
    const { portableIntegrity, ...portablePayload } = evidence;
    const calculated = await sha256(portablePayload);
    const portablePassed = calculated === portableIntegrity.hash;
    const economicsPassed = Object.values(result.economics).every(Boolean);
    const verified = result.passed && portablePassed;
    output.textContent = `$ BROWSER CONTINUITY VERIFICATION\n\nRecovered signer:    ${result.signer}\nExpected verifier:   ${result.expectedVerifier}\nSigner match:        ${result.signer.toLowerCase() === result.expectedVerifier.toLowerCase()}\nEconomics checks:    ${economicsPassed ? "ALL PASSED" : "FAILED"}\nBuyer paid once:     ${result.economics.buyerPaidOnce}\nBond funded backup:  ${result.economics.recoveryCoveredByBond}\nIndependent backup:  ${result.economics.independentProviders}\nEvidence Keccak:     ${result.evidenceHashPassed ? "VERIFIED" : "FAILED"}\nPortable SHA-256:    ${portablePassed ? "VERIFIED" : "FAILED"}\n\n${verified ? "✓ CONTINUITY VERIFIED — breach, backup delivery and recovery economics are independently bound." : "✗ FAILED — continuity evidence or signature was modified."}`;
    runState.textContent = verified ? "CONTINUITY VERIFIED" : "VERIFY FAILED";
  } catch (error) {
    output.textContent = `$ Verification error\n${error.message}`;
    runState.textContent = "VERIFY FAILED";
  } finally {
    verifyButton.disabled = false;
  }
}

async function verifyOfficialEvidence() {
  verifyOfficialButton.disabled = true;
  try {
    const evidence = await loadOfficialEvidence();
    const result = await window.RelayBondVerifier.verifyOfficialCoordinatorEvidence(evidence);
    const { portableIntegrity, ...portablePayload } = evidence;
    const portablePassed = await sha256(portablePayload) === portableIntegrity.hash;
    const verified = result.passed && portablePassed;
    output.textContent = `$ OFFICIAL BUILD BROWSER VERIFICATION\n\nRecovery signer:      ${result.recoverySigner}\nContinuity signer:    ${result.continuitySigner}\nExpected verifier:    ${result.expectedVerifier}\nAttestation digest:   ${result.calculatedAttestationDigest === result.expectedAttestationDigest ? "VERIFIED" : "FAILED"}\nRECOVERED terminal:   ${result.checks.recoveredTerminal}\nFROZEN terminal:      ${result.checks.frozenTerminal}\nBuyer bound:          ${result.checks.buyerPaidPrimary}\nNo onchain overclaim: ${result.checks.settlementHonesty}\nEvidence Keccak:      ${result.evidenceHashPassed ? "VERIFIED" : "FAILED"}\nPortable SHA-256:     ${portablePassed ? "VERIFIED" : "FAILED"}\n\n${verified ? "✓ OFFICIAL BUILD VERIFIED — automatic routing, recovery authorization and fail-closed behavior are independently bound." : "✗ FAILED — official build evidence was modified or overclaimed."}`;
    officialState.textContent = verified ? "BROWSER VERIFIED" : "VERIFY FAILED";
  } catch (error) {
    output.textContent = `$ Official verification error\n${error.message}`;
    officialState.textContent = "VERIFY FAILED";
  } finally {
    verifyOfficialButton.disabled = false;
  }
}

async function verifyLiveV2Evidence() {
  verifyV2LiveButton.disabled = true;
  try {
    const [evidence, { settlementPlan }] = await Promise.all([loadLiveV2Evidence(), loadV2Readiness()]);
    const result = await window.RelayBondVerifier.verifyLiveCoordinatorEvidence(evidence);
    const { portableIntegrity, ...portablePayload } = evidence;
    const portablePassed = await sha256(portablePayload) === portableIntegrity.hash;
    const settlementCheckValues = Object.values(settlementPlan.settlementChecks || {});
    const settlementChecksPassed = settlementPlan.ready
      && Object.values(settlementPlan.evidenceValidation.checks).every(Boolean)
      && Object.values(settlementPlan.onchainChecks).every(Boolean)
      && settlementPlan.broadcast === true
      && settlementCheckValues.length >= 7
      && settlementCheckValues.every(Boolean);
    const verified = result.passed && portablePassed && settlementChecksPassed;
    output.textContent = `$ LIVE V2 RECOVERY VERIFICATION\n\nPrimary payment tx:  ${evidence.primaryPayment.transactionHash}\nPrimary result:      ${evidence.recovered.primary.verification.status}\nBackup result:       ${evidence.recovered.backup.verification.status}\nFinal state:         ${evidence.recovered.task.state}\nBuyer paid once:     ${result.checks.buyerPaidOnce}\nIndependent backup: ${result.checks.independentProviders}\nRecovery from bond: ${result.checks.recoveryCoveredByBond}\nContinuity signer:  ${result.continuitySigner}\nRecovery signer:    ${result.recoverySigner}\nEvidence Keccak:    ${result.evidenceHashPassed ? "VERIFIED" : "FAILED"}\nPortable SHA-256:   ${portablePassed ? "VERIFIED" : "FAILED"}\nSettlement checks:  ${settlementChecksPassed ? "ALL PASSED · SETTLED ONCHAIN" : "FAILED"}\nSettlement tx:      ${settlementPlan.transactionHash}\nBuyer balance:      ${(Number(settlementPlan.balancesBefore.buyerAtomic) / 1_000_000).toFixed(2)} → ${(Number(settlementPlan.balancesAfter.buyerAtomic) / 1_000_000).toFixed(2)} USD₮0\nPrimary bond:       ${(Number(settlementPlan.balancesBefore.primaryBondAtomic) / 1_000_000).toFixed(2)} → ${(Number(settlementPlan.balancesAfter.primaryBondAtomic) / 1_000_000).toFixed(2)} USD₮0\nBackup wallet:      ${(Number(settlementPlan.balancesBefore.backupAtomic) / 1_000_000).toFixed(2)} → ${(Number(settlementPlan.balancesAfter.backupAtomic) / 1_000_000).toFixed(2)} USD₮0\n\n${verified ? "✓ LIVE RECOVERY SETTLED — real payment, objective breach, authenticated Backup, bond-funded compensation and buyer-paid-once economics are independently bound." : "✗ FAILED — live recovery or onchain settlement evidence did not verify."}`;
    officialState.textContent = verified ? "LIVE V2 RECOVERY VERIFIED" : "LIVE VERIFY FAILED";
  } catch (error) {
    output.textContent = `$ LIVE V2 verification error\n${error.message}`;
    officialState.textContent = "LIVE VERIFY FAILED";
  } finally {
    verifyV2LiveButton.disabled = false;
  }
}

runButton.addEventListener("click", () => runFlow().catch((error) => { output.textContent = `$ Run failed\n${error.message}`; runButton.disabled = false; }));
verifyButton.addEventListener("click", verifyEvidence);
probeButton.addEventListener("click", probeLivePayment);
verifyLiveButton.addEventListener("click", verifyLiveSignatures);
runOfficialButton.addEventListener("click", runOfficialFlow);
verifyOfficialButton.addEventListener("click", verifyOfficialEvidence);
verifyV2LiveButton.addEventListener("click", verifyLiveV2Evidence);
judgeRunButton.addEventListener("click", runJudgeProof);
judgeRunSecondaryButton.addEventListener("click", runJudgeProof);
loadPassport().catch(() => {});
loadLiveStatus().catch(() => {});
loadV2Status().catch(() => {});

if (new URLSearchParams(window.location.search).get("autorun") === "judge") {
  window.setTimeout(() => runJudgeProof(), 900);
}
