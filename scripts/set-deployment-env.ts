import { chmod, readFile, rename, writeFile } from "node:fs/promises";

const evidence = JSON.parse(await readFile("evidence/live/deployment.json", "utf8")) as { address?: string };
if (!evidence.address || !/^0x[0-9a-fA-F]{40}$/.test(evidence.address)) throw new Error("Invalid deployment evidence");
const source = await readFile(".env", "utf8");
const lines = source.split("\n").filter((line) => !line.startsWith("QUALITY_BOND_VAULT_ADDRESS="));
const temporary = `.env.deployment-${process.pid}`;
await writeFile(temporary, `${lines.filter(Boolean).join("\n")}\nQUALITY_BOND_VAULT_ADDRESS=${evidence.address}\n`, { mode: 0o600 });
await rename(temporary, ".env");
await chmod(".env", 0o600);
console.log(JSON.stringify({ updated: true, name: "QUALITY_BOND_VAULT_ADDRESS", value: evidence.address }, null, 2));
