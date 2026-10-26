// The Table — canvas negotiation table (regen, game-spec-kit).
// Faces around an oval table, trust in their expressions, strategy as
// gestures, renderings as bubbles you stand behind. Logic (Stages 5/8)
// unchanged; the worksheet is now a room.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
import { Juice } from "../../../packages/game-kit/juice.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
const juice = new Juice(cv);
let engine, domain, concepts = [], targetLang = "es";
let sit = null, raf = null;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { if (raf) cancelAnimationFrame(raf); raf = null; document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }
const STRATEGIES = [
  { id: "clarify", label: "CLARIFY", icon: "?", bestWhen: "ambiguous", color: "#e9a13b" },
  { id: "chunk", label: "CHUNK", icon: "✂", bestWhen: "long", color: "#7fe3c8" },
  { id: "render", label: "RENDER", icon: "➤", bestWhen: "clear", color: "#ffb347" },
  { id: "slow", label: "SLOW", icon: "◷", bestWhen: "dense", color: "#c084fc" },
];
function gestureRect(i) { return { x: 128 + i * 178, y: 438, w: 160, h: 72 }; }
function bubbleRect(i) { return { x: 70 + i * 430, y: 330, w: 390, h: 96 }; }

async function boot() {
  const p = new URLSearchParams(location.search);
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "oregon-medical";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.OREGON_MEDICAL, fallbackConcepts: fb });
  await engine.init();
  domain = await engine.getDomain(engine.domainId);
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb.filter((c) => c.domainId === engine.domainId);
  syncBadge();
  $("#titleContext").textContent = `${domain?.label.en || engine.domainId} · 6 turns per sitting · trust moves faces before it moves numbers.`;
  $("#startBtn").addEventListener("click", startSit);
  $("#againBtn").addEventListener("click", startSit);
  $("#nextBtn").addEventListener("click", nextTurn);
  $("#quitBtn").addEventListener("click", endSit);
  cv.addEventListener("pointerdown", onTap);
}
function buildTurns() {
  const enc = core.ENCOUNTERS.find((e) => e.domainId === engine.domainId);
  if (enc) {
    const people = Object.fromEntries(enc.people.map((x) => [x.id, x]));
    return shuffle(enc.turns).map((t) => {
      const toT = t.direction.startsWith("en");
      const concept = concepts.find((c) => c.conceptId === t.conceptId) || concepts[0];
      const kind = t.effort.memory >= 4 ? "dense" : t.effort.listening >= 3 ? "long" : (concept.misconceptions?.length ? "ambiguous" : "clear");
      return { speaker: people[t.speaker]?.role || "Speaker", source: toT ? t.en : (t[targetLang] || t.es), faithful: toT ? (t[targetLang] || t.es) : t.en, concept, areaId: t.areaId, kind, stake: enc.premise };
    });
  }
  return shuffle(concepts).slice(0, 6).map((c) => {
    const ex = c.examples?.[0] || { en: c.definition.en, es: c.definition.es || c.definition.en, zh: c.definition.zh || c.definition.en };
    return { speaker: "Client", source: ex.en, faithful: ex[targetLang] || ex.es, concept: c, areaId: c.areaIds[0], kind: c.difficulty >= 3 ? "dense" : "clear", stake: `They need “${c.terms.en.term}” to survive this conversation intact.` };
  });
}
function startSit() {
  sit = { turns: buildTurns(), i: 0, trust: 62, good: 0, total: 0, phase: "strategy", options: [], faithfulText: "", mood: 0, t: 0 };
  show("screen-play"); loadTurn(); loop();
}
function loadTurn() {
  const t = sit.turns[sit.i];
  sit.phase = "strategy"; sit.mood = 0;
  $("#hudSit").textContent = domain?.label.en || engine.domainId;
  $("#hudTurn").textContent = `Turn ${sit.i + 1} / ${sit.turns.length}`;
  $("#trustFill").style.width = `${sit.trust}%`;
  if (sit.trust < 40) { t.kind = "dense"; $("#stakeLine").textContent = `Trust is thin — this turn needs slowing or chunking. At stake: ${t.stake}`; }
  else $("#stakeLine").textContent = `At stake: ${t.stake} Key thread: “${t.concept.terms.en.term}”.`;
  $("#feedback").textContent = "How do you handle it? Tap a gesture.";
  $("#nextBtn").hidden = true;
  speakTurn(t);
}
function speakTurn(t) { try { const u = new SpeechSynthesisUtterance(t.source); u.lang = "en-US"; u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} }
function chooseStrategy(id) {
  const t = sit.turns[sit.i];
  const s = STRATEGIES.find((x) => x.id === id);
  const apt = s.bestWhen === t.kind || (t.kind === "dense" && s.id === "chunk");
  sit.trust = Math.max(0, Math.min(100, sit.trust + (apt ? 6 : -7)));
  sit.mood = apt ? 1 : -1;
  $("#trustFill").style.width = `${sit.trust}%`;
  engine.recordEvidence({ conceptId: t.concept.conceptId, areaId: t.areaId, gameId: "the-table", activityType: "judgment", stage: 5, languageDirection: `en->${targetLang}`, correct: apt, score: apt ? 1 : 0.3, assistance: id === "clarify" || id === "slow" ? [id] : [], responseSummary: `Table gesture ${id} for ${t.kind} turn` });
  const wrongTerm = shuffle(concepts.filter((c) => c.conceptId !== t.concept.conceptId).map((c) => tgt(c)))[0] || "—";
  const otherEx = shuffle(concepts.filter((c) => c.conceptId !== t.concept.conceptId))[0];
  const otherFaithful = otherEx ? ((otherEx.examples?.[0] || {})[targetLang] || (otherEx.examples?.[0] || {}).es || "") : "";
  const distorted = t.faithful.includes(tgt(t.concept)) ? t.faithful.replace(tgt(t.concept), wrongTerm) : (/\d/.test(t.faithful) ? t.faithful.replace(/\d+(?:[.,]\d+)?/, (n) => String(Number(n.replace(",", ".")) + 1)) : (otherFaithful || t.faithful));
  sit.options = shuffle([t.faithful, distorted]);
  sit.faithfulText = t.faithful;
  sit.phase = "render";
  $("#feedback").textContent = apt ? "Well handled. Now stand behind words — tap your bubble." : "The room tightens. Words can still save it.";
  syncBadge();
}
function chooseRender(i) {
  const t = sit.turns[sit.i];
  const ok = sit.options[i] === sit.faithfulText;
  sit.total++; if (ok) sit.good++;
  sit.trust = Math.max(0, Math.min(100, sit.trust + (ok ? 8 : -12)));
  sit.mood = ok ? 2 : -2;
  $("#trustFill").style.width = `${sit.trust}%`;
  const r = bubbleRect(i);
  if (ok) { Juice.good(); juice.confetti(r.x + r.w / 2, r.y); } else { Juice.bad(); juice.shake(9); }
  const fb = $("#feedback"); fb.className = `feedback ${ok ? "good" : "bad"}`;
  fb.textContent = ok ? "They nod — not at your words, at being understood." : `That swaps “${tgt(t.concept)}” — the one thread this turn could not lose.`;
  engine.recordEvidence({ conceptId: t.concept.conceptId, areaId: t.areaId, gameId: "the-table", activityType: "integrated", stage: 8, languageDirection: `en->${targetLang}`, correct: ok, score: ok ? 1 : 0.15, ...(t.concept.misconceptions?.[0]?.tag ? { misconceptionTag: t.concept.misconceptions[0].tag } : {}), responseSummary: sit.options[i].slice(0, 160) });
  syncBadge(); sit.phase = "done";
  $("#nextBtn").hidden = false; $("#nextBtn").focus();
}
function onTap(e) {
  if (!sit) return;
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
  if (sit.phase === "strategy") for (let i = 0; i < 4; i++) { const b = gestureRect(i); if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { chooseStrategy(STRATEGIES[i].id); return; } }
  if (sit.phase === "render") for (let i = 0; i < sit.options.length; i++) { const b = bubbleRect(i); if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { chooseRender(i); return; } }
}
function nextTurn() { sit.i++; if (sit.i >= sit.turns.length || sit.trust <= 0) { endSit(); return; } loadTurn(); }
function loop() { if (!sit) return; sit.t++; draw(); juice.update(); if ($("#screen-play").classList.contains("is-active")) raf = requestAnimationFrame(loop); }
function draw() {
  const { x: sx, y: sy } = juice.shakeOffset();
  ctx.save(); ctx.translate(sx, sy);
  const t = sit.turns[sit.i];
  ctx.fillStyle = "#191008"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#241611"; ctx.fillRect(0, 0, W, 300);
  // wall lamps
  for (const lx of [150, 480, 810]) { ctx.fillStyle = "rgba(255,190,90,.14)"; ctx.beginPath(); ctx.arc(lx, 70, 46, 0, 7); ctx.fill(); ctx.fillStyle = "#ffbe5a"; ctx.beginPath(); ctx.arc(lx, 70, 10, 0, 7); ctx.fill(); }
  // oval table
  ctx.fillStyle = "#120806"; ctx.beginPath(); ctx.ellipse(480, 308, 352, 118, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#6b4226"; ctx.beginPath(); ctx.ellipse(480, 296, 352, 118, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#7d4f2c"; ctx.beginPath(); ctx.ellipse(480, 290, 330, 106, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#fdf6e3"; ctx.beginPath(); ctx.ellipse(480, 288, 120, 40, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#a63a2e"; ctx.beginPath(); ctx.ellipse(480, 288, 44, 15, 0, 0, 7); ctx.fill();
  // trust candle centrepiece: flame size follows trust
  const trust = sit.trust / 100;
  ctx.fillStyle = "#e8dcc0"; ctx.fillRect(470, 252, 20, 30);
  ctx.fillStyle = `rgba(255,${140 + Math.round(trust * 90)},40,.95)`;
  ctx.beginPath(); ctx.ellipse(480, 240 - trust * 8, 8 + trust * 6, 14 + trust * 12 + Math.sin(sit.t * 0.2) * 2, 0, 0, 7); ctx.fill();
  // faces: speaker (top-left), counterpart (top-right), you (bottom centre)
  face(240, 178, "#32506b", t.speaker, sit.mood);
  face(720, 178, "#5b3a5e", "Counterpart", sit.mood);
  face(480, 468 - 34, "#177a6c", "You · interpreter", 0, true);
  // source bubble over speaker
  bubble(84, 236, 330, 86, `“${t.source}”`);
  // phase UI
  ctx.textAlign = "center";
  if (sit.phase === "strategy") {
    ctx.fillStyle = "#fdf3e0"; ctx.font = "800 17px 'Public Sans', sans-serif";
    ctx.fillText("HOW DO YOU HANDLE THIS TURN?", 480, 428);
    STRATEGIES.forEach((s, i) => {
      const b = gestureRect(i);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 6, b.w, b.h, 12); ctx.fill();
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
      ctx.fillStyle = "#191008"; ctx.font = "800 26px 'Public Sans', sans-serif"; ctx.fillText(s.icon, b.x + b.w / 2, b.y + 34);
      ctx.font = "800 14px 'Public Sans', sans-serif"; ctx.fillText(s.label, b.x + b.w / 2, b.y + 58);
    });
  } else if (sit.phase === "render" || sit.phase === "done") {
    ctx.fillStyle = "#fdf3e0"; ctx.font = "800 17px 'Public Sans', sans-serif";
    ctx.fillText("STAND BEHIND ONE RENDERING", 480, 316 + 14);
    sit.options.forEach((o, i) => {
      const b = bubbleRect(i);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 6, b.w, b.h, 14); ctx.fill();
      ctx.fillStyle = "#fffdf6"; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 14); ctx.fill();
      ctx.strokeStyle = "#231a12"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#231a12"; ctx.font = "600 15px 'Public Sans', sans-serif"; ctx.textAlign = "left";
      wrap(o, b.x + 14, b.y + 26, b.w - 28, 19);
      ctx.textAlign = "center";
    });
  }
  juice.draw();
  ctx.restore();
}
function face(x, y, robe, label, mood, you = false) {
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y + 58, 36, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(x - 28, y + 56); ctx.quadraticCurveTo(x, y - 6, x + 28, y + 56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2c29b"; ctx.beginPath(); ctx.arc(x, y - 14, 16, 0, 7); ctx.fill();
  ctx.fillStyle = "#1c1410";
  ctx.beginPath(); ctx.arc(x - 6, y - 16, 2.2, 0, 7); ctx.arc(x + 6, y - 16, 2.2, 0, 7); ctx.fill();
  ctx.strokeStyle = "#1c1410"; ctx.lineWidth = 2; ctx.beginPath();
  if (mood > 0) ctx.arc(x, y - 4, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood < 0) ctx.arc(x, y + 6, 7, 1.15 * Math.PI, 1.85 * Math.PI);
  else { ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 6, y - 5); }
  ctx.stroke();
  ctx.font = "700 12px 'Public Sans', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#d9c9a3";
  ctx.fillText(label.toUpperCase().slice(0, 22), x, y + 76);
  if (you) { ctx.fillStyle = "#7fe3c8"; ctx.beginPath(); ctx.arc(x + 22, y - 30, 5, 0, 7); ctx.fill(); }
}
function bubble(x, y, w, h, text) {
  ctx.fillStyle = "#fffdf6"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = "#231a12"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#231a12"; ctx.font = "600 14px 'Public Sans', sans-serif"; ctx.textAlign = "left";
  wrap(text, x + 13, y + 23, w - 26, 18);
}
function wrap(text, x, y, maxW, lh) {
  const words = String(text).split(/\s+/); let line = "", yy = y;
  for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); yy += lh; line = w; } else line = test; }
  if (line) ctx.fillText(line, x, yy);
}
async function endSit() {
  if (raf) cancelAnimationFrame(raf); raf = null;
  const s = sit;
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = s && s.trust > 55 ? "They would ask for you again. By name." : "Trust is reparable — that is why there is a next sitting.";
  const dm = dailyMark("the-table", s?.trust || 0);
  $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Best trust <strong>${dm.best}%</strong> · Faithful <strong>${s?.good || 0}/${s?.total || 0}</strong> · Trust <strong>${s?.trust || 0}%</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Sit again.")}<br><span class="hint">Strategy and fidelity fail differently — the engine keeps them separate.</span>`;
  show("screen-end"); sit = null; syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Table failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
