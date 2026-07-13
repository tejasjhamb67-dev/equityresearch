#!/usr/bin/env node
/**
 * Rebuilds reports/index.json from the report JSON files in reports/.
 * Run after adding, editing, or removing a report:  node scripts/build-index.js
 */
const fs = require("fs");
const path = require("path");

const reportsDir = path.join(__dirname, "..", "reports");
const indexPath = path.join(reportsDir, "index.json");

const entries = [];
for (const file of fs.readdirSync(reportsDir).sort()) {
  if (!file.endsWith(".json") || file === "index.json") continue;
  const full = path.join(reportsDir, file);
  let report;
  try {
    report = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (err) {
    console.error(`SKIP ${file}: invalid JSON (${err.message})`);
    process.exitCode = 1;
    continue;
  }
  const missing = ["id", "ticker", "company", "sector", "rating", "date", "markdown"].filter(
    (k) => !report[k]
  );
  if (missing.length) {
    console.error(`SKIP ${file}: missing fields ${missing.join(", ")}`);
    process.exitCode = 1;
    continue;
  }
  entries.push({
    id: report.id,
    file,
    ticker: report.ticker,
    company: report.company,
    sector: report.sector,
    reportType: report.reportType || "Company",
    rating: report.rating,
    conviction: report.conviction || null,
    priceTarget: report.priceTarget || null,
    currentPrice: report.currentPrice || null,
    upside: report.upside || null,
    timeframe: report.timeframe || null,
    date: report.date,
    thesis: report.thesis || "",
  });
}

entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.ticker.localeCompare(b.ticker)));

fs.writeFileSync(
  indexPath,
  JSON.stringify({ generated: new Date().toISOString(), count: entries.length, reports: entries }, null, 2) + "\n"
);
console.log(`Indexed ${entries.length} report(s) -> reports/index.json`);
