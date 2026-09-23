import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
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
  let decoded = "/";
  try {
    decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  } catch {
    return null;
  }
  const parts = [];
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || part.includes("\\") || part.includes("\0")) return null;
    if (!/^[\w.~-]+$/.test(part)) return null;
    parts.push(part);
  }
  let target = path.join(serveRoot, ...parts);
  const relative = path.relative(serveRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  if (!fs.existsSync(target) && !path.extname(target)) {
    const html = `${target}.html`;
    if (fs.existsSync(html)) target = html;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  const fileRelative = path.relative(serveRoot, target);
  if (fileRelative.startsWith("..") || path.isAbsolute(fileRelative)) return null;
  return target;
}

const server = http.createServer((request, response) => {
  const target = fileFor(request.url || "/");
  if (!target) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const type = types[path.extname(target)] || "application/octet-stream";
  const compressible = /\b(javascript|css|html|json|svg|text|manifest)/.test(type);
  const headers = { "Content-Type": type, "Cache-Control": "no-cache" };
  const encoding = request.headers["accept-encoding"] || "";
  if (compressible && encoding.includes("gzip")) {
    headers["Content-Encoding"] = "gzip";
    response.writeHead(200, headers);
    fs.createReadStream(target).pipe(zlib.createGzip()).pipe(response);
    return;
  }
  response.writeHead(200, headers);
  fs.createReadStream(target).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${serveRoot} at http://127.0.0.1:${port}/aether/`);
});
