# LIQD — Private Equity Research Desk

**LIQD** is an institutional-grade equity research product: a Claude-powered
research skill that generates Wall Street-style reports, and a private
research-library app to read, filter, and export them.

Built on the methodology of
[quant-sentiment-ai/claude-equity-research](https://github.com/quant-sentiment-ai/claude-equity-research)
(MIT), extended into a full product.

## How it works

```
"Equity Research: Metals"           "Equity Research: NVDA --detailed"
        │                                     │
        ▼                                     ▼
  LIQD research skill  ──  runs the full institutional framework
  (.claude/skills/equity-research)   (parallel web research, scenario
        │                             valuation, risk, technicals)
        ▼
  reports/*.json  ──  saved into your private library
        │
        ▼
  node server.js  →  http://localhost:4200  (the LIQD app)
```

## Using it

**1. Generate research** — in Claude Code, in this repo, say:

- `Equity Research: Metals` → sector note + full reports on the top picks
- `Equity Research: AAPL` → single-name institutional report
- Add `--detailed` for extended options-flow / insider / technical work

Claude runs the complete methodology and saves every report into `reports/`.

**2. Open the library:**

```bash
node server.js        # zero dependencies, Node 16+
# → http://localhost:4200
```

Browse the library, filter by sector/rating, open a report, download it as
Markdown, or print to PDF.

**3. Saving reports** — reports are plain JSON files in `reports/`. They are
saved automatically by the skill, or programmatically:

```bash
curl -X POST localhost:4200/api/reports -d @my-report.json
node scripts/build-index.js   # reindex after manual file edits
```

## Repository layout

```
app/                      LIQD web app (no build step, no dependencies)
reports/                  The library — one JSON per report + index.json
server.js                 Local server: app + report API
scripts/build-index.js    Rebuilds reports/index.json
framework/                Research methodology, report format, sector playbooks
.claude/skills/
  equity-research/        The skill that turns "Equity Research: X" into reports
```

## Report format

Each report is a JSON file with structured header fields (ticker, sector,
rating, price target, scenario probabilities…) plus the full report body in
Markdown. See `.claude/skills/equity-research/SKILL.md` for the schema and
`reports/aapl-2024-09-10.json` for an example.

## Disclaimer

For educational and research purposes only. Not financial advice. Past
performance does not guarantee future results. All investments carry risk of
loss. Consult qualified financial professionals before making investment
decisions.

## License

MIT — see [LICENSE](LICENSE). Research framework adapted from
quant-sentiment-ai/claude-equity-research (MIT).
