// The Table — integrated negotiation of meaning (Stages 5 & 8 + judgment).
// Two decisions per turn: HOW to handle it (clarify / chunk / render / slow),
// then WHICH rendering to stand behind. Strategy errors and fidelity errors
// are different evidence — the engine finally records both.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
import { Juice } from "../../../packages/game-kit/juice.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, domain, concepts = [], targetLang = "es";
let sit = null;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); d.plays = (d.plays || 0) + 1; localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }

const STRATEGIES = [
  { id: "clarify", label: "Clarify first", sub: "Name what you missed, in the open, as the interpreter.", bestWhen: "ambiguous" },
  { id: "chunk", label: "Chunk & check", sub: "Render in pieces, confirming as you go.", bestWhen: "long" },
  { id: "render", label: "Render now, whole", sub: "You hold it. Carry it across in one breath.", bestWhen: "clear" },
  { id: "slow", label: "Slow the room", sub: "Ask speakers to pause between points. Buys memory with manners.", bestWhen: "dense" },
];

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
  $("#titleContext").textContent = `${domain?.label.en || engine.domainId} · 6 turns per sitting · trust is spent and earned in the open.`;
  $("#startBtn").addEventListener("click", startSit);
  $("#againBtn").addEventListener("click", startSit);
  $("#nextBtn").addEventListener("click", nextTurn);
  $("#quitBtn").addEventListener("click", endSit);
}

function buildTurns() {
  const enc = core.ENCOUNTERS.find((e) => e.domainId === engine.domainId);
  if (enc) {
    const people = Object.fromEntries(enc.people.map((x) => [x.id, x]));
    return shuffle(enc.turns).map((t) => {
      const toT = t.direction.startsWith("en");
      const concept = concepts.find((c) => c.conceptId === t.conceptId) || concepts[0];
      const kind = t.effort.memory >= 4 ? "dense" : t.effort.listening >= 3 ? "long" : (concept.misconceptions?.length ? "ambiguous" : "clear");
      return { speaker: people[t.speaker]?.role || "Speaker", name: people[t.speaker]?.role || "Guest", source: toT ? t.en : (t[targetLang] || t.es), faithful: toT ? (t[targetLang] || t.es) : t.en, concept, areaId: t.areaId, kind, stake: enc.premise };
    });
  }
  // Any other domain: sittings minted from its own concepts (tenancy-safe).
  return shuffle(concepts).slice(0, 6).map((c) => {
    const ex = c.examples?.[0] || { en: c.definition.en, es: c.definition.es || c.definition.en, zh: c.definition.zh || c.definition.en };
    return { speaker: "Client", name: "Client", source: ex.en, faithful: ex[targetLang] || ex.es, concept: c, areaId: c.areaIds[0], kind: c.difficulty >= 3 ? "dense" : "clear", stake: `They need “${c.terms.en.term}” to survive this conversation intact.` };
  });
}

function startSit() {
  const turns = buildTurns();
  sit = { turns, i: 0, trust: 62, good: 0, total: 0, phase: "strategy" };
  show("screen-play"); loadTurn();
}
function loadTurn() {
  const t = sit.turns[sit.i];
  $("#hudSit").textContent = domain?.label.en || engine.domainId;
  $("#hudTurn").textContent = `Turn ${sit.i + 1} / ${sit.turns.length}`;
  $("#trustFill").style.width = `${sit.trust}%`;
  $("#faceA").textContent = t.speaker.slice(0, 1); $("#nameA").textContent = `${t.speaker}`;
  $("#bubbleText").textContent = `“${t.source}”`;
  if (sit.trust < 40) { t.kind = "dense"; $("#stakeLine").textContent = `The room is impatient — trust is thin, so this turn needs slowing or chunking. At stake: ${t.stake} Key thread: “${t.concept.terms.en.term}”.`; }
  else $("#stakeLine").textContent = `At stake: ${t.stake} Key thread: “${t.concept.terms.en.term}”.`;
  $("#feedback").textContent = ""; $("#nextBtn").hidden = true;
  sit.phase = "strategy";
  $("#choiceZone").innerHTML = `<p class="stake-line">First: how do you handle this turn?</p><div class="choice-grid">${STRATEGIES.map((s) => `<button type="button" class="choice-btn" data-strategy="${s.id}">${esc(s.label)}<small>${esc(s.sub)}</small></button>`).join("")}</div>`;
  document.querySelectorAll("[data-strategy]").forEach((b) => b.addEventListener("click", () => chooseStrategy(b.dataset.strategy)));
}
function chooseStrategy(id) {
  const t = sit.turns[sit.i];
  const s = STRATEGIES.find((x) => x.id === id);
  const apt = s.bestWhen === t.kind || (t.kind === "dense" && s.id === "chunk");
  sit.trust = Math.max(0, Math.min(100, sit.trust + (apt ? 6 : -7)));
  $("#trustFill").style.width = `${sit.trust}%`;
  engine.recordEvidence({ conceptId: t.concept.conceptId, areaId: t.areaId, gameId: "the-table", activityType: "judgment", stage: 5, languageDirection: `en->${targetLang}`, correct: apt, score: apt ? 1 : 0.3, assistance: id === "clarify" || id === "slow" ? [id] : [], responseSummary: `Table strategy ${id} for ${t.kind} turn` });
  // Now the rendering choice (faithful vs. neighbor-swapped distortion)
  const wrongTerm = shuffle(concepts.filter((c) => c.conceptId !== t.concept.conceptId).map((c) => tgt(c)))[0] || "—";
  const otherEx = shuffle(concepts.filter((c) => c.conceptId !== t.concept.conceptId))[0];
  const otherFaithful = otherEx ? ((otherEx.examples?.[0] || {})[targetLang] || (otherEx.examples?.[0] || {}).es || "") : "";
  const distorted = t.faithful.includes(tgt(t.concept)) ? t.faithful.replace(tgt(t.concept), wrongTerm) : (/\d/.test(t.faithful) ? t.faithful.replace(/\d+(?:[.,]\d+)?/, (n) => String(Number(n.replace(",", ".")) + 1)) : (otherFaithful || t.faithful));
  const options = shuffle([t.faithful, distorted]);
  sit.faithfulText = t.faithful;
  $("#choiceZone").innerHTML = `<p class="stake-line">${apt ? "Well handled. Now stand behind words:" : "The room tightens — that handling cost trust. Words can still save it:"}</p><div class="choice-grid">${options.map((o) => `<button type="button" class="choice-btn" data-render="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  document.querySelectorAll("[data-render]").forEach((b) => b.addEventListener("click", () => chooseRender(b)));
  syncBadge();
}
function chooseRender(btn) {
  const t = sit.turns[sit.i];
  const ok = btn.dataset.render === sit.faithfulText;
  sit.total++; if (ok) sit.good++;
  sit.trust = Math.max(0, Math.min(100, sit.trust + (ok ? 8 : -12)));
  $("#trustFill").style.width = `${sit.trust}%`;
  document.querySelectorAll("[data-render]").forEach((b) => { b.disabled = true; });
  btn.style.borderColor = ok ? "#0f5a4f" : "#a63a2e";
  const fb = $("#feedback");
  fb.className = `feedback ${ok ? "good" : "bad"}`;
  fb.textContent = ok ? "They nod — not at your words, at being understood. Trust is the receipt." : `That rendering swaps “${tgt(t.concept)}” — the one thread this turn could not lose. The table feels it before anyone names it.`;
  engine.recordEvidence({ conceptId: t.concept.conceptId, areaId: t.areaId, gameId: "the-table", activityType: "integrated", stage: 8, languageDirection: `en->${targetLang}`, correct: ok, score: ok ? 1 : 0.15, ...( !ok && t.concept.misconceptions?.[0]?.tag ? { misconceptionTag: t.concept.misconceptions[0].tag } : {}), responseSummary: btn.dataset.render.slice(0, 160) });
  syncBadge();
  $("#nextBtn").hidden = false; $("#nextBtn").focus();
}
function nextTurn() { sit.i++; if (sit.i >= sit.turns.length || sit.trust <= 0) { endSit(); return; } loadTurn(); }
async function endSit() {
  const s = sit; sit = null;
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = s && s.trust > 55 ? "They would ask for you again. By name." : "Trust is reparable — that is why there is a next sitting.";
  const dm = dailyMark("the-table", s?.trust || 0); $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Best trust kept <strong>${dm.best}%</strong> · Faithful renderings <strong>${s?.good || 0}/${s?.total || 0}</strong> · Trust at adjournment <strong>${s?.trust || 0}%</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Sit again.")}<br><span class="hint">The Table alone records strategy (Stage 5 judgment) separately from fidelity (Stage 8) — handlers and translators fail differently.</span>`;
  show("screen-end"); syncBadge();
}
Juice.observeFeedback("#turnFeedback");
boot().catch((e) => { $("#titleContext").textContent = `Table failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
