import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = normalize(join(process.cwd(), "web"));
const evidenceRoot = normalize(join(process.cwd(), "evidence"));
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
    const localPath = pathname.startsWith("/evidence/")
      ? normalize(join(evidenceRoot, pathname.slice("/evidence/".length)))
      : normalize(join(root, pathname === "/" ? "index.html" : pathname));
    const allowedRoot = pathname.startsWith("/evidence/") ? evidenceRoot : root;
    if (!localPath.startsWith(`${allowedRoot}/`) && localPath !== allowedRoot) throw new Error("forbidden");
    const info = await stat(localPath);
    if (!info.isFile()) throw new Error("not found");
    response.writeHead(200, { "content-type": mime[extname(localPath)] || "application/octet-stream" });
    response.end(await readFile(localPath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => console.log(`RelayBond demo: http://localhost:${port}`));
