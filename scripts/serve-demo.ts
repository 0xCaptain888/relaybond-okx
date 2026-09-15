import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = normalize(join(process.cwd(), "web"));
const port = Number(process.env.DEMO_PORT || 4173);
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
    const localPath = pathname === "/evidence/judge-run.json"
      ? join(process.cwd(), "evidence", "judge-run.json")
      : join(root, pathname === "/" ? "index.html" : pathname);
    if (!localPath.startsWith(root) && !localPath.includes("/evidence/judge-run.json")) throw new Error("forbidden");
    const info = await stat(localPath);
    if (!info.isFile()) throw new Error("not found");
    response.writeHead(200, { "content-type": mime[extname(localPath)] || "application/octet-stream" });
    response.end(await readFile(localPath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => console.log(`RelayBond demo: http://localhost:${port}`));
