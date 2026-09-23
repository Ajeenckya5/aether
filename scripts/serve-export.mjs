import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const serveRoot = path.join(root, ".serve");
const link = path.join(serveRoot, "aether");

fs.mkdirSync(serveRoot, { recursive: true });
fs.rmSync(link, { recursive: true, force: true });
fs.symlinkSync(path.join(root, "out"), link);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  let target = path.resolve(serveRoot, decoded);
  if (target !== serveRoot && !target.startsWith(serveRoot + path.sep)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  if (!fs.existsSync(target) && !path.extname(target)) {
    const html = `${target}.html`;
    if (fs.existsSync(html)) target = html;
  }
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}

const server = http.createServer((request, response) => {
  const target = fileFor(request.url || "/");
  if (!target) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const type = types[path.extname(target)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  fs.createReadStream(target).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${serveRoot} at http://127.0.0.1:${port}/aether/`);
});
