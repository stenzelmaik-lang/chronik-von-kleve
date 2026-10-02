import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const files = new Map([["/", ["index.html", "text/html; charset=utf-8"]], ["/index.html", ["index.html", "text/html; charset=utf-8"]], ["/style.css", ["style.css", "text/css; charset=utf-8"]], ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]], ["/model.mjs", ["model.mjs", "text/javascript; charset=utf-8"]], ["/icons.mjs", ["icons.mjs", "text/javascript; charset=utf-8"]]]);
const port = Number(process.env.CHRONIPLAY_CONCEPT_PORT || 8797);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local concept port.");
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const file = files.get(pathname);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'none'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
  if ((request.method !== "GET" && request.method !== "HEAD") || !file) { response.writeHead(404); response.end("Standalone concept: no API or application data."); return; }
  try { const data = await readFile(new URL(`./prototype/${file[0]}`, import.meta.url)); response.writeHead(200, { "Content-Type": file[1] }); response.end(request.method === "HEAD" ? undefined : data); }
  catch { response.writeHead(500); response.end("Concept asset unavailable."); }
});
server.on("error", (error) => { console.error(`Local concept not started: ${error.message}`); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`Synthetic concept only: http://127.0.0.1:${port}/`));
