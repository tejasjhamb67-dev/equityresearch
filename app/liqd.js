/* LIQD — library + report reader. No dependencies.
   Data sources, in order: window.LIQD_DATA (embedded), /api/reports (server),
   reports/index.json (static hosting). */

(() => {
  const view = document.getElementById("view");
  const state = { index: [], reports: {}, q: "", sector: "", rating: "", sort: "date" };

  document.getElementById("todayLine").textContent = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const brand = document.getElementById("brandHome");
  brand.addEventListener("click", () => (location.hash = "#/"));
  brand.addEventListener("keydown", (e) => { if (e.key === "Enter") location.hash = "#/"; });

  // ————— data —————

  async function loadIndex() {
    if (window.LIQD_DATA) {
      state.index = window.LIQD_DATA.reports.map((r) => summarize(r));
      for (const r of window.LIQD_DATA.reports) state.reports[r.id] = r;
      return;
    }
    for (const url of ["/api/reports", "reports/index.json", "../reports/index.json"]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        state.index = data.reports || [];
        return;
      } catch (_) { /* try next */ }
    }
    state.index = [];
  }

  async function loadReport(id) {
    if (state.reports[id]) return state.reports[id];
    const entry = state.index.find((r) => r.id === id);
    const candidates = [`/api/reports/${id}`];
    if (entry && entry.file) candidates.push(`reports/${entry.file}`, `../reports/${entry.file}`);
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const report = await res.json();
        state.reports[id] = report;
        return report;
      } catch (_) { /* try next */ }
    }
    return null;
  }

  function summarize(r) {
    return {
      id: r.id, ticker: r.ticker, company: r.company, sector: r.sector,
      reportType: r.reportType || "Company", rating: r.rating, conviction: r.conviction,
      priceTarget: r.priceTarget, currentPrice: r.currentPrice, upside: r.upside,
      timeframe: r.timeframe, date: r.date, thesis: r.thesis || "",
    };
  }

  // ————— tiny markdown renderer —————

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function renderMarkdown(md) {
    const lines = esc(md).split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^\s*$/.test(line)) { i++; continue; }
      if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        const level = Math.max(2, h[1].length); // demote h1 -> h2 inside report body
        out.push(`<h${level}>${inline(h[2].replace(/\*\*/g, ""))}</h${level}>`);
        i++; continue;
      }

      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
        continue;
      }

      if (/^\s*\|/.test(line)) {
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        out.push(renderTable(rows));
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
        out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
        out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
        continue;
      }

      const para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|\s*\||---+\s*$|\s*[-*]\s|\s*>|\s*\d+\.\s)/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
    return out.join("\n");
  }

  function renderTable(rows) {
    const parse = (row) => row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
    const header = parse(rows[0]);
    const body = rows.slice(1).filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map(parse);
    return `<div class="table-wrap"><table>
      <thead><tr>${header.map((c) => `<th>${inline(c.replace(/\*\*/g, ""))}</th>`).join("")}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  }

  // ————— views —————

  const badgeClass = (rating) => (rating || "").toLowerCase().replace(/[^a-z]/g, "") || "ghost";
  const upsideClass = (u) => (typeof u === "string" && u.trim().startsWith("-") ? "neg" : "pos");
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  function renderLibrary() {
    const sectors = [...new Set(state.index.map((r) => r.sector))].sort();
    const ratings = [...new Set(state.index.map((r) => r.rating))].sort();

    let list = state.index.filter((r) => {
      const q = state.q.toLowerCase();
      const hitQ = !q || [r.ticker, r.company, r.sector, r.thesis].join(" ").toLowerCase().includes(q);
      return hitQ && (!state.sector || r.sector === state.sector) && (!state.rating || r.rating === state.rating);
    });
    if (state.sort === "ticker") list = [...list].sort((a, b) => a.ticker.localeCompare(b.ticker));
    else list = [...list].sort((a, b) => (a.date === b.date ? a.ticker.localeCompare(b.ticker) : a.date < b.date ? 1 : -1));

    view.innerHTML = `
      <div class="library-head">
        <h1 class="library-title">The Library</h1>
        <span class="library-count">${list.length} report${list.length === 1 ? "" : "s"}</span>
      </div>
      <div class="controls">
        <input type="search" id="q" placeholder="Search ticker, company, sector, thesis…" value="${esc(state.q)}" aria-label="Search reports">
        <select id="fSector" aria-label="Filter by sector">
          <option value="">All sectors</option>
          ${sectors.map((s) => `<option ${s === state.sector ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
        <select id="fRating" aria-label="Filter by rating">
          <option value="">All ratings</option>
          ${ratings.map((s) => `<option ${s === state.rating ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
        <select id="fSort" aria-label="Sort">
          <option value="date" ${state.sort === "date" ? "selected" : ""}>Newest first</option>
          <option value="ticker" ${state.sort === "ticker" ? "selected" : ""}>By ticker</option>
        </select>
      </div>
      ${list.length ? `<div class="grid">${list.map(cardHTML).join("")}</div>`
        : `<div class="empty">No reports match. Ask your research desk: “Equity Research: Metals”.</div>`}
    `;

    document.getElementById("q").addEventListener("input", (e) => { state.q = e.target.value; renderLibrary(); document.getElementById("q").focus(); const el = document.getElementById("q"); el.setSelectionRange(el.value.length, el.value.length); });
    document.getElementById("fSector").addEventListener("change", (e) => { state.sector = e.target.value; renderLibrary(); });
    document.getElementById("fRating").addEventListener("change", (e) => { state.rating = e.target.value; renderLibrary(); });
    document.getElementById("fSort").addEventListener("change", (e) => { state.sort = e.target.value; renderLibrary(); });
    view.querySelectorAll(".card").forEach((c) => {
      const go = () => (location.hash = `#/report/${c.dataset.id}`);
      c.addEventListener("click", go);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
  }

  function cardHTML(r) {
    return `
    <article class="card" data-id="${esc(r.id)}" tabindex="0" aria-label="${esc(r.ticker)} report">
      <div class="card-top">
        <div>
          <div class="card-ticker">${esc(r.ticker)}</div>
          <div class="card-company">${esc(r.company)}</div>
        </div>
        <span class="badge ${badgeClass(r.rating)}">${esc(r.rating)}</span>
      </div>
      <p class="card-thesis">${esc(r.thesis)}</p>
      <div class="card-stats">
        <div class="card-stat"><div class="k">Target</div><div class="v">${esc(r.priceTarget || "—")}</div></div>
        <div class="card-stat"><div class="k">Last</div><div class="v">${esc(r.currentPrice || "—")}</div></div>
        <div class="card-stat"><div class="k">Upside</div><div class="v ${upsideClass(r.upside)}">${esc(r.upside || "—")}</div></div>
      </div>
      <div class="card-foot">
        <span>${esc(r.sector)}${r.reportType === "Sector" ? " · Sector Note" : ""}</span>
        <span>${fmtDate(r.date)}</span>
      </div>
    </article>`;
  }

  async function renderReport(id) {
    view.innerHTML = `<div class="loading">Retrieving report…</div>`;
    const r = await loadReport(id);
    if (!r) { view.innerHTML = `<div class="empty">Report not found. <button class="back-link" onclick="location.hash='#/'">Return to the library</button></div>`; return; }

    const s = r.scenarios || {};
    const segs = ["bull", "base", "bear"].filter((k) => s[k] && s[k].probability);

    view.innerHTML = `
    <div class="report">
      <nav class="report-nav">
        <button class="back-link" id="backBtn">← Library</button>
        <div class="report-actions">
          <button class="action-btn" id="dlMd">Download .md</button>
          <button class="action-btn" id="printBtn">Print / PDF</button>
        </div>
      </nav>

      <header class="report-masthead">
        <div class="report-kicker">${esc(r.reportType === "Sector" ? "Sector Note" : "Equity Research")} · ${esc(r.sector)}</div>
        <h1 class="report-title">${esc(r.ticker)}</h1>
        <div class="report-company">${esc(r.company)}</div>
        <div class="report-meta">
          <span>${fmtDate(r.date)}</span><span class="sep">·</span>
          <span>${esc(r.analyst || "LIQD Research Desk")}</span><span class="sep">·</span>
          <span>${esc(r.timeframe || "12 months")}</span>
        </div>
      </header>

      <section class="verdict" aria-label="Recommendation summary">
        ${[
          ["Rating", r.rating, `rating-${badgeClass(r.rating)}`],
          ["Price target", r.priceTarget, ""],
          ["Last price", r.currentPrice, ""],
          ["Upside", r.upside, upsideClass(r.upside)],
          ["Conviction", r.conviction, ""],
          ["Sizing", r.positionSize, ""],
        ].map(([k, v, cls]) => {
          const val = v == null || v === "" ? "—" : String(v);
          return `<div class="cell"><div class="k">${k}</div><div class="v ${cls}${val.length > 8 ? " long" : ""}">${esc(val)}</div></div>`;
        }).join("")}
      </section>

      ${segs.length ? `
      <section class="scenarios" aria-label="Scenario probabilities">
        <div class="k">Scenario weighting</div>
        <div class="meter">
          ${segs.map((k) => `<div class="seg ${k}" style="flex:${s[k].probability}" title="${k} ${s[k].probability}%"></div>`).join("")}
        </div>
        <div class="meter-labels">
          ${segs.map((k) => `<div class="lbl" style="flex:${s[k].probability}"><span class="tag">${k}</span><b>${esc(s[k].target || "")}</b> · ${s[k].probability}%</div>`).join("")}
        </div>
      </section>` : ""}

      <article class="report-body">${renderMarkdown(r.markdown)}</article>

      <div class="report-disclaimer-note">LIQD · Private research library · Educational use only — not financial advice.</div>
    </div>`;

    document.getElementById("backBtn").addEventListener("click", () => (location.hash = "#/"));
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    document.getElementById("dlMd").addEventListener("click", () => {
      const md = `# ${r.ticker} — ${r.company}\n\n*${r.sector} · ${r.rating} · PT ${r.priceTarget || "n/a"} · ${r.date}*\n\n${r.markdown}\n`;
      const blob = new Blob([md], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${r.id}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    window.scrollTo(0, 0);
  }

  // ————— router —————

  async function route() {
    const hash = location.hash || "#/";
    const m = hash.match(/^#\/report\/(.+)$/);
    if (m) await renderReport(decodeURIComponent(m[1]));
    else renderLibrary();
  }

  window.addEventListener("hashchange", route);
  loadIndex().then(route);
})();
