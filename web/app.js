const runButton = document.querySelector("#run");
const verifyButton = document.querySelector("#verify");
const probeButton = document.querySelector("#probe");
const verifyLiveButton = document.querySelector("#verify-live");
const output = document.querySelector("#output");
const bond = document.querySelector("#bond");
const runState = document.querySelector("#run-state");
const acceptanceRate = document.querySelector("#acceptance-rate");
const bondCoverage = document.querySelector("#bond-coverage");
const verifiedCalls = document.querySelector("#verified-calls");
const liveBond = document.querySelector("#live-bond");
const walletFunding = document.querySelector("#wallet-funding");
const paidProof = document.querySelector("#paid-proof");
const steps = [...document.querySelectorAll("[data-step]")];

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
    let paidLine = "Paid Delivery Receipt: PENDING — not claimed yet";
    try {
      const paidEvidence = await loadLiveEvidence("agentic-wallet-paid-delivery");
      const paidResult = await window.RelayBondVerifier.verifyPaidDelivery(paidEvidence.delivery);
      paidLine = `Paid Delivery Receipt: ${paidResult.passed ? "VERIFIED" : "FAILED"}`;
      paidProof.textContent = paidResult.passed ? "Verified" : "Failed";
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
  const response = await fetch("./evidence/reliability-passport.json", { cache: "no-store" });
  if (!response.ok) return;
  const passport = await response.json();
  acceptanceRate.textContent = `${(passport.acceptanceRateBps / 100).toFixed(2)}%`;
  bondCoverage.textContent = `${passport.bondCoverageCalls} calls`;
  verifiedCalls.textContent = String(passport.calls);
}

async function runFlow() {
  runButton.disabled = true;
  runState.textContent = "LOCAL LAB RUNNING";
  bond.textContent = "5.00";
  steps.forEach((step) => { step.className = ""; step.lastElementChild.textContent = "WAITING"; });
  output.textContent = "$ Loading deterministic breach-lab evidence…";
  const evidence = await loadEvidence();
  const messages = [
    ["PROMISE VERIFIED", "Provider signature recovered. SLA hash is bound to the delivery receipt."],
    ["ACCEPTED", `Valid quote passed ${Object.keys(evidence.scenarios[0].verification.checks).length} deterministic checks.`],
    ["BREACH", `Paid response failed: ${evidence.scenarios[1].verification.violations.join(", ")}.`],
    ["REBATED", "Buyer +0.01 USDT0 · Provider bond 5.00 → 4.99 USDT0."],
  ];
  for (let index = 0; index < steps.length; index += 1) {
    steps[index].classList.add("active");
    await wait(700);
    steps[index].classList.remove("active");
    steps[index].classList.add(index === 2 ? "breach" : "done");
    steps[index].lastElementChild.textContent = messages[index][0];
    output.textContent += `\n✓ ${messages[index][0]}\n  ${messages[index][1]}`;
    if (index === 3) bond.textContent = "4.99";
  }
  output.textContent += `\n\nEvidence hash\n${evidence.evidenceHash}\n\nMode: ${evidence.mode}`;
  runState.textContent = "LOCAL LAB COMPLETE";
  runButton.disabled = false;
}

async function loadLiveStatus() {
  try {
    const bondEvidence = await loadLiveEvidence("bond");
    liveBond.textContent = (Number(bondEvidence.bondBalanceAtomic) / 1_000_000).toFixed(2);
  } catch {}
  try {
    const fundingEvidence = await loadLiveEvidence("agentic-wallet-funding");
    walletFunding.textContent = (Number(fundingEvidence.recipientBalanceAfterAtomic) / 1_000_000).toFixed(2);
  } catch {}
  try {
    await loadLiveEvidence("agentic-wallet-paid-delivery");
    paidProof.textContent = "Evidence published";
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
    const evidence = await loadEvidence();
    const { portableIntegrity, ...portablePayload } = evidence;
    const calculated = await sha256(portablePayload);
    const verified = calculated === portableIntegrity.hash;
    output.textContent = `$ Browser-side portable evidence verification\n\nAlgorithm: ${portableIntegrity.algorithm}\nExpected:   ${portableIntegrity.hash}\nCalculated: ${calculated}\n\n${verified ? "✓ VERIFIED — evidence is byte-for-byte intact" : "✗ FAILED — evidence was modified"}`;
    runState.textContent = verified ? "VERIFIED" : "TAMPERED";
  } catch (error) {
    output.textContent = `$ Verification error\n${error.message}`;
  } finally {
    verifyButton.disabled = false;
  }
}

runButton.addEventListener("click", () => runFlow().catch((error) => { output.textContent = `$ Run failed\n${error.message}`; runButton.disabled = false; }));
verifyButton.addEventListener("click", verifyEvidence);
probeButton.addEventListener("click", probeLivePayment);
verifyLiveButton.addEventListener("click", verifyLiveSignatures);
loadPassport().catch(() => {});
loadLiveStatus().catch(() => {});
