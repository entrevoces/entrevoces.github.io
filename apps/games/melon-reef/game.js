// Melon Reef — underwater listening harvest (Stages 1 & 5, reverse direction).
// Hear the term in the study language; swim the melon-sub into the English
// melon it names. Listening recognition is the skill clinics actually test
// at the door — here it has fins, oxygen, and jellyfish.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
let engine, concepts = [], targetLang = "es";
let G = null, raf = null, keys = {}, pointer = null;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { if (raf) cancelAnimationFrame(raf); raf = null; document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function speak(t, lang) { try { const u = new SpeechSynthesisUtterance(t); u.lang = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : "en-US"; u.rate = 0.92; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }

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
  syncBadge();
  const dom = await engine.getDomain(engine.domainId);
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · the reef speaks ${targetLang === "zh" ? "中文" : "Español"} · you harvest in English · 8 ripe melons surface you a winner.`;
  $("#startBtn").addEventListener("click", startGame);
  $("#againBtn").addEventListener("click", startGame);
  $("#quitBtn").addEventListener("click", () => endGame());
  $("#listenBtn").addEventListener("click", listen);
  window.addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "KeyL") listen(); });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  const setPointer = (e) => { const r = cv.getBoundingClientRect(); pointer = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  cv.addEventListener("pointermove", setPointer); cv.addEventListener("pointerdown", setPointer);
}
function listen() { if (G?.current) speak(tgt(G.current), targetLang); }
function startGame() {
  G = { sub: { x: 480, y: 300, vx: 0, vy: 0, face: 1 }, melons: [], bubbles: [], oxygen: 100, harvest: 0, stings: 0, current: null, over: false, t: 0, heard: 0 };
  show("screen-play"); nextMelon(); loop();
  setTimeout(listen, 400);
}
function hud() { $("#hudOxygen").textContent = `Oxygen ${Math.max(0, Math.round(G.oxygen))}%`; $("#hudHarvest").textContent = `Harvested ${G.harvest} / 8`; $("#hudPrompt").textContent = G.current ? `Listen… then find the English melon` : ""; }
function nextMelon() {
  G.current = concepts[Math.floor(Math.random() * concepts.length)];
  const wrongs = shuffle(concepts.filter((c) => c.conceptId !== G.current.conceptId)).slice(0, 3);
  const defs = shuffle([{ c: G.current, gold: true }, ...wrongs.map((c) => ({ c, gold: false }))]);
  G.melons = defs.map((d, i) => ({ x: 130 + i * 235 + Math.random() * 50, y: 130 + (i % 2) * 190 + Math.random() * 50, r: 44, label: d.c.terms.en.term, gold: d.gold, drift: Math.random() * 6, hit: false }));
  G.heard = 0; hud();
}
function resolveMelon(m) {
  const c = G.current;
  if (m.gold) {
    G.harvest++; G.oxygen = Math.min(100, G.oxygen + 22);
    for (let i = 0; i < 12; i++) G.bubbles.push({ x: m.x, y: m.y, r: 2 + Math.random() * 4, vy: -1 - Math.random() * 1.6, life: 50 });
    $("#feedback").textContent = `Ripe. “${tgt(c)}” is “${c.terms.en.term}” — your ears knew before your eyes did.`; $("#feedback").className = "feedback good";
    engine.recordEvidence({ conceptId: c.conceptId, areaId: c.areaIds[0], gameId: "melon-reef", activityType: "terminology", stage: 1, languageDirection: `${targetLang}->en`, correct: true, score: G.heard > 1 ? 0.8 : 1, assistance: G.heard > 1 ? ["relisten"] : [], responseSummary: `Reef heard ${tgt(c)} and harvested ${c.terms.en.term}` });
    if (G.harvest >= 8) { endGame(); return; }
    G.melons = []; setTimeout(() => { if (G && !G.over) { nextMelon(); listen(); } }, 500);
  } else {
    G.stings++; G.oxygen -= 18;
    $("#feedback").textContent = `Sting — that melon was “${m.label}”. The reef keeps what listeners miss.`; $("#feedback").className = "feedback bad";
    engine.recordEvidence({ conceptId: c.conceptId, areaId: c.areaIds[0], gameId: "melon-reef", activityType: "terminology", stage: 1, languageDirection: `${targetLang}->en`, correct: false, score: 0, responseSummary: `Reef mistook ${tgt(c)} for ${m.label}` });
    m.hit = true; G.melons = G.melons.filter((x) => x !== m);
    if (G.oxygen <= 0) { endGame(); return; }
  }
  syncBadge(); hud();
}
function loop() {
  if (!G || G.over) return;
  G.t++; G.oxygen -= 0.045;
  if (G.oxygen <= 0) { endGame(); return; }
  const s = G.sub;
  let ax = 0, ay = 0;
  if (keys.ArrowLeft || keys.KeyA) ax -= 0.35; if (keys.ArrowRight || keys.KeyD) ax += 0.35;
  if (keys.ArrowUp || keys.KeyW) ay -= 0.35; if (keys.ArrowDown || keys.KeyS) ay += 0.35;
  if (pointer && !ax && !ay) { const dx = pointer.x - s.x, dy = pointer.y - s.y, dist = Math.hypot(dx, dy); if (dist > 8) { ax = (dx / dist) * 0.32; ay = (dy / dist) * 0.32; } }
  s.vx = (s.vx + ax) * 0.92; s.vy = (s.vy + ay) * 0.92;
  s.x = Math.max(30, Math.min(W - 30, s.x + s.vx)); s.y = Math.max(50, Math.min(H - 40, s.y + s.vy));
  if (Math.abs(s.vx) > 0.3) s.face = s.vx > 0 ? 1 : -1;
  if (G.t % 14 === 0) G.bubbles.push({ x: s.x + 20 * s.face, y: s.y - 12, r: 2 + Math.random() * 3, vy: -0.8 - Math.random(), life: 70 });
  for (const m of G.melons) {
    m.y += Math.sin(G.t * 0.02 + m.drift) * 0.35;
    if (Math.hypot(m.x - s.x, m.y - s.y) < m.r + 26) resolveMelon(m);
  }
  G.bubbles.forEach((b) => { b.y += b.vy; b.life--; });
  G.bubbles = G.bubbles.filter((b) => b.life > 0 && b.y > -10);
  if (G.t % 90 === 0) hud();
  draw();
  if (G && !G.over) raf = requestAnimationFrame(loop);
}
function draw() {
  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, "#12708c"); sea.addColorStop(0.6, "#0a4a5e"); sea.addColorStop(1, "#052633");
  ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
  // god rays
  ctx.fillStyle = "rgba(255,244,190,.10)";
  for (let i = 0; i < 4; i++) { const x = 120 + i * 230 + Math.sin(G.t * 0.002 + i) * 18; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 55, 0); ctx.lineTo(x + 130, H); ctx.lineTo(x + 20, H); ctx.closePath(); ctx.fill(); }
  // far fish silhouettes
  ctx.fillStyle = "rgba(4,34,43,.5)";
  for (let i = 0; i < 5; i++) { const x = ((i * 260 + G.t * (0.3 + i * 0.07)) % (W + 90)) - 45, y = 80 + i * 62; fish(x, y, 15); }
  // seabed + coral
  ctx.fillStyle = "#07303d"; ctx.fillRect(0, H - 56, W, 56);
  coral(90, H - 56, "#ff6b81"); coral(300, H - 56, "#ffb347"); coral(700, H - 56, "#ff6b81"); coral(880, H - 56, "#c084fc");
  // melons: watermelon orbs with labels
  for (const m of G.melons) {
    ctx.save(); ctx.translate(m.x, m.y);
    ctx.fillStyle = "#1d7a3a"; ctx.beginPath(); ctx.ellipse(0, 0, m.r, m.r * 0.82, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#0d4d24"; ctx.lineWidth = 4;
    for (const off of [-22, 0, 22]) { ctx.beginPath(); ctx.ellipse(off * 0.7, 0, 9, m.r * 0.78, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = "#ff6b81"; ctx.beginPath(); ctx.ellipse(0, 0, m.r * 0.55, m.r * 0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#10231a"; for (const [sx, sy] of [[-12, -5], [8, 3], [-2, 10], [14, -9]]) { ctx.beginPath(); ctx.ellipse(sx, sy, 2.6, 3.6, 0.4, 0, 7); ctx.fill(); }
    ctx.restore();
    label(m.x, m.y - m.r - 16, m.label);
  }
  // sub: melon submarine
  const s = G.sub;
  ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.face, 1);
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 30, 34, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#2fae5f"; ctx.beginPath(); ctx.ellipse(0, 0, 38, 24, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = "#145c2e"; ctx.lineWidth = 3; for (const off of [-18, 0, 18]) { ctx.beginPath(); ctx.ellipse(off, 0, 8, 23, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = "#bdeff5"; ctx.beginPath(); ctx.arc(13, -5, 10, 0, 7); ctx.fill(); ctx.strokeStyle = "#ffe66d"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#ffe66d"; ctx.fillRect(-46, -7, 10, 14); // tail fin housing
  const prop = Math.sin(G.t * 0.5) * 8; ctx.fillRect(-50, -2 + prop * 0.2, 5, 4 + Math.abs(prop) * 0.2);
  ctx.restore();
  for (const b of G.bubbles) { ctx.strokeStyle = "rgba(220,248,255,.75)"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke(); }
  // oxygen vignette when low
  if (G.oxygen < 30) { ctx.fillStyle = `rgba(120,10,20,${0.22 * (1 - G.oxygen / 30)})`; ctx.fillRect(0, 0, W, H); }
}
function fish(x, y, s) { ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.45, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s - 8, y - 6); ctx.lineTo(x - s - 8, y + 6); ctx.closePath(); ctx.fill(); }
function coral(x, base, col) { ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = "round"; for (const [dx, h, lean] of [[0, 44, 0], [-16, 30, -8], [16, 34, 8]]) { ctx.beginPath(); ctx.moveTo(x + dx, base); ctx.quadraticCurveTo(x + dx + lean, base - h * 0.6, x + dx + lean * 1.6, base - h); ctx.stroke(); } }
function label(x, y, text) {
  ctx.font = "700 15px 'Public Sans', sans-serif";
  const w = Math.min(240, ctx.measureText(text).width + 20);
  ctx.fillStyle = "rgba(4,34,43,.88)"; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 15, w, 28, 8); ctx.fill();
  ctx.strokeStyle = "#7fe3c8"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#f4fffc"; ctx.textAlign = "center"; ctx.fillText(text.length > 26 ? text.slice(0, 25) + "…" : text, x, y + 5, w - 8);
}
async function endGame() {
  if (!G || G.over) return;
  const g = G; G.over = true; const won = g.harvest >= 8; const dm = dailyMark("melon-reef", g.harvest);
  try { speechSynthesis.cancel(); } catch {}
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = won ? "Eight ripe melons. The reef bows to a listener." : "Surfaced — the reef kept the rest for tomorrow.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Best harvest <strong>${dm.best}</strong> · Harvested <strong>${g.harvest} / 8</strong> · Stings <strong>${g.stings}</strong> · Oxygen left <strong>${Math.max(0, Math.round(g.oxygen))}%</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Dive again.")}<br><span class="hint">Reverse-direction listening evidence (${targetLang}→EN, Stage 1) — the direction most games never test, exercised by ear alone.</span>`;
  show("screen-end"); G = null; syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Reef failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
