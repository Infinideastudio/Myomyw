import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

/**
 * Minimal static file server for the built web client, with SPA fallback to
 * index.html. Returns false if the directory does not exist.
 */
export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): boolean {
  if (!existsSync(join(root, "index.html"))) return false;
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  let file = normalize(join(root, pathname));
  if (!file.startsWith(normalize(root + sep)) && file !== normalize(root)) {
    res.writeHead(403).end();
    return true;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  const hashed = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(readFileSync(file));
  return true;
}
