const runButton = document.querySelector("#run");
const verifyButton = document.querySelector("#verify");
const output = document.querySelector("#output");
const bond = document.querySelector("#bond");
const runState = document.querySelector("#run-state");
const acceptanceRate = document.querySelector("#acceptance-rate");
const bondCoverage = document.querySelector("#bond-coverage");
const verifiedCalls = document.querySelector("#verified-calls");
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
  runState.textContent = "RUNNING";
  bond.textContent = "5.00";
  steps.forEach((step) => { step.className = ""; step.lastElementChild.textContent = "WAITING"; });
  output.textContent = "$ Loading signed promise…";
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
  runState.textContent = "COMPLETE";
  runButton.disabled = false;
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
loadPassport().catch(() => {});
