import { cp, mkdir, rm } from "node:fs/promises";

const output = "public";

await rm(output, { recursive: true, force: true });
await mkdir(`${output}/evidence`, { recursive: true });
await cp("web", output, { recursive: true });
await cp("evidence/judge-run.json", `${output}/evidence/judge-run.json`);
await cp("evidence/reliability-passport.json", `${output}/evidence/reliability-passport.json`);

console.log("Vercel judge site assembled in public/ with portable evidence.");
