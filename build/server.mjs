// Minimal static file server for local preview of the site/ folder.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = join(process.cwd(), "site");
const PORT = process.env.PORT || 4178;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    let fp = join(ROOT, p);
    try {
      const s = await stat(fp);
      if (s.isDirectory()) fp = join(fp, "index.html");
    } catch {
      if (!extname(fp)) fp = join(fp, "index.html");
    }
    const body = await readFile(fp);
    res.writeHead(200, { "Content-Type": TYPES[extname(fp)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
}).listen(PORT, () => console.log(`Home Payment Atlas preview at http://localhost:${PORT}`));
