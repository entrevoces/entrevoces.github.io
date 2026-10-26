// Echo Sequence — Firefly Path (canvas regen, game-spec-kit).
// A firefly lights stepping stones across a night pond (and speaks each word);
// the lantern-bearer walks only the order the player remembers. Stages 6–7.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
import { Juice } from "../../../packages/game-kit/juice.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
let engine, concepts = [], targetLang = "es", momentConceptId = null;
let G = null, raf = null;
const juice = new Juice(cv);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { if (raf) cancelAnimationFrame(raf); raf = null; document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function speak(t, lang) { try { const u = new SpeechSynthesisUtterance(t); u.lang = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : "en-US"; u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }

// stone layout: two gentle arcs across the pond
function stonePos(i, n) {
  const t = n === 1 ? 0.5 : i / (n - 1);
  const x = 90 + t * 780;
  const y = 300 + Math.sin(t * Math.PI * 1.15) * -95 + (i % 2 ? 34 : -12);
  return { x, y };
}
async function boot() {
  const p = new URLSearchParams(location.search);
  const customTitle = p.get("title"); if (customTitle) { const h = document.querySelector("h1"); if (h) h.textContent = customTitle; document.title = `${customTitle} · ENTRE VOCES`; }
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "oregon-medical";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.OREGON_MEDICAL, fallbackConcepts: fb });
  await engine.init();
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb.filter((c) => c.domainId === engine.domainId);
  try { const areas = JSON.parse(localStorage.getItem("ev:interestAreas") || "[]"); if (areas.length) { const f = concepts.filter((c) => c.areaIds.some((a) => areas.includes(a))); if (f.length >= 4) concepts = f; } } catch {}
  try { const nx = await engine.getNext(engine.domainId, { modeId: (JSON.parse(localStorage.getItem("ev:modes") || "[]")[0] || null) }); if (nx?.conceptId && concepts.some((c) => c.conceptId === nx.conceptId)) { momentConceptId = nx.conceptId; const mc = concepts.find((c) => c.conceptId === nx.conceptId); const el = document.querySelector("#titleContext"); if (el && mc) el.textContent += ` Your moment: “${mc.terms.en.term}” opens the path.`; } } catch {}
  syncBadge();
  const dom = await engine.getDomain(engine.domainId);
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · stones speak English → ${targetLang === "zh" ? "中文" : "Español"} · 3 petals guard the walk. ` + $("#titleContext").textContent;
  $("#startBtn").addEventListener("click", startGame);
  $("#againBtn").addEventListener("click", startGame);
  $("#quitBtn").addEventListener("click", () => endGame());
  $("#replayBtn").addEventListener("click", async () => { if (G && G.petals > 0 && G.accepting) { G.petals--; G.replayUsed = true; hud(); await playSequence(); } });
  cv.addEventListener("pointerdown", (e) => {
    if (!G?.accepting) return;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    const i = G.stones.findIndex((s) => Math.hypot(s.x - x, s.y - y) < 56);
    if (i >= 0) tapStone(i, x, y);
  });
}
function startGame() {
  const momentC = momentConceptId && concepts.find((c) => c.conceptId === momentConceptId);
  const pool = momentC ? [momentC, ...shuffle(concepts.filter((c) => c.conceptId !== momentC.conceptId)).slice(0, 9)] : shuffle(concepts).slice(0, 10);
  G = { pool, sequence: [], input: [], round: 0, petals: 3, perfect: 0, accepting: false, replayUsed: false, reverse: false, lit: -1, bearer: 0, stones: [], t: 0, firefly: { x: 80, y: 120 } };
  G.stones = pool.map((c, i) => ({ c, ...stonePos(i, pool.length) }));
  show("screen-play"); loop(); nextRound();
}
function hud() { $("#hudRound").textContent = `Round ${G.round}`; $("#hudThread").textContent = `Path ${G.sequence.length} stones`; $("#hudLives").textContent = `Petals ${"●".repeat(Math.max(0, G.petals))}${"○".repeat(Math.max(0, 3 - G.petals))}`; $("#phaseLabel").textContent = G.reverse ? "Reverse walk — ears in the other tongue" : "Firefly walk"; }
async function nextRound() {
  G.round++; G.input = []; G.replayUsed = false; G.reverse = G.round % 3 === 0;
  G.sequence.push(G.pool[(G.round - 1) % G.pool.length]);
  hud(); $("#feedback").textContent = "";
  await wait(650); await playSequence();
}
async function playSequence() {
  G.accepting = false;
  const pace = Math.max(360, 760 - G.round * 42);
  for (const c of G.sequence) {
    const idx = G.pool.indexOf(c);
    G.lit = idx; G.firefly = { x: G.stones[idx].x, y: G.stones[idx].y - 60 };
    speak(G.reverse ? tgt(c) : c.terms.en.term, G.reverse ? targetLang : "en");
    Juice.beep(520 + idx * 60, 0.12, "sine", 0.05);
    await wait(pace); G.lit = -1; await wait(190);
  }
  G.accepting = true;
  $("#feedback").textContent = G.reverse ? "You heard it in the other tongue. Walk it home." : "Your walk — same order.";
}
async function tapStone(i, x, y) {
  if (!G?.accepting) return;
  const c = G.pool[i];
  speak(G.reverse ? c.terms.en.term : tgt(c), G.reverse ? "en" : targetLang);
  const expected = G.sequence[G.input.length];
  G.input.push(c);
  if (c.conceptId !== expected.conceptId) {
    G.petals--; G.accepting = false; juice.shake(7); Juice.bad();
    juice.burst(x, y, "#ff8a75", 14);
    $("#feedback").textContent = `The bearer stumbles at stone ${G.input.length} — it was “${expected.terms.en.term}”. The path is order, made visible.`; $("#feedback").className = "feedback bad";
    engine.recordEvidence({ conceptId: expected.conceptId, areaId: expected.areaIds[0], gameId: "echo-sequence", activityType: "retrieval", stage: 6, languageDirection: G.reverse ? `${targetLang}->en` : `en->${targetLang}`, correct: false, score: 0.2, assistance: G.replayUsed ? ["replay"] : [], responseSummary: `Firefly path slipped at position ${G.input.length} of ${G.sequence.length}` });
    syncBadge(); hud();
    if (G.petals <= 0) { setTimeout(() => endGame(), 1000); return; }
    await wait(950); G.input = []; G.bearer = 0; await playSequence(); return;
  }
  G.bearer = G.input.length; juice.burst(x, y - 10, "#ffd166", 12); Juice.beep(560 + G.input.length * 70, 0.1, "sine", 0.05);
  juice.floatText(x, y - 44, c.terms.en.term, "#ffe9b0");
  if (G.input.length === G.sequence.length) {
    G.accepting = false; G.perfect++; juice.confetti(G.stones[G.pool.indexOf(c)].x, 180);
    $("#feedback").textContent = "Whole path walked, in order, in the other tongue. The lantern swings a little prouder."; $("#feedback").className = "feedback good";
    for (const s of G.sequence) engine.recordEvidence({ conceptId: s.conceptId, areaId: s.areaIds[0], gameId: "echo-sequence", activityType: "spoken-production", stage: 7, languageDirection: G.reverse ? `${targetLang}->en` : `en->${targetLang}`, correct: true, score: G.replayUsed ? 0.7 : 1, assistance: G.replayUsed ? ["replay"] : [], responseSummary: `Firefly path of ${G.sequence.length} held` });
    syncBadge(); hud();
    if (G.sequence.length >= 10) { setTimeout(() => endGame(), 900); return; }
    setTimeout(nextRound, 1000);
  }
}
function loop() {
  if (!G) return;
  G.t++;
  draw();
  juice.update();
  if ($("#screen-play").classList.contains("is-active")) raf = requestAnimationFrame(loop);
}
function draw() {
  const { x: sx, y: sy } = juice.shakeOffset();
  ctx.save(); ctx.translate(sx, sy);
  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, "#123c33"); sea.addColorStop(0.6, "#0a2a24"); sea.addColorStop(1, "#061a16");
  ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f4e9c8"; ctx.beginPath(); ctx.arc(852, 74, 30, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(244,233,200,.16)"; ctx.beginPath(); ctx.arc(852, 74, 52, 0, 7); ctx.fill();
  // reeds + lily pads
  ctx.strokeStyle = "#1d5a48"; ctx.lineWidth = 5; ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) { const x = 40 + i * 112; ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + 8, H - 90, x + (i % 2 ? 14 : -10), H - 140 - (i % 3) * 22); ctx.stroke(); }
  ctx.fillStyle = "#1a4d3d";
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(90 + i * 135, 452 + (i % 2) * 26, 30, 10, 0.2, 0, 7); ctx.fill(); }
  // stones
  G.stones.forEach((s, i) => {
    const lit = G.lit === i;
    const walked = G.sequence.slice(0, G.bearer).includes(s.c) && G.input.length > G.sequence.indexOf(s.c);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(s.x, s.y + 16, 44, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = lit ? "#ffd166" : "#33544a";
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 46, 26, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = lit ? "#fff0c0" : "#5f8577"; ctx.lineWidth = lit ? 4 : 2; ctx.stroke();
    if (lit) { ctx.fillStyle = "rgba(255,209,102,.25)"; ctx.beginPath(); ctx.arc(s.x, s.y, 62 + Math.sin(G.t * 0.2) * 5, 0, 7); ctx.fill(); }
    ctx.font = "700 14px 'Public Sans', sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = lit ? "#3d2f02" : "#eaf6ef";
    const en = s.c.terms.en.term;
    ctx.fillText(en.length > 20 ? en.slice(0, 19) + "…" : en, s.x, s.y + 1, 84);
    if (!G.reverse) { ctx.font = "600 12px 'Public Sans', sans-serif"; ctx.fillStyle = lit ? "#6b4a08" : "#9fc4b6"; const tg = tgt(s.c); ctx.fillText(tg.length > 20 ? tg.slice(0, 19) + "…" : tg, s.x, s.y + 16, 84); }
  });
  // bearer with lantern (stands on last walked stone / bank)
  const bi = Math.max(0, G.bearer - 1);
  const bs = G.bearer > 0 ? G.stones[G.pool.indexOf(G.sequence[bi])] : { x: 52, y: 356 };
  const bob = Math.sin(G.t * 0.08) * 2;
  ctx.fillStyle = "#123b34"; ctx.fillRect(bs.x - 9, bs.y - 58 + bob, 18, 24);
  ctx.fillStyle = "#f2c29b"; ctx.beginPath(); ctx.arc(bs.x, bs.y - 64 + bob, 8, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(bs.x + 16, bs.y - 48 + bob, 6 + Math.sin(G.t * 0.15) * 1.2, 0, 7); ctx.fill();
  ctx.strokeStyle = "#0a201c"; ctx.beginPath(); ctx.moveTo(bs.x + 8, bs.y - 52 + bob); ctx.lineTo(bs.x + 16, bs.y - 48 + bob); ctx.stroke();
  // firefly
  const fx = G.firefly.x + Math.sin(G.t * 0.06) * 9, fy = G.firefly.y + Math.cos(G.t * 0.09) * 6;
  ctx.fillStyle = "rgba(255,230,130,.28)"; ctx.beginPath(); ctx.arc(fx, fy, 17, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffe66d"; ctx.beginPath(); ctx.arc(fx, fy, 5, 0, 7); ctx.fill();
  juice.draw();
  ctx.restore();
}
async function endGame() {
  const g = G; if (raf) cancelAnimationFrame(raf); raf = null;
  const dm = dailyMark("echo-sequence", g?.sequence.length || 0);
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = (g?.perfect || 0) >= 4 ? "You hold long turns without dropping the world." : "The pond remembers where paths slip — so will you.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Longest path ever <strong>${dm.best}</strong> · Rounds <strong>${g?.round || 0}</strong> · Perfect paths <strong>${g?.perfect || 0}</strong> · Longest tonight <strong>${g?.sequence.length || 0}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Walk again.")}<br><span class="hint">Ordered memory + production, proven on water.</span>`;
  show("screen-end"); G = null; syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Pond failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
