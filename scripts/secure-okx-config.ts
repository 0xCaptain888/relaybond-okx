import { createServer } from "node:http";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";

const host = "127.0.0.1";
const port = 4317;
const fields = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "X402_PAY_TO"] as const;

function page(message = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RelayBond Secure OKX Setup</title><style>
  :root{font-family:Inter,system-ui;color:#f4f6f1;background:#090b0d}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#25310f,#090b0d 48%)}main{width:min(520px,calc(100% - 32px));padding:30px;border:1px solid #30372d;border-radius:18px;background:#111418;box-shadow:0 25px 80px #0008}h1{margin:0 0 8px;font-size:28px}p{color:#9fa79d;line-height:1.5;font-size:13px}.safe{color:#ccff00}label{display:block;margin:18px 0 6px;font-size:12px;font-weight:700}input{width:100%;box-sizing:border-box;padding:13px;border-radius:8px;border:1px solid #343b40;background:#090b0d;color:white}button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:8px;background:#ccff00;color:#080a08;font-weight:800;cursor:pointer}.message{color:#ccff00}</style></head><body><main><p class="safe">LOCALHOST ONLY · NOTHING IS UPLOADED</p><h1>Secure OKX configuration</h1><p>Credentials are written only to gitignored <code>.env</code> with file mode 600. They are never displayed after saving.</p>${message ? `<p class="message">${message}</p>` : ""}<form method="post"><label>OKX API Key</label><input name="OKX_API_KEY" type="password" required autocomplete="off"><label>OKX Secret Key</label><input name="OKX_SECRET_KEY" type="password" required autocomplete="off"><label>OKX Passphrase</label><input name="OKX_PASSPHRASE" type="password" required autocomplete="off"><label>x402 receiving address</label><input name="X402_PAY_TO" required pattern="0x[0-9a-fA-F]{40}" autocomplete="off"><button>Save locally and close</button></form></main></body></html>`;
}

async function updateEnv(values: Record<string, string>) {
  const source = await readFile(".env", "utf8");
  const filtered = source.split("\n").filter((line) => !fields.some((field) => line.startsWith(`${field}=`)));
  const updated = [...filtered.filter(Boolean), ...fields.map((field) => `${field}=${values[field]}`), ""].join("\n");
  const temporary = `.env.okx-${process.pid}`;
  await writeFile(temporary, updated, { mode: 0o600 });
  await rename(temporary, ".env");
  await chmod(".env", 0o600);
}

const server = createServer(async (request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return response.end(page());
  }
  if (request.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    const values = Object.fromEntries(fields.map((field) => [field, params.get(field)?.trim() || ""]));
    if (fields.some((field) => !values[field]) || !/^0x[0-9a-fA-F]{40}$/.test(values.X402_PAY_TO)) {
      response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      return response.end(page("Nothing saved: all values are required and the receiving address must be valid."));
    }
    await updateEnv(values);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(page("Saved securely. You may close this tab."));
    setTimeout(() => server.close(), 500);
    return;
  }
  response.writeHead(405).end();
});

server.listen(port, host, () => {
  console.log(`Secure local setup: http://${host}:${port}`);
});
