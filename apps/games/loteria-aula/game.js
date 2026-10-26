// Lotería de Aula — group/classroom calling game (Stages 1–2).
// The caller speaks the study language; boards carry English. Listening in a
// room full of people is the oldest language classroom technology there is.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, concepts = [], targetLang = "es", demoMode = false;
let G = null;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function speak(t, lang) { try { const u = new SpeechSynthesisUtterance(t); u.lang = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : "en-US"; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }

async function boot() {
  const p = new URLSearchParams(location.search);
  const customTitle = p.get("title"); if (customTitle) { const h = document.querySelector("h1"); if (h) h.textContent = customTitle; }
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  demoMode = localStorage.getItem("ev:demoMode") === "1";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "oregon-medical";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.OREGON_MEDICAL, fallbackConcepts: fb });
  await engine.init();
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb.filter((c) => c.domainId === engine.domainId);
  syncBadge();
  const dom = await engine.getDomain(engine.domainId);
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · ${concepts.length} cards in the deck · caller speaks ${targetLang === "zh" ? "中文" : "Español"}, boards answer in English.${demoMode ? " Demo mode: English subtitles under every call." : ""}`;
  $("#startBtn").addEventListener("click", startGame);
  $("#againBtn").addEventListener("click", startGame);
  $("#callBtn").addEventListener("click", callNext);
  $("#repeatBtn").addEventListener("click", () => { if (G?.current) speak(tgt(G.current), targetLang); });
  $("#quitBtn").addEventListener("click", () => endGame(null));
  window.addEventListener("keydown", (e) => { if (e.code === "Space" && $("#screen-play").classList.contains("is-active")) { e.preventDefault(); callNext(); } });
}
function startGame() {
  const n = Number($("#boardCount").value || 4);
  const pool = shuffle(concepts);
  const BOARD_NAMES = ["La Valiente", "El Soñador", "La Abuela Sabia", "El Rayo"];
  const boards = Array.from({ length: n }, (_, b) => ({ name: `Tabla ${b + 1} · ${BOARD_NAMES[b % BOARD_NAMES.length]}`, cells: shuffle(pool).slice(0, 16), marked: new Set(), won: false }));
  // Guarantee every board shares the deck pool; deck is all concepts shuffled.
  G = { boards, deck: shuffle(concepts), idx: -1, current: null, correct: 0, wrong: 0, winner: null };
  $("#boards").innerHTML = boards.map((b, bi) => `<section class="board" id="board-${bi}"><h3>${esc(b.name)}</h3><div class="grid">${b.cells.map((c, ci) => `<button type="button" class="cell" data-board="${bi}" data-cell="${ci}">${esc(c.terms.en.term)}<small>${esc(c.terms.en.term === tgt(c) ? "" : "")}</small></button>`).join("")}</div></section>`).join("");
  document.querySelectorAll("[data-board]").forEach((btn) => btn.addEventListener("click", () => mark(btn)));
  show("screen-play"); hud(); $("#feedback").textContent = "Boards ready. Caller — ¡corre y se va!";
}
function hud() { $("#deckPill").textContent = G ? `Cards left ${Math.max(0, G.deck.length - G.idx - 1)}` : ""; }
function callNext() {
  if (!G || G.winner) return;
  G.idx++;
  if (G.idx >= G.deck.length) { endGame(null); return; }
  G.current = G.deck[G.idx];
  const CRIES = ["¡Corre y se va!", "¡La buena, escuchen!", "¡Atención, la siguiente!", "¡Se va, se va…!"];
  $("#feedback").textContent = CRIES[G.idx % CRIES.length];
  $("#callerTerm").textContent = tgt(G.current);
  $("#callerSub").textContent = demoMode ? `English: ${G.current.terms.en.term}` : "";
  speak(tgt(G.current), targetLang);
  hud();
}
function mark(btn) {
  if (!G?.current || G.winner) { if (!G?.current) $("#feedback").textContent = "Call a card first — ears before fingers."; return; }
  const bi = Number(btn.dataset.board), ci = Number(btn.dataset.cell);
  const board = G.boards[bi], c = board.cells[ci];
  if (board.marked.has(ci)) return;
  if (c.conceptId === G.current.conceptId) {
    board.marked.add(ci); btn.classList.add("marked"); G.correct++;
    engine.recordEvidence({ conceptId: c.conceptId, areaId: c.areaIds[0], gameId: "loteria-aula", activityType: "terminology", stage: 1, languageDirection: `${targetLang}->en`, correct: true, score: 1, responseSummary: `Lotería: heard ${tgt(c)}, marked ${c.terms.en.term} (Tabla ${bi + 1})` });
    $("#feedback").textContent = `¡Buena! Tabla ${bi + 1} marks “${c.terms.en.term}”.`; $("#feedback").className = "feedback good";
    const winKind = checkWin(board);
    if (winKind) { startInterpretation(board, winKind); return; }
  } else {
    G.wrong++; btn.classList.add("wrong"); setTimeout(() => btn.classList.remove("wrong"), 600);
    engine.recordEvidence({ conceptId: G.current.conceptId, areaId: G.current.areaIds[0], gameId: "loteria-aula", activityType: "terminology", stage: 1, languageDirection: `${targetLang}->en`, correct: false, score: 0, responseSummary: `Lotería: marked ${c.terms.en.term} for ${tgt(G.current)}` });
    $("#feedback").textContent = `Not that one — the call was “${tgt(G.current)}”${demoMode ? ` (${G.current.terms.en.term})` : ""}. Listen again.`; $("#feedback").className = "feedback bad";
  }
  syncBadge();
}
function checkWin(board) {
  const m = board.marked, has = (...idx) => idx.every((i) => m.has(i));
  for (let r = 0; r < 4; r++) if (has(r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3)) return `a full row`;
  for (let c = 0; c < 4; c++) if (has(c, c + 4, c + 8, c + 12)) return `a full column`;
  if (has(0, 5, 10, 15) || has(3, 6, 9, 12)) return `the diagonal`;
  if (m.size === 16) return `¡tabla llena!`;
  return null;
}

function startInterpretation(board, winKind) {
  // A line is not a win until its meaning survives a sentence. The winning
  // tabla must interpret one full sentence carrying the called concept.
  G.pendingWin = board;
  const c = G.current;
  const ex = c.examples?.[0] || { en: c.definition.en, es: c.definition.es || c.definition.en };
  const faithful = ex[targetLang] || ex.es;
  const wrongConcept = concepts.find((x) => x.conceptId !== c.conceptId);
  const wrongTerm = wrongConcept ? (wrongConcept.terms[targetLang]?.term || wrongConcept.terms.es.term) : "—";
  const myTerm = c.terms[targetLang]?.term || c.terms.es.term;
  const distorted = faithful.includes(myTerm) ? faithful.replace(myTerm, wrongTerm) : `${faithful} (${wrongTerm})`;
  const options = [faithful, distorted].sort(() => Math.random() - 0.5);
  let panel = document.querySelector("#interpRound");
  if (!panel) { panel = document.createElement("section"); panel.id = "interpRound"; panel.className = "caller panel"; document.querySelector("#boards").before(panel); }
  panel.hidden = false;
  panel.innerHTML = `<p class="kicker">La ronda del sentido · ${esc(board.name)} has ${esc(winKind)} — now interpret to keep it</p><div class="caller-card"><span>“${esc(ex.en)}”</span><small class="demo-sub">${demoMode ? `Carry it into ${targetLang === "zh" ? "中文" : "Español"} — meaning, not words.` : ""}</small></div><div class="caller-actions">${options.map((o) => `<button type="button" class="btn" data-interp="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  panel.querySelectorAll("[data-interp]").forEach((btn) => btn.addEventListener("click", () => {
    const ok = btn.dataset.interp === faithful;
    engine.recordEvidence({ conceptId: c.conceptId, areaId: c.areaIds[0], gameId: "loteria-aula", activityType: "interpretation", stage: 8, languageDirection: `en->${targetLang}`, correct: ok, score: ok ? 1 : 0.1, responseSummary: `Lotería sentido round: ${ok ? "carried" : "dropped"} ${c.conceptId}` });
    panel.hidden = true;
    if (ok) { board.won = true; G.winner = board; document.querySelectorAll(".board")[G.boards.indexOf(board)]?.classList.add("winner"); endGame(board); }
    else { G.pendingWin = null; $("#feedback").textContent = `The line slips away — “${faithful}” was the carrying. Lines can be re-won; meanings must be kept.`; $("#feedback").className = "feedback bad"; }
    syncBadge();
  }));
  $("#feedback").textContent = `${board.name} lines up ${winKind}! One sentence stands between them and ¡Lotería!`; $("#feedback").className = "feedback";
  speak(ex.en, "en");
}

async function endGame(winner) {
  const g = G; const dm = dailyMark("loteria-aula", g?.correct || 0);
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = winner ? `¡LOTERÍA! ${winner.name} takes the room.` : "The deck rests. The room learned out loud.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Heard &amp; marked <strong>${g?.correct || 0}</strong> · Wrong taps <strong>${g?.wrong || 0}</strong> · Cards called <strong>${(g?.idx ?? -1) + 1}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Shuffle a new game.")}<br><span class="hint">Every mark was listening evidence (Stage 1, ${targetLang}→EN) gathered at party volume — assessment the room enjoyed giving.</span>`;
  show("screen-end"); syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Lotería failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
