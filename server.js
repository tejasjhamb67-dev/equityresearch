#!/usr/bin/env node
/**
 * LIQD — local research terminal server. Zero dependencies.
 *
 *   node server.js            → http://localhost:4200
 *   PORT=5000 node server.js  → custom port
 *
 * Serves the LIQD app (app/) and the report library (reports/), and exposes:
 *   GET  /api/reports          library index
 *   GET  /api/reports/:id      full report JSON
 *   POST /api/reports          save a report JSON body → reports/<id>.json (+ reindex)
 *   DELETE /api/reports/:id    remove a saved report (+ reindex)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const APP = path.join(ROOT, "app");
const REPORTS = path.join(ROOT, "reports");
const PORT = Number(process.env.PORT) || 4200;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function reindex() {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-index.js")], { stdio: "inherit" });
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function safeReportPath(id) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) return null;
  const p = path.join(REPORTS, id.endsWith(".json") ? id : id + ".json");
  return p.startsWith(REPORTS) ? p : null;
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, JSON.stringify({ error: "not found" }));
    send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);

  // --- API ---
  if (p === "/api/reports" && req.method === "GET") {
    return serveStatic(res, path.join(REPORTS, "index.json"));
  }
  if (p.startsWith("/api/reports/") && req.method === "GET") {
    const fp = safeReportPath(p.slice("/api/reports/".length));
    if (!fp) return send(res, 400, JSON.stringify({ error: "bad id" }));
    return serveStatic(res, fp);
  }
  if (p === "/api/reports" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 5e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const report = JSON.parse(body);
        for (const k of ["id", "ticker", "company", "sector", "rating", "date", "markdown"]) {
          if (!report[k]) throw new Error(`missing field: ${k}`);
        }
        const fp = safeReportPath(report.id);
        if (!fp) throw new Error("id must be a filename-safe slug");
        fs.writeFileSync(fp, JSON.stringify(report, null, 2) + "\n");
        reindex();
        send(res, 201, JSON.stringify({ saved: path.basename(fp) }));
      } catch (err) {
        send(res, 400, JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  if (p.startsWith("/api/reports/") && req.method === "DELETE") {
    const fp = safeReportPath(p.slice("/api/reports/".length));
    if (!fp || !fs.existsSync(fp)) return send(res, 404, JSON.stringify({ error: "not found" }));
    fs.unlinkSync(fp);
    reindex();
    return send(res, 200, JSON.stringify({ deleted: path.basename(fp) }));
  }

  // --- Static ---
  if (p.startsWith("/reports/")) {
    const fp = safeReportPath(p.slice("/reports/".length).replace(/\.json$/, ""));
    if (p === "/reports/index.json") return serveStatic(res, path.join(REPORTS, "index.json"));
    if (!fp) return send(res, 400, JSON.stringify({ error: "bad path" }));
    return serveStatic(res, fp);
  }
  const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
  const fp = path.normalize(path.join(APP, rel));
  if (!fp.startsWith(APP)) return send(res, 403, JSON.stringify({ error: "forbidden" }));
  serveStatic(res, fp);
});

server.listen(PORT, () => {
  console.log(`\n  LIQD research terminal\n  http://localhost:${PORT}\n`);
});
