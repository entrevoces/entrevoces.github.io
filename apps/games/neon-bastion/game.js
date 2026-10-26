// Neon Bastion — platform shooter (Stages 2 & 6). Run, jump, shoot the drone
// carrying the true equivalent. Genre surprise on purpose: precision under
// fire is retrieval under pressure with a trigger instead of a tap.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
let engine, concepts = [], targetLang = "es";
let G = null, raf = null, keys = {};
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { if (raf) cancelAnimationFrame(raf); raf = null; document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }

const PLATFORMS = [
  { x: 0, y: 492, w: 960, h: 48 }, { x: 70, y: 392, w: 210, h: 16 }, { x: 370, y: 322, w: 220, h: 16 },
  { x: 680, y: 392, w: 210, h: 16 }, { x: 240, y: 222, w: 200, h: 16 }, { x: 540, y: 162, w: 190, h: 16 },
];
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
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · ${concepts.length} words are under attack · English → ${targetLang === "zh" ? "中文" : "Español"}.`;
  $("#startBtn").addEventListener("click", startGame);
  $("#againBtn").addEventListener("click", startGame);
  $("#quitBtn").addEventListener("click", () => endGame());
  window.addEventListener("keydown", (e) => { keys[e.code] = true; if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault(); });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  cv.addEventListener("pointerdown", (e) => {
    if (!G) return;
    const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    const hit = G.drones.find((d) => Math.hypot(d.x - x, d.y - y) < 52);
    if (hit) shootAt(hit); else if (y < G.p.y - 30) jump(); else { G.p.face = x < G.p.x ? -1 : 1; shoot(); }
  });
}
function startGame() {
  G = { p: { x: 120, y: 430, vx: 0, vy: 0, face: 1, ground: false }, bullets: [], drones: [], parts: [], score: 0, shield: 3, hits: 0, shots: 0, wave: 0, current: null, over: false, t: 0 };
  show("screen-play"); nextWave(); loop();
}
function hud() { $("#hudScore").textContent = `Score ${G.score}`; $("#hudShield").textContent = `Shield ${"●".repeat(Math.max(0, G.shield))}${"○".repeat(Math.max(0, 3 - G.shield))}`; $("#hudWave").textContent = `Wave ${G.wave}`; if (!G.current) { $("#hudPrompt").textContent = ""; return; } const ex = G.current.examples?.[0]?.en || ""; $("#hudPrompt").textContent = G.sentenceWave && ex ? `In context: “${ex.replace(G.current.terms.en.term, "_____")}” → blast its equivalent` : `Target: ${G.current.terms.en.term} → ?`; }
function nextWave() {
  G.wave++;
  G.current = concepts[Math.floor(Math.random() * concepts.length)];
  G.sentenceWave = G.wave % 3 === 0;
  const wrongs = shuffle(concepts.filter((c) => c.conceptId !== G.current.conceptId)).slice(0, 3);
  const defs = shuffle([{ c: G.current, gold: true }, ...wrongs.map((c) => ({ c, gold: false }))]);
  const lanes = [120, 205, 285, 360];
  G.drones = defs.map((d, i) => ({ x: 140 + i * 230 + Math.random() * 60, y: lanes[i % lanes.length], vx: (0.5 + G.wave * 0.08) * (i % 2 ? 1 : -1), label: tgt(d.c), gold: d.gold, bob: Math.random() * 6 }));
  hud();
}
function jump() { if (G.p.ground) { G.p.vy = -12.5; G.p.ground = false; } }
function shoot() {
  G.shots++;
  G.bullets.push({ x: G.p.x + G.p.face * 22, y: G.p.y - 26, vx: G.p.face * 11, vy: -1.2, dead: false });
}
function shootAt(d) { // touch: direct shot at tapped drone counts as fired at it
  G.shots++;
  resolveDrone(d);
}
function resolveDrone(d) {
  const c = G.current;
  if (d.gold) {
    G.hits++; G.score += 100 + G.wave * 10;
    burst(d.x, d.y, "#2ee6a8");
    $("#feedback").textContent = `Direct hit — “${tgt(c)}” is the true equivalent. The bastion holds.`; $("#feedback").className = "feedback good";
    engine.recordEvidence({ conceptId: c.conceptId, areaId: c.areaIds[0], gameId: "neon-bastion", activityType: G.sentenceWave ? "contextual-usage" : "retrieval", ...(G.sentenceWave ? { stage: 5 } : { stage: 6 }), languageDirection: `en->${targetLang}`, correct: true, score: 1, responseSummary: `Bastion wave ${G.wave} shot the true drone` });
    G.drones = []; setTimeout(() => { if (G && !G.over) nextWave(); }, 450);
  } else {
    G.shield--;
    burst(d.x, d.y, "#ff5d47");
    $("#feedback").textContent = `Neighbour down — that was “${d.label}”, not “${tgt(c)}”. Shield pays for haste.`; $("#feedback").className = "feedback bad";
    engine.recordEvidence({ conceptId: c.conceptId, areaId: c.areaIds[0], gameId: "neon-bastion", activityType: "retrieval", stage: 6, languageDirection: `en->${targetLang}`, correct: false, score: 0, misconceptionTag: c.misconceptions?.[0]?.tag, responseSummary: `Bastion shot neighbour ${d.label}` });
    G.drones = G.drones.filter((x) => x !== d);
    if (G.shield <= 0) { endGame(); return; }
  }
  syncBadge(); hud();
}
function burst(x, y, col) { for (let i = 0; i < 14; i++) G.parts.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 22, col }); }
function loop() {
  if (!G || G.over) return;
  G.t++;
  const p = G.p;
  if (keys.ArrowLeft || keys.KeyA) { p.vx = -3.6; p.face = -1; }
  else if (keys.ArrowRight || keys.KeyD) { p.vx = 3.6; p.face = 1; }
  else p.vx *= 0.7;
  if ((keys.KeyW || keys.ArrowUp) && p.ground) jump();
  if (keys.Space || keys.KeyJ) { if (!G.cool) { shoot(); G.cool = 14; } }
  if (G.cool) G.cool--;
  p.vy += 0.55; p.x += p.vx; p.y += p.vy; p.ground = false;
  for (const pl of PLATFORMS) {
    if (p.x > pl.x - 14 && p.x < pl.x + pl.w + 14 && p.y > pl.y - 4 && p.y < pl.y + 26 && p.vy >= 0) { p.y = pl.y; p.vy = 0; p.ground = true; }
  }
  p.x = Math.max(18, Math.min(W - 18, p.x)); if (p.y > H + 60) { p.y = 430; p.x = 120; }
  for (const b of G.bullets) { b.x += b.vx; b.y += b.vy; if (b.x < -20 || b.x > W + 20) b.dead = true; }
  for (const d of G.drones) {
    d.x += d.vx; d.y += Math.sin(G.t * 0.04 + d.bob) * 0.5;
    if (d.x < 70 || d.x > W - 70) d.vx *= -1;
    for (const b of G.bullets) if (!b.dead && Math.hypot(b.x - d.x, b.y - d.y) < 40) { b.dead = true; resolveDrone(d); break; }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
  G.parts.forEach((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life--; });
  G.parts = G.parts.filter((pt) => pt.life > 0);
  draw();
  if (G && !G.over) raf = requestAnimationFrame(loop);
}
function draw() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2a1450"); sky.addColorStop(0.55, "#8a2d4a"); sky.addColorStop(1, "#ffb347");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffe9b0"; ctx.beginPath(); ctx.arc(815, 105, 38, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 40; i++) { const x = (i * 173) % W, y = (i * 97) % 190; ctx.fillRect(x, y, 2, 2); }
  // parallax mesas
  ctx.fillStyle = "#4a2560"; mesa(0, 330, 260); mesa(620, 310, 340);
  ctx.fillStyle = "#341a4a"; mesa(180, 380, 300); mesa(760, 390, 260);
  // platforms
  for (const pl of PLATFORMS) {
    ctx.fillStyle = "#120a24"; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = "#2ee6a8"; ctx.fillRect(pl.x, pl.y, pl.w, 4);
    ctx.fillStyle = "rgba(46,230,168,.25)"; ctx.fillRect(pl.x, pl.y + 4, pl.w, 3);
  }
  // drones
  for (const d of G.drones) {
    ctx.save(); ctx.translate(d.x, d.y);
    ctx.fillStyle = "#1c1030"; ctx.beginPath(); ctx.ellipse(0, 0, 30, 19, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = d.gold ? "#2ee6a8" : "#ff8a75"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#ff5d47"; ctx.fillRect(-19, -4, 7, 7); ctx.fillRect(12, -4, 7, 7);
    ctx.fillStyle = "#9fdce8"; ctx.beginPath(); ctx.arc(0, -3, 6, 0, 7); ctx.fill();
    ctx.restore();
    label(d.x, d.y - 38, d.label);
  }
  // bullets
  ctx.fillStyle = "#ffe66d"; for (const b of G.bullets) { ctx.fillRect(b.x - 7, b.y - 2, 14, 4); }
  // player: runner with visor + blaster
  const p = G.p;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 2, 17, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#123b34"; ctx.fillRect(-10, -34, 20, 24); // torso
  ctx.fillStyle = "#2ee6a8"; ctx.fillRect(-10, -34, 20, 5);
  ctx.fillStyle = "#f2c29b"; ctx.beginPath(); ctx.arc(0, -42, 9, 0, 7); ctx.fill();
  ctx.fillStyle = "#18102e"; ctx.fillRect(p.face > 0 ? 0 : -11, -46, 11, 6); // visor
  ctx.fillStyle = "#ffe66d"; ctx.fillRect(p.face > 0 ? 14 : -26, -28, 12, 5); // blaster
  ctx.fillStyle = "#123b34"; const run = Math.abs(p.vx) > 0.5 && p.ground ? Math.sin(G.t * 0.35) * 6 : 0;
  ctx.fillRect(-9, -10, 7, 10 + run); ctx.fillRect(3, -10, 7, 10 - run);
  ctx.restore();
  for (const pt of G.parts) { ctx.fillStyle = pt.col; ctx.globalAlpha = Math.max(0, pt.life / 22); ctx.fillRect(pt.x, pt.y, 4, 4); }
  ctx.globalAlpha = 1;
}
function mesa(x, y, w) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 20, y); ctx.lineTo(x + w - 40, y); ctx.lineTo(x + w, H); ctx.closePath(); ctx.fill(); }
function label(x, y, text) {
  ctx.font = "700 15px 'Public Sans', sans-serif";
  const w = Math.min(230, ctx.measureText(text).width + 20);
  ctx.fillStyle = "rgba(13,7,24,.88)"; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 15, w, 28, 8); ctx.fill();
  ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#fff8ea"; ctx.textAlign = "center"; ctx.fillText(text.length > 26 ? text.slice(0, 25) + "…" : text, x, y + 5, w - 8);
}
async function endGame() {
  if (!G) return;
  const g = G; G.over = true; const dm = dailyMark("neon-bastion", g.score);
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = g.hits >= 8 ? "The bastion lights spell your name in two languages." : "The drones retreat — with your misses catalogued for tomorrow.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Best score <strong>${dm.best}</strong> · True hits <strong>${g.hits}</strong> · Shots <strong>${g.shots}</strong> · Waves <strong>${g.wave}</strong> · Score <strong>${g.score}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Defend again.")}<br><span class="hint">Every shot was Stage-6 retrieval evidence — speed and precision, judged together, like the room demands.</span>`;
  show("screen-end"); G = null; syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Bastion failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
