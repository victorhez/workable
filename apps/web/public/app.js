// Workable front end. Works against the local server (live + demo) or as a static site (demo in the browser).
const $ = (s) => document.querySelector(s);
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n, d = 2) => (n == null ? "–" : "$" + Number(n).toFixed(d));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const when = (iso) => (iso || "").replace("T", " ").slice(0, 16);
const ACTS = { field_work: "Field work / spraying", plant: "Planting", harvest: "Harvest & dry", mine: "Mine / quarry rain delay" };
const SOIL_NAMES = { sand: "Sand", loamy_sand: "Loamy sand", sandy_loam: "Sandy loam", loam: "Loam", clay_loam: "Clay loam", clay: "Clay" };
const I = {
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2 11h11l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M21 20c0-2-1.5-4-4-4.7"/></svg>',
  tractor: '<svg viewBox="0 0 24 24"><circle cx="7" cy="16" r="4"/><circle cx="18" cy="17" r="3"/><path d="M7 12V6h6l2 6h4v5M13 6v6h2"/></svg>',
  mine: '<svg viewBox="0 0 24 24"><path d="M3 20l6-9 4 5 3-4 5 8z"/><path d="M14 6l3-3M17 6l-3-3"/></svg>',
  cloud: '<svg viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/><path d="M9 21l1-2M13 21l1-2"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-3.8M8.2 13l7.6 3.8"/></svg>',
};

let SERVER = null;
async function detect() {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local) try { const r = await fetch("api/health"); if (r.ok) { const j = await r.json(); if (j.server) SERVER = j; } } catch {}
  const pill = $("#netpill");
  if (SERVER?.live) { pill.textContent = "● Live purchasing on"; pill.className = "netpill live"; }
  else { pill.textContent = "● Demo: recorded receipts"; pill.className = "netpill demo"; }
}
async function get(apiPath, staticPath) {
  const r = await fetch(SERVER ? apiPath : staticPath);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

let STATE = { mode: "demo", site: null, activity: "field_work", soil: null, s0: 1 };
try { Object.assign(STATE, JSON.parse(localStorage.getItem("workable") || "{}")); } catch {}
const save = () => { try { localStorage.setItem("workable", JSON.stringify(STATE)); } catch {} };

// ---------- Overview ----------
async function viewOverview() {
  const [stats, list] = await Promise.all([get("api/stats", "data/stats.json"), get("api/decisions", "data/decisions.json")]);
  const latest = list.find((d) => d.mode === "live") || list[0];
  const v = stats.verdicts || {};
  const total = (v.GO || 0) + (v.WAIT || 0) + (v.AVOID || 0);
  app.innerHTML = `
  <section class="hero">
    <div>
      <span class="eyebrow">${I.drop.replace("<svg", '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"')} Mission 06 · Agriculture &amp; resources</span>
      <h1>A rain forecast is not a decision. <em>Workable makes it one.</em></h1>
      <p class="lead">"12 mm tomorrow" doesn't tell a farmer whether clay soil will carry a tractor on Thursday. Workable's agent buys the forecast through Telegraph by itself, models how the soil will drain, and answers in one word: <b>GO</b>, <b>WAIT</b> or <b>AVOID</b>, with the reasons, the cost and the receipts.</p>
      <div class="hero-cta">
        <a class="btn btn-accent" href="#/decide">Try a decision ${I.arrow}</a>
        <a class="btn" href="#/scoreboard">See how accurate it is</a>
      </div>
      <div class="hero-proof">
        <span>${I.check} Bought autonomously, no human approves each purchase</span>
        <span>${I.check} Rules in code, not guessed by AI</span>
        <span>${I.check} Every call scored against real weather</span>
      </div>
    </div>
    ${latest ? `<a href="#/d/${latest.id}" style="text-decoration:none;color:inherit"><div class="mock">
      <div class="mock-top"><span>${esc(latest.location)}</span><span class="pill ${latest.mode}">${latest.mode === "live" ? "live purchase" : "demo"}</span></div>
      <div class="mock-verdict ${latest.verdict}">${esc(latest.verdict)}${latest.wait_days ? ` ${latest.wait_days} day${latest.wait_days > 1 ? "s" : ""}` : ""}</div>
      <div class="muted small">${esc(ACTS[latest.activity])} · ${esc(SOIL_NAMES[latest.soil])}</div>
      <div class="mock-row mt"><span class="muted">Intelligence bought</span><b>${money(latest.cost_usd)}</b></div>
      <div class="mock-row"><span class="muted">Source</span><b>Telegraph · WEATHER_FORECAST_GENERAL</b></div>
      <div class="mock-row"><span class="muted">Decided</span><b>${esc(when(latest.created_at))} UTC</b></div>
    </div></a>` : ""}
  </section>

  <div class="grid g4 mt2">
    ${kpi("Decisions made", stats.decisions, `${stats.live_decisions} with live purchases`, I.drop, "b")}
    ${kpi("Forecasts bought", stats.purchases, `from ${stats.miners_used.length || "–"} Telegraph miner${stats.miners_used.length === 1 ? "" : "s"}`, I.cart, "a")}
    ${kpi("Intelligence spend", money(stats.spend_usd), `about ${money(stats.avg_cost_per_decision_usd, 3)} per decision`, I.coin, "c")}
    ${kpi("Reproduced exactly", stats.reproduced_pct == null ? "–" : stats.reproduced_pct + "%", `${stats.reproduced}/${stats.decisions} re-run from stored inputs`, I.repeat, "d")}
  </div>

  <div class="grid g3 mt2">
    <div class="card span2">
      <div class="card-head"><h2>How a decision is made</h2><span class="pill soft">about 2 minutes live</span></div>
      <div class="grid g2">
        ${step(1, "Pick the site and the job", "Location, activity (plant, field work, harvest, mine haul roads) and soil type. The thresholds that will be used are shown up front.")}
        ${step(2, "The agent buys the forecast", "Four forecast windows (24 to 120 hours) from ranked Telegraph miners, paid from escrow with no human approval, each with an on-chain receipt.")}
        ${step(3, "Code does the soil math", "A soil-water model adds rain, removes evaporation and drains the excess day by day, then fixed rules give GO, WAIT n days or AVOID.")}
        ${step(4, "It gets checked later", "After the outcome date, the same rules are run on the weather that actually happened. Right or wrong, it goes on the scoreboard.")}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Verdict mix</h2><span class="muted small">${total} decisions</span></div>
      ${donut(v, total)}
    </div>
  </div>

  <div class="card mt2">
    <div class="card-head"><h2>Recent decisions</h2><a class="btn" href="#/decisions">View all ${I.arrow}</a></div>
    ${decisionsTable(list.slice(0, 6))}
  </div>

  <div class="grid g3 mt2">
    ${feat(I.people, "a", "Extension agents & agro-dealers", "Give hundreds of farmers advice they can defend, logged with sources, in English and Pidgin, shareable on WhatsApp.")}
    ${feat(I.tractor, "b", "Commercial farms", "Plan field work, spraying and harvest around soil that is actually workable, not just around the rain icon.")}
    ${feat(I.mine, "c", "Mines & quarries", "Days-to-impact for haul-road rain delays, so shifts and material moves can be planned before the rain arrives.")}
  </div>

  <div class="card mt2">
    <div class="card-head"><h2>Why you can trust a Workable decision</h2></div>
    <div class="grid g4">
      ${feat(I.receipt, "a", "Receipts", "What was bought, from which miner, at what price, with the on-chain hash.", true)}
      ${feat(I.code, "b", "Rules in code", "The soil model and thresholds are open and versioned. No AI makes up a number.", true)}
      ${feat(I.target, "c", "Scored on reality", "Forecast error by horizon and cost per correct decision, sample size stated.", true)}
      ${feat(I.repeat, "d", "Reproducible", "Any decision re-runs from its stored inputs and must give the same answer.", true)}
    </div>
  </div>`;
}
const kpi = (label, val, foot, icon, tone) => `<div class="card kpi"><div class="kpi-top">${label}<span class="ico ${tone}">${icon}</span></div><div class="kpi-val">${esc(val)}</div><div class="kpi-foot">${esc(foot)}</div></div>`;
const step = (n, t, p) => `<div class="step"><div class="step-n">${n}</div><h3>${t}</h3><p>${p}</p></div>`;
const feat = (icon, tone, t, p, bare) => `<div class="${bare ? "feat" : "card feat"}"><span class="ico ${tone}">${icon}</span><h3>${t}</h3><p>${p}</p></div>`;
function donut(v, total) {
  if (!total) return `<div class="empty">No decisions yet.</div>`;
  const parts = [["GO", "var(--go)"], ["WAIT", "var(--wait)"], ["AVOID", "var(--avoid)"]];
  const R = 46, C = 2 * Math.PI * R; let off = 0;
  const arcs = parts.map(([k, col]) => { const f = (v[k] || 0) / total; const a = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${col}" stroke-width="16" stroke-dasharray="${f * C} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${k}: ${v[k] || 0}</title></circle>`; off += f * C; return a; }).join("");
  return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="Verdict mix"><circle r="${R}" cx="60" cy="60" fill="none" stroke="var(--line)" stroke-width="16"/>${arcs}
    <text x="60" y="58" text-anchor="middle" font-size="22" font-weight="800" fill="var(--ink)">${total}</text><text x="60" y="76" text-anchor="middle" font-size="10" fill="var(--muted)">decisions</text></svg>
    <div class="donut-legend">${parts.map(([k, col]) => `<span><i class="sw" style="background:${col}"></i>${k}<b style="margin-left:auto;padding-left:14px">${Math.round(((v[k] || 0) / total) * 100)}%</b></span>`).join("")}</div></div>`;
}
function decisionsTable(list) {
  if (!list.length) return `<div class="empty">${I.drop}<div>No decisions yet. <a href="#/decide">Make the first one</a>.</div></div>`;
  return `<div class="scroll"><table><thead><tr><th>Decision</th><th>Site</th><th>Activity</th><th>Verdict</th><th>Cost</th><th>Source</th><th>When (UTC)</th></tr></thead><tbody>
  ${list.map((r) => `<tr><td><a href="#/d/${r.id}">${r.id}</a></td><td>${esc(r.location)}</td><td>${esc(ACTS[r.activity])}</td>
    <td><span class="pill ${r.verdict}">${esc(r.verdict)}${r.wait_days ? " " + r.wait_days + "d" : ""}</span></td><td>${money(r.cost_usd)}</td>
    <td><span class="pill ${r.mode}">${r.mode === "live" ? "live" : "demo"}</span></td><td class="muted">${esc(when(r.created_at))}</td></tr>`).join("")}
  </tbody></table></div>`;
}

// ---------- Decide ----------
async function viewDecide() {
  const [sites, config] = await Promise.all([get("api/sites", "data/sites.json"), get("api/config", "data/config.json")]);
  if (!STATE.site || !sites.find((s) => s.id === STATE.site)) STATE.site = (sites.find((s) => s.demo) || sites[0]).id;
  const site = sites.find((s) => s.id === STATE.site);
  STATE.soil ??= site.soil;
  const canLive = !!SERVER?.live;
  if (!canLive) STATE.mode = "demo";
  const soil = config.soils[STATE.soil];
  app.innerHTML = `
    <div class="page-head"><div><h1>Make a decision</h1><p class="sub">Choose a site, the job and the soil. The agent buys the forecast; the engine decides.</p></div></div>
    <div class="grid" style="grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:18px" id="decide-grid">
      <div class="card">
        <div class="grid" style="gap:12px">
          <div><label for="site">Site</label><select id="site">${sites.map((s) => `<option value="${s.id}" ${s.id === STATE.site ? "selected" : ""}>${esc(s.location)}${s.demo ? "" : " (live only)"}</option>`).join("")}</select>
            <div class="muted small" style="margin-top:4px">${esc(site.climate || "")}</div></div>
          <div><label for="act">Activity</label><select id="act">${Object.entries(ACTS).map(([k, v]) => `<option value="${k}" ${k === STATE.activity ? "selected" : ""}>${v}</option>`).join("")}</select></div>
          <div><label for="soil">Soil type</label><select id="soil">${Object.keys(config.soils).map((k) => `<option value="${k}" ${k === STATE.soil ? "selected" : ""}>${SOIL_NAMES[k]}</option>`).join("")}</select></div>
          <div><label for="s0">How wet is the soil now?</label><select id="s0">${[[1, "Wet (at field capacity)"], [0.9, "Moist"], [0.7, "Fairly dry"]].map(([v, t]) => `<option value="${v}" ${+v === +STATE.s0 ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="thresholds">
          <div><b>${soil.fc_mm} mm</b>field capacity</div><div><b>≤ ${Math.round(soil.workable_frac * soil.fc_mm)} mm</b>workable below</div>
          <div><b>${Math.round(soil.drain_frac * 100)}%/day</b>excess drains</div><div><b>${config.rules.et_mm_day} mm/day</b>evaporation</div>
        </div>
        <p class="muted small">Config ${esc(config.version)}, placeholder values. <a href="#/method">See all rules</a></p>
        <label>Mode</label>
        <div class="seg" role="group" aria-label="Mode">
          <button data-mode="demo" class="${STATE.mode === "demo" ? "on" : ""}">Demo</button>
          <button data-mode="live" class="${STATE.mode === "live" ? "on" : ""}" ${canLive ? "" : "disabled title='Live mode runs on the local server with a funded Telegraph account'"}>Live purchase</button>
        </div>
        <p class="muted small">${STATE.mode === "live" ? "Buys 4 forecast windows through Telegraph now: about $0.04, 1 to 4 minutes." : "Replays a real forecast bought earlier through Telegraph, with its receipts. No funds needed."}</p>
        <button class="btn btn-accent" id="go" style="width:100%;justify-content:center">Decide ${I.arrow}</button>
      </div>
      <div id="out"><div class="card empty">${I.cloud}<div><b>Your decision will appear here</b><br>with the reasons, the soil-water chart, the cost and the Telegraph receipts.</div></div></div>
    </div>`;
  if (innerWidth < 860) $("#decide-grid").style.gridTemplateColumns = "1fr";
  $("#site").onchange = (e) => { STATE.site = e.target.value; STATE.soil = sites.find((s) => s.id === STATE.site).soil; save(); viewDecide(); };
  $("#act").onchange = (e) => { STATE.activity = e.target.value; save(); };
  $("#soil").onchange = (e) => { STATE.soil = e.target.value; save(); viewDecide(); };
  $("#s0").onchange = (e) => { STATE.s0 = +e.target.value; save(); };
  app.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { STATE.mode = b.dataset.mode; save(); viewDecide(); }));
  $("#go").onclick = () => runDecide(site, config);
}

async function runDecide(site, config) {
  const btn = $("#go"); btn.disabled = true;
  const out = $("#out");
  out.innerHTML = `<div class="card empty"><span class="spin"></span> ${STATE.mode === "live" ? "The agent is buying forecasts through Telegraph. This can take a few minutes." : "Running the engine on recorded receipts…"}</div>`;
  try {
    let rec;
    if (SERVER) {
      const r = await fetch("api/decide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ location: site.location, site_id: site.id, activity: STATE.activity, soil: STATE.soil, initial_storage_frac: STATE.s0, mode: STATE.mode }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Decide failed");
      rec = j.record;
    } else rec = await decideInBrowser(site);
    out.innerHTML = decisionHTML(rec, config);
    wireShare();
  } catch (e) {
    out.innerHTML = `<div class="note err">${esc(e.message)}</div>`;
  } finally { btn.disabled = false; }
}

async function decideInBrowser(site) {
  if (!window.Workable) throw new Error("Engine bundle missing. Run npm run build.");
  const all = await get(null, "data/demo-forecasts.json");
  const forecast = all[slug(site.location)];
  if (!forecast) throw new Error(`No recorded forecast for ${site.location} yet.`);
  const input = { activity: STATE.activity, soil: STATE.soil, initial_storage_frac: STATE.s0, failed_windows: forecast.windows.filter((w) => !w.parsed).length, days: forecast.days.map((d) => ({ date: d.date, rain_mm: d.rain_mm, pop_pct: d.pop_pct, tmax_c: d.tmax_c, tmin_c: d.tmin_c })) };
  const decision = window.Workable.decide(input);
  return { id: "browser-demo", created_at: new Date().toISOString(), site: { location: site.location }, input, decision, forecast, cost_usd: forecast.cost_usd, mode: "demo", outcome_date: forecast.days.at(-1)?.date };
}

// ---------- Decision card ----------
function chartSVG(rec, config) {
  const p = rec.decision.path; if (!p.length) return "";
  const soil = config?.soils?.[rec.input.soil]; const W = 640, H = 210, L = 36, R = 10, T = 18, B = 30;
  const maxRain = Math.max(10, ...p.map((d) => d.rain_mm));
  const maxS = soil ? soil.sat_mm : Math.max(...p.map((d) => d.storage_mm), 1);
  const bw = (W - L - R) / p.length;
  const x = (i) => L + i * bw + bw / 2, yS = (v) => T + (H - T - B) * (1 - v / maxS), yR = (v) => (H - B) - (H - T - B) * 0.45 * (v / maxRain);
  const thr = soil ? soil.workable_frac * soil.fc_mm : null;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Forecast rain bars and soil water line by day">
    ${p.map((d, i) => `<rect x="${L + i * bw + bw * 0.25}" y="${yR(d.rain_mm)}" width="${bw * 0.5}" height="${Math.max(1, (H - B) - yR(d.rain_mm))}" rx="4" fill="var(--bar)" opacity="${d.estimated ? 0.45 : 0.9}"><title>${d.date}: ${d.rain_mm} mm${d.estimated ? " (estimated from probability)" : ""}</title></rect>`).join("")}
    ${thr !== null ? `<line x1="${L}" x2="${W - R}" y1="${yS(thr)}" y2="${yS(thr)}" stroke="var(--thresh)" stroke-dasharray="5 4"/><text x="${W - R}" y="${yS(thr) - 5}" text-anchor="end" font-size="11" fill="var(--thresh)">workable at or below ${thr.toFixed(0)} mm</text>` : ""}
    <polyline points="${p.map((d, i) => `${x(i)},${yS(d.storage_mm)}`).join(" ")}" fill="none" stroke="var(--soil)" stroke-width="2.5" stroke-linejoin="round"/>
    ${p.map((d, i) => `<circle cx="${x(i)}" cy="${yS(d.storage_mm)}" r="5" fill="${d.workable ? "var(--go)" : "var(--soil)"}" stroke="var(--panel)" stroke-width="2"><title>${d.date}: soil water ${d.storage_mm} mm${d.workable ? " (workable)" : ""}</title></circle>`).join("")}
    ${p.map((d, i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--muted)">${d.date.slice(5)}</text>`).join("")}
    <text x="${L}" y="12" font-size="11" fill="var(--muted)">soil water (line, green dot = workable) · forecast rain (bars)</text>
  </svg>`;
}

function decisionHTML(rec, config) {
  const d = rec.decision; const f = rec.forecast || {};
  const head = d.verdict + (d.wait_days ? ` ${d.wait_days} day${d.wait_days > 1 ? "s" : ""}` : "");
  const place = rec.site.location.split(",")[0];
  const msgEn = window.Workable ? window.Workable.message(d, rec.input.activity, place, "en") : "";
  const msgPcm = window.Workable ? window.Workable.message(d, rec.input.activity, place, "pcm") : "";
  const notes = (f.notes || []).map((n) => (/estimates it from the rain probability/.test(n) ? n + " Those days show as faded bars." : n));
  if (d.flags.includes("rain_mm_estimated_from_probability") && !notes.some((n) => /probability/.test(n))) notes.push("Some daily rain amounts were estimated from rain probability (faded bars).");
  return `
  <div class="verdict ${d.verdict}">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
      <div><div class="big">${esc(head)}</div><div class="muted" style="margin-top:6px">${esc(ACTS[rec.input.activity])} · ${esc(rec.site.location)} · ${esc(SOIL_NAMES[rec.input.soil])}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill soft">confidence ${esc(d.confidence)}</span><span class="pill ${rec.mode}">${rec.mode === "live" ? "live purchase" : "recorded receipts"}</span></div>
    </div>
    <ul class="reasons">${d.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    <div><b>What would change it:</b> ${esc(d.would_change)}</div>
    <div class="muted small" style="margin-top:8px">Days until workable: ${d.days_to_workable === null ? "not within the forecast" : d.days_to_workable} · config ${esc(d.config_version)}${rec.id !== "browser-demo" ? ` · decision <a href="#/d/${rec.id}">${rec.id}</a>` : ""}</div>
  </div>
  ${notes.map((n) => `<div class="note">${esc(n)}</div>`).join("")}
  <div class="card mt"><div class="card-head"><h2>Soil-water path</h2></div>${chartSVG(rec, config)}</div>
  <div class="card mt">
    <div class="card-head"><h2>Cost and receipts</h2><span class="pill soft">${money(rec.cost_usd)} total</span></div>
    <p class="muted small" style="margin-top:0">Bought ${esc(when(f.bought_at))} UTC through Telegraph, intent <code>WEATHER_FORECAST_GENERAL</code>.</p>
    <div class="scroll"><table><thead><tr><th>Window</th><th>Rain</th><th>Chance</th><th>Temp</th><th>Cost</th><th>Miner and on-chain receipt</th></tr></thead><tbody>
    ${(f.windows || []).map((w) => `<tr><td><b>${w.window_hours}h</b></td>
      <td>${w.parsed?.rain_mm ?? "–"}${w.parsed?.rain_mm != null ? " mm" : ""}</td><td>${w.parsed?.pop_pct ?? "–"}${w.parsed?.pop_pct != null ? "%" : ""}</td>
      <td>${w.parsed && (w.parsed.temp_min_c != null || w.parsed.temp_max_c != null) ? `${w.parsed.temp_min_c ?? "?"}–${w.parsed.temp_max_c ?? "?"} °C` : "–"}</td><td>${money(w.cost_usd)}</td>
      <td>${w.error ? `<span class="pill AVOID">failed</span> <span class="muted small">${esc(w.error)}</span>` : `${esc(w.miner_label || "routed by Telegraph node")}<br><span class="mono muted">${esc(w.receipt_hash || "")}</span>${(w.parsed?.sources || []).length ? `<br><span class="muted small">data: ${esc(w.parsed.sources.join(", "))}</span>` : ""}`}</td></tr>`).join("")}
    </tbody></table></div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2>Send it to the field</h2>
      <div class="seg"><button data-lang="en" class="on">English</button><button data-lang="pcm">Pidgin</button></div></div>
    <div class="msg" id="msg">${esc(msgEn)}</div>
    <div style="margin-top:12px"><a class="btn btn-brand" id="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msgEn)}">${I.share} Share on WhatsApp</a></div>
    <textarea hidden id="pcm">${esc(msgPcm)}</textarea><textarea hidden id="en">${esc(msgEn)}</textarea>
  </div>`;
}
function wireShare() {
  app.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => {
    app.querySelectorAll("[data-lang]").forEach((x) => x.classList.toggle("on", x === b));
    const t = $("#" + b.dataset.lang).value; $("#msg").textContent = t; $("#wa").href = "https://wa.me/?text=" + encodeURIComponent(t);
  }));
}

// ---------- Decision page ----------
async function viewDecision(id) {
  const [rec, config] = await Promise.all([get(`api/decision/${id}`, `data/decision/${id}.json`), get("api/config", "data/config.json")]);
  app.innerHTML = `<div class="page-head"><div><h1>Decision ${esc(rec.id)}</h1>
    <p class="sub">${esc(when(rec.created_at))} UTC · judged after ${esc(rec.outcome_date)}</p></div>
    <span class="pill ${rec.reproduced ? "GO" : "AVOID"}">${rec.reproduced ? "✓ Reproduced exactly from stored inputs" : "✗ Re-run differs"}</span></div>
    <p class="muted small" style="margin-top:-8px">Check it yourself: <code>npm run reproduce -- ${esc(rec.id)}</code></p>` + decisionHTML(rec, config);
  wireShare();
}

// ---------- Decisions list ----------
async function viewDecisions() {
  const list = await get("api/decisions", "data/decisions.json");
  app.innerHTML = `<div class="page-head"><div><h1>Decisions</h1><p class="sub">Every decision is stored with its inputs and receipts, can be re-run exactly, and is judged against observed weather after its outcome date.</p></div>
    <a class="btn btn-accent" href="#/decide">New decision ${I.arrow}</a></div>
    <div class="card">${decisionsTable(list)}</div>`;
}

// ---------- Scoreboard ----------
async function viewScoreboard() {
  const b = await get("api/scoreboard", "data/scoreboard.json");
  const head = `<div class="page-head"><div><h1>Scoreboard</h1><p class="sub">Forecasts and decisions versus what actually happened. Advice that isn't checked isn't worth paying for.</p></div></div>`;
  if (!b) { app.innerHTML = head + `<div class="card empty">${I.target}<div>No outcomes scored yet.<br>Run <code>npm run outcomes</code> after the first forecast windows close.</div></div>`; return; }
  const s = b.summary;
  app.innerHTML = head + `
  ${s.sample_size_note ? `<div class="note">${esc(s.sample_size_note)}</div>` : ""}
  <div class="grid g4 mt">
    ${kpi("Decisions judged correct", `${s.decisions_correct}/${s.decisions_judged}`, s.accuracy != null ? `${Math.round(s.accuracy * 100)}% accuracy` : `${s.decisions_pending} awaiting their outcome date`, I.target, "b")}
    ${kpi("Cost per correct decision", s.cost_per_correct_decision_usd != null ? "$" + s.cost_per_correct_decision_usd : "–", "intelligence spend ÷ correct calls", I.coin, "a")}
    ${kpi("Cost per useful alert", s.cost_per_useful_alert_usd != null ? "$" + s.cost_per_useful_alert_usd : "–", "WAIT/AVOID calls that held", I.receipt, "c")}
    ${kpi("Hours of warning", s.median_hours_of_warning != null ? s.median_hours_of_warning + " h" : "–", "median, before observed rain", I.cloud, "d")}
  </div>
  <div class="grid g2 mt2">
    <div class="card"><div class="card-head"><h2>Forecast error by horizon</h2></div>
      <div class="scroll"><table><thead><tr><th>Horizon</th><th>Samples</th><th>Mean rain error</th><th>Rain / no-rain hit rate</th></tr></thead><tbody>
      ${Object.entries(b.by_horizon).map(([h, v]) => `<tr><td><b>${h}</b></td><td>${v.samples} (${v.rain_call_samples} calls)</td><td>${v.mean_abs_error_mm ?? "–"} mm</td><td>${v.rain_no_rain_hit_rate != null ? Math.round(v.rain_no_rain_hit_rate * 100) + "%" : "–"}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No closed forecast windows yet.</td></tr>`}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Judged decisions</h2></div>
      <div class="scroll"><table><thead><tr><th>Decision</th><th>Site</th><th>Said</th><th>With hindsight</th><th></th></tr></thead><tbody>
      ${b.judged.map((j) => `<tr><td><a href="#/d/${j.id}">${j.id}</a></td><td>${esc(j.location)}</td><td><span class="pill ${j.verdict}">${j.verdict}</span></td><td><span class="pill ${j.hindsight_verdict}">${j.hindsight_verdict}</span></td><td>${j.correct ? "✓" : "✗"}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">None past their outcome date yet.</td></tr>`}
      </tbody></table></div></div>
  </div>
  <p class="muted small mt">Updated ${esc(when(b.generated_at))} UTC. Observed weather: ${esc(b.observed_source)}. A decision is correct when the same engine, fed the weather that actually happened, reaches the same verdict.</p>`;
}

// ---------- Method ----------
async function viewMethod() {
  const c = await get("api/config", "data/config.json");
  app.innerHTML = `<div class="page-head"><div><h1>Method &amp; limits</h1><p class="sub">Rules in code, nothing guessed by a language model. Config <code>${esc(c.version)}</code>; all values are placeholders pending soil-science review.</p></div></div>
  <div class="grid g2">
    ${[["Buy", `The agent buys <code>WEATHER_FORECAST_GENERAL</code> through Telegraph for 24h, 48h, 72h and 120h windows, without a human approving each purchase. Each answer is stored with its cost, miner and on-chain receipt hash.`],
      ["Daily rain", `Daily amounts are the differences between windows; a multi-day window total is spread evenly. If a miner gives no amount, rain is estimated as probability × ${c.rules.rain_if_wet_mm} mm and flagged.`],
      ["Soil bucket", `Each day: storage + rain − evaporation (${c.rules.et_mm_day} mm); a share of any excess above field capacity drains; storage stays between 0 and saturation.`],
      ["Rules", `Field work: workable and no day ≥ ${c.rules.wet_day_mm} mm within ${c.rules.fieldwork_dry_hours} h. Harvest: ${c.rules.harvest_dry_run_days} dry days in a row. Planting: ≥ ${c.rules.plant_onset_mm} mm over ${c.rules.plant_onset_days} days, no ≥ ${c.rules.heavy_rain_mm} mm day, no ${c.rules.plant_dry_spell_days}-day dry spell. Mine: days to the first day above ${c.rules.mine_threshold_mm} mm.`]]
      .map(([t, p], i) => `<div class="card step"><div class="step-n">${i + 1}</div><h3>${t}</h3><p>${p}</p></div>`).join("")}
  </div>
  <div class="card mt2"><div class="card-head"><h2>Soil profiles</h2></div>
  <div class="scroll"><table><thead><tr><th>Soil</th><th>Field capacity</th><th>Saturation</th><th>Drains per day</th><th>Workable at or below</th></tr></thead><tbody>
  ${Object.entries(c.soils).map(([k, s]) => `<tr><td><b>${SOIL_NAMES[k]}</b></td><td>${s.fc_mm} mm</td><td>${s.sat_mm} mm</td><td>${Math.round(s.drain_frac * 100)}% of excess</td><td>${Math.round(s.workable_frac * 100)}% of FC (${Math.round(s.workable_frac * s.fc_mm)} mm)</td></tr>`).join("")}
  </tbody></table></div></div>
  <div class="card mt2"><div class="card-head"><h2>Limits, stated plainly</h2></div><ul style="margin:0;padding-left:20px">
    <li>Parameters are placeholders and not yet field-validated. Not agronomic advice.</li>
    <li>The forecast intent does not formally return rainfall in mm; when miners include it in text, it is extracted and labelled.</li>
    <li>Telegraph testnet purchases can be slow or fail; failures are shown and lower confidence, never filled in.</li>
    <li>Observed weather for scoring comes from Open-Meteo, not from Telegraph.</li>
    <li>Small samples so far; the scoreboard always states its sample size.</li>
  </ul></div>`;
}

// ---------- Router ----------
const TITLES = { overview: "Overview", decide: "Decide", decisions: "Decisions", scoreboard: "Scoreboard", method: "Method & limits" };
async function route() {
  const h = location.hash.slice(1) || "/";
  const nav = h.startsWith("/scoreboard") ? "scoreboard" : h.startsWith("/decisions") || h.startsWith("/d/") ? "decisions" : h.startsWith("/method") ? "method" : h.startsWith("/decide") ? "decide" : "overview";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  $("#crumbs").textContent = "Workable  /  " + TITLES[nav];
  app.innerHTML = `<div class="empty"><span class="spin"></span> Loading…</div>`;
  try {
    if (h.startsWith("/d/")) await viewDecision(h.slice(3));
    else if (nav === "scoreboard") await viewScoreboard();
    else if (nav === "decisions") await viewDecisions();
    else if (nav === "method") await viewMethod();
    else if (nav === "decide") await viewDecide();
    else await viewOverview();
  } catch (e) { app.innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
detect().then(route);
