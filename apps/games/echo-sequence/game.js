// Echo Sequence — memory-thread garden (Stages 6–7: retrieve in order, produce).
// Simon's discipline with interpreter stakes: the sequence is a turn's load-bearing
// items (term, number, negation, date), so order memory is professional memory.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, concepts = [], targetLang = "es";
let game = null, momentConceptId = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function speak(t, lang) { try { const u = new SpeechSynthesisUtterance(t); u.lang = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : "en-US"; u.rate = 0.95; speechSynthesis.speak(u); } catch {} }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); d.plays = (d.plays || 0) + 1; localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

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

  // Your moment: the engine's recommendation for THIS learner, right now,
  // opens the session — depth of system in service of depth of learning.
  try { const areas = JSON.parse(localStorage.getItem("ev:interestAreas") || "[]"); if (areas.length) { const f = concepts.filter((c) => c.areaIds.some((a) => areas.includes(a))); if (f.length >= 4) concepts = f; } } catch {}
  try { const nx = await engine.getNext(engine.domainId, { modeId: (JSON.parse(localStorage.getItem("ev:modes") || "[]")[0] || null) }); if (nx?.conceptId && concepts.some((c) => c.conceptId === nx.conceptId)) { momentConceptId = nx.conceptId; const mc = concepts.find((c) => c.conceptId === nx.conceptId); const el = document.querySelector("#titleContext"); if (el && mc) el.textContent += ` Your moment: “${mc.terms.en.term}” (Stage ${nx.stage}) opens this session.`; } } catch {}
  syncBadge();
  const dom = await engine.getDomain(engine.domainId);
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · stones speak English → ${targetLang === "zh" ? "中文" : "Español"} · 3 petals (lives) per walk.`;
  $("#startBtn").addEventListener("click", startGame);
  $("#againBtn").addEventListener("click", startGame);
  $("#quitBtn").addEventListener("click", endGame);
  $("#replayBtn").addEventListener("click", async () => { if (game && game.petals > 0) { game.petals--; game.replayUsed = true; hud(); await playSequence(); } });
}

function startGame() {
  const momentC = momentConceptId && concepts.find((c) => c.conceptId === momentConceptId);
  const pool = momentC ? [momentC, ...shuffle(concepts.filter((c) => c.conceptId !== momentC.conceptId)).slice(0, 9)] : shuffle(concepts).slice(0, 10);
  game = { pool, sequence: [], input: [], round: 0, petals: 3, perfect: 0, accepting: false, replayUsed: false, reverse: false };
  show("screen-play"); nextRound();
}
function hud() { $("#hudRound").textContent = `Round ${game.round}`; $("#hudThread").textContent = `Thread ${game.sequence.length} stones`; $("#hudLives").textContent = `Petals ${"●".repeat(Math.max(0, game.petals))}${"○".repeat(Math.max(0, 3 - game.petals))}`; }
async function nextRound() {
  game.round++; game.input = []; game.replayUsed = false; game.reverse = game.round % 3 === 0;
  game.sequence.push(game.pool[(game.round - 1) % game.pool.length]);
  hud(); renderStones(true);
  $("#feedback").textContent = ""; $("#phaseLabel").textContent = "Watch the stones…";
  await wait(600); await playSequence();
}
function renderStones(disabled) {
  $("#stoneField").innerHTML = game.pool.map((c, i) => `<button type="button" class="stone" data-stone="${i}" ${disabled ? "disabled" : ""}>${esc(c.terms.en.term)}${game.reverse ? "" : `<br><small>${esc(tgt(c))}</small>`}</button>`).join("");
  document.querySelectorAll("[data-stone]").forEach((b) => b.addEventListener("click", () => tapStone(Number(b.dataset.stone))));
}
async function playSequence() {
  game.accepting = false; renderStones(true);
  for (const c of game.sequence) {
    const idx = game.pool.indexOf(c);
    const el = document.querySelector(`[data-stone="${idx}"]`);
    el?.classList.add("lit");
    const reverse = game.reverse;
    speak(reverse ? tgt(c) : c.terms.en.term, reverse ? targetLang : "en");
    const pace = Math.max(360, 750 - game.round * 40);
    await wait(pace); el?.classList.remove("lit"); await wait(200);
  }
  game.accepting = true; renderStones(false);
  $("#phaseLabel").textContent = game.round % 3 === 0 ? "Reverse walk — you heard it in the other language. Same order." : "Your walk — same order.";
}
async function tapStone(i) {
  if (!game?.accepting) return;
  const c = game.pool[i];
  const el = document.querySelector(`[data-stone="${i}"]`);
  speak(game.reverse ? c.terms.en.term : tgt(c), game.reverse ? "en" : targetLang);
  const expected = game.sequence[game.input.length];
  game.input.push(c);
  if (c.conceptId !== expected.conceptId) {
    el?.classList.add("bad"); game.petals--; game.accepting = false;
    $("#feedback").textContent = `Thread slipped at stone ${game.input.length} — it was “${expected.terms.en.term}”. Order is the evidence.`; $("#feedback").className = "feedback bad";
    engine.recordEvidence({ conceptId: expected.conceptId, areaId: expected.areaIds[0], gameId: "echo-sequence", activityType: "retrieval", stage: 6, languageDirection: `en->${targetLang}`, correct: false, score: 0.2, assistance: game.replayUsed ? ["replay"] : [], responseSummary: `Echo slipped at position ${game.input.length} of ${game.sequence.length}` });
    syncBadge(); hud();
    if (game.petals <= 0) { setTimeout(endGame, 900); return; }
    await wait(900); game.input = []; renderStones(true); $("#phaseLabel").textContent = "Watch once more…"; await playSequence(); return;
  }
  el?.classList.add("good"); setTimeout(() => el?.classList.remove("good"), 300);
  if (game.input.length === game.sequence.length) {
    game.accepting = false; game.perfect++;
    $("#feedback").textContent = "Whole thread held, in order, in the other language. That is consecutive memory doing its quiet work."; $("#feedback").className = "feedback good";
    for (const s of game.sequence) engine.recordEvidence({ conceptId: s.conceptId, areaId: s.areaIds[0], gameId: "echo-sequence", activityType: "spoken-production", stage: 7, languageDirection: `en->${targetLang}`, correct: true, score: game.replayUsed ? 0.7 : 1, assistance: game.replayUsed ? ["replay"] : [], responseSummary: `Echo thread of ${game.sequence.length} held` });
    syncBadge(); hud();
    if (game.sequence.length >= 10) { setTimeout(endGame, 800); return; }
    setTimeout(nextRound, 950);
  }
}
async function endGame() {
  const g = game; game = null;
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = (g?.perfect || 0) >= 4 ? "You hold long turns without dropping the world." : "The garden remembers where threads slip — so will you.";
  const dm = dailyMark("echo-sequence", g?.sequence.length || 0); $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Longest thread ever <strong>${dm.best}</strong> · Rounds <strong>${g?.round || 0}</strong> · Perfect threads <strong>${g?.perfect || 0}</strong> · Longest thread <strong>${g?.sequence.length || 0}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Walk again.")}<br><span class="hint">Echo alone proves ordered retrieval + production (Stages 6–7). Rush proves speed; Shift proves survival.</span>`;
  show("screen-end"); syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Garden failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
