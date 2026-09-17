const runButton = document.querySelector("#run");
const verifyButton = document.querySelector("#verify");
const probeButton = document.querySelector("#probe");
const verifyLiveButton = document.querySelector("#verify-live");
const runOfficialButton = document.querySelector("#run-official");
const verifyOfficialButton = document.querySelector("#verify-official");
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

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

async function probeLivePayment() {
  probeButton.disabled = true;
  runState.textContent = "PROBING LIVE";
  try {
    const response = await fetch("/v1/provider/quote", {
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
    output.textContent = `$ LIVE x402 PAYMENT BOUNDARY\n\nHTTP:      402 Payment Required\nScheme:    ${terms.scheme}\nNetwork:   ${terms.network}\nAmount:    ${terms.amount} atomic (${Number(terms.amount) / 1_000_000} ${terms.extra?.name || "token"})\nAsset:     ${terms.asset}\nPayee:     ${terms.payTo}\nTimeout:   ${terms.maxTimeoutSeconds}s\nResource:  ${challenge.resource?.url}\n\n✓ No payment was signed. The browser inspected the live production challenge.`;
    runState.textContent = "LIVE 402 VERIFIED";
  } catch (error) {
    output.textContent = `$ Live probe failed\n${error.message}`;
    runState.textContent = "PROBE FAILED";
  } finally {
    probeButton.disabled = false;
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
    output.textContent += `\n\nRecovered trail\n${events.map((event) => event.state).join(" → ")}\n\nFail-closed trail\n${evidence.frozen.task.events.map((event) => event.state).join(" → ")}\n\nRecovery Attestation digest\n${evidence.recoveryAttestationDigest}\n\nEvidence hash\n${evidence.evidenceHash}\n\nOnchain settlement: ${evidence.claims.onchainSettlement}\nMode: ${evidence.mode}`;
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

runButton.addEventListener("click", () => runFlow().catch((error) => { output.textContent = `$ Run failed\n${error.message}`; runButton.disabled = false; }));
verifyButton.addEventListener("click", verifyEvidence);
probeButton.addEventListener("click", probeLivePayment);
verifyLiveButton.addEventListener("click", verifyLiveSignatures);
runOfficialButton.addEventListener("click", runOfficialFlow);
verifyOfficialButton.addEventListener("click", verifyOfficialEvidence);
loadPassport().catch(() => {});
loadLiveStatus().catch(() => {});
