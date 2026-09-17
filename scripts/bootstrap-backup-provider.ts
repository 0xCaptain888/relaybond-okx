import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const path = ".env";
let existing = "";
try {
  existing = await readFile(path, "utf8");
} catch {}
const values = new Map<string, string>();
for (const line of existing.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match) values.set(match[1]!, match[2]!);
}
let privateKey = values.get("BACKUP_PROVIDER_SIGNING_KEY") as `0x${string}` | undefined;
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
values.set("BACKUP_PROVIDER_SIGNING_KEY", privateKey);
values.set("BACKUP_PROVIDER_ADDRESS", account.address);
const preserved = existing
  .split(/\r?\n/)
  .filter((line) => line && !/^BACKUP_PROVIDER_(SIGNING_KEY|ADDRESS)=/.test(line));
const next = [...preserved, `BACKUP_PROVIDER_SIGNING_KEY=${privateKey}`, `BACKUP_PROVIDER_ADDRESS=${account.address}`, ""].join("\n");
const temporary = `.env.backup-provider-${process.pid}`;
await writeFile(temporary, next, { mode: 0o600 });
await rename(temporary, path);
await chmod(path, 0o600);
console.log(JSON.stringify({
  configured: true,
  address: account.address,
  file: path,
  permissions: "600",
  note: "The private key was generated or preserved locally and is intentionally never printed.",
}, null, 2));
