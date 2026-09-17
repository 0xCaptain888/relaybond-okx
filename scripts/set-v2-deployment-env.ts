import { chmod, readFile, rename, writeFile } from "node:fs/promises";

const evidence = JSON.parse(await readFile("evidence/official-build/v2-deployment.json", "utf8")) as {
  address?: string;
  broadcast?: boolean;
};
if (!evidence.broadcast || !evidence.address || !/^0x[0-9a-fA-F]{40}$/.test(evidence.address)) {
  throw new Error("Confirmed V2 deployment evidence is required.");
}

const source = await readFile(".env", "utf8");
const lines = source.split("\n").filter((line) => !line.startsWith("RECOVERY_BOND_VAULT_V2_ADDRESS="));
const temporary = `.env.v2-deployment-${process.pid}`;
await writeFile(
  temporary,
  `${lines.filter(Boolean).join("\n")}\nRECOVERY_BOND_VAULT_V2_ADDRESS=${evidence.address}\n`,
  { mode: 0o600 },
);
await rename(temporary, ".env");
await chmod(".env", 0o600);
console.log(JSON.stringify({ updated: true, name: "RECOVERY_BOND_VAULT_V2_ADDRESS", value: evidence.address }, null, 2));
