import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

await access(".vercel/project.json");
const names = [
  "ALLOW_V2_PAID_BREACH",
  "BACKUP_PROVIDER_AUTH_TOKEN",
  "BACKUP_PROVIDER_SIGNING_KEY",
  "CONTINUITY_PROVIDERS_JSON",
  "PUBLIC_BASE_URL",
  "RECOVERY_BOND_VAULT_V2_ADDRESS",
  "SERVICE_PROMISE_VALID_UNTIL",
  "USDT0_ADDRESS",
  "V2_BACKUP_SERVICE_ID",
  "V2_PRIMARY_SERVICE_ID",
  "X402_PAY_TO",
] as const;
const missing = names.filter((name) => !process.env[name]);
if (missing.length > 0) throw new Error(`Missing local Vercel runtime values: ${missing.join(", ")}`);

async function setProductionValue(name: string, value: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["-y", "vercel@latest", "env", "add", name, "production", "--force"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Vercel rejected ${name}: ${stderr.trim() || `exit ${code}`}`));
    });
    child.stdin.end(`${value}\n`);
  });
}

for (const name of names) {
  await setProductionValue(name, process.env[name]!);
  console.log(`${name}: configured in Vercel Production`);
}
console.log(JSON.stringify({ configured: names.length, environment: "production", secretValuesPrinted: false }, null, 2));
