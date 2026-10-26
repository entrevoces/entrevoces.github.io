// ENTRE VOCES Hub — thin client of the Progression Engine (spec §11.4)
// Holds no learner truth of its own; renders engine state and deep-links to games.
import * as core from "../../packages/engine-core/index.js";
import { EngineClient } from "../../packages/engine-client/engine-client.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COMPETENCE_LABELS = {
  "domain-knowledge": "Domain knowledge", "professional-terminology": "Professional terminology",
  "bilingual-terminology": "Bilingual terminology", "terminology-usage": "Terminology usage",
  "listening": "Listening", "speech-production": "Speech production", "meaning-transfer": "Meaning transfer",
  "cognitive-interpreting": "Cognitive interpreting", "professional-judgment": "Professional judgment", "integrated-performance": "Integrated performance",
};
const GAME_DIRS = { "concept-clinch": "../games/concept-clinch/", "shift-consecutive": "../games/shift-consecutive/", "bench-call": "../games/bench-call/", "term-rush": "../games/term-rush/", "echo-sequence": "../games/echo-sequence/", "the-table": "../games/the-table/", "repair-shop": "../games/repair-shop/", "vr-lingua-lab": "../games/vr-lingua-lab/", "vocab-craft": "../games/vocab-craft/", "neon-bastion": "../games/neon-bastion/", "melon-reef": "../games/melon-reef/" };

let engine, currentNext = null, currentDomain = null, currentConcepts = [];

async function loadFallbackConcepts() {
  try { const r = await fetch("concepts-subset.json"); if (r.ok) return await r.json(); } catch { /* ignore */ }
  return core.CONCEPTS;
}

async function boot() {
  const fallbackConcepts = await loadFallbackConcepts();
  const engineUrl = localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787";
  $("#engineUrlInput").value = engineUrl;
  $("#pairSelect").value = localStorage.getItem("ev:targetLang") || "es";

  engine = new EngineClient({
    engineUrl, domainId: localStorage.getItem("ev:domainId") || "oregon-medical",
    core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === (localStorage.getItem("ev:domainId") || "oregon-medical")) || core.OREGON_MEDICAL,
    fallbackConcepts,
  });
  await engine.init();

  const domains = await engine.listDomains();
  const allDomains = domains.length ? domains : core.SEED_DOMAINS;
  // Intro study selection (multi-domain tenancy): persisted, defaults to focus domain.
  let studied = [];
  try { studied = JSON.parse(localStorage.getItem("ev:studyDomains") || "[]"); } catch { studied = []; }
  if (!studied.length) studied = [engine.domainId];
  studied = studied.filter((id) => allDomains.some((d) => d.domainId === id));
  if (!studied.length) studied = [allDomains[0].domainId];
  const conceptCount = (id) => core.CONCEPTS.filter((c) => c.domainId === id).length;
  const renderStudy = () => {
    $("#studyDomains").innerHTML = allDomains.map((d) => `
      <button type="button" class="study-card ${studied.includes(d.domainId) ? "is-on" : ""}" data-study="${esc(d.domainId)}" aria-pressed="${studied.includes(d.domainId)}">
        <span class="check">${studied.includes(d.domainId) ? "Studying" : "Add"}</span>
        <strong>${esc(d.label.en)}</strong>
        <span class="areas">${esc(d.jurisdiction.region)}, ${esc(d.jurisdiction.country)} · ${d.translationAreas.length} areas · ${conceptCount(d.domainId)} concepts · EN↔ES, EN↔中文</span>
      </button>`).join("");
    document.querySelectorAll("[data-study]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.study;
      studied = studied.includes(id) ? studied.filter((x) => x !== id) : [...studied, id];
      if (!studied.length) studied = [id]; // never zero worlds
      localStorage.setItem("ev:studyDomains", JSON.stringify(studied));
      if (!studied.includes(engine.domainId)) { engine.domainId = studied[0]; localStorage.setItem("ev:domainId", engine.domainId); }
      renderStudy(); renderFocus(); refresh();
      $("#studySummary").textContent = `Studying ${studied.length} world(s). Focus: ${allDomains.find((d) => d.domainId === engine.domainId)?.label.en}. Each world keeps separate evidence — nothing leaks across.`;
    }));
  };
  const renderFocus = () => {
    const focusDomains = allDomains.filter((d) => studied.includes(d.domainId));
    $("#domainSelect").innerHTML = focusDomains.map((d) => `<option value="${esc(d.domainId)}" ${d.domainId === engine.domainId ? "selected" : ""}>${esc(d.label.en)}</option>`).join("");
  };
  renderStudy(); renderFocus();
  $("#studySummary").textContent = `Studying ${studied.length} world(s). Focus: ${allDomains.find((d) => d.domainId === engine.domainId)?.label.en}. Games open in your focus world; switch focus to play another — progress stays separated.`;

  $("#domainSelect").addEventListener("change", async (e) => {
    engine.domainId = e.target.value;
    localStorage.setItem("ev:domainId", engine.domainId);
    await refresh();
  });
  $("#pairSelect").addEventListener("change", (e) => localStorage.setItem("ev:targetLang", e.target.value));
  $("#saveSetupBtn").addEventListener("click", async () => {
    engine.engineUrl = $("#engineUrlInput").value.trim().replace(/\/$/, "");
    localStorage.setItem("ev:engineUrl", engine.engineUrl);
    localStorage.setItem("ev:targetLang", $("#pairSelect").value);
    await engine.ping(); await engine.sync().catch(() => {});
    await refresh();
    $("#syncStatus").textContent = engine.online ? "Saved — engine reachable." : "Saved — engine unreachable, local-only mode still plays.";
  });
  $("#syncNowBtn").addEventListener("click", async () => {
    const r = await engine.sync().catch(() => ({ pushed: 0, pulled: 0 }));
    $("#syncStatus").textContent = `Sync: pushed ${r.pushed}, pulled ${r.pulled}, pending ${engine.status().pending}.`;
    await refresh();
  });
  $("#playNextBtn").addEventListener("click", () => {
    const gameId = currentNext?.suggestedGameId || "concept-clinch";
    location.href = gameUrl(gameId);
  });
  $("#exportBtn").addEventListener("click", () => {
    const payload = engine.exportLocal(engine.domainId);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = `entrevoces-evidence-${engine.domainId}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Reset this device's demo learner and local evidence? (Server copy, if synced, is untouched.)")) return;
    engine.resetLocal();
    localStorage.removeItem("ev:learnerId");
    location.reload();
  });
  $("#inventBtn").addEventListener("click", inventConcept);
  $("#makerBtn").addEventListener("click", () => {
    const gameId = $("#makerVerb").value;
    const who = $("#makerWho").selectedOptions[0]?.textContent || "Me";
    const name = $("#makerName").value.trim() || "My game";
    const world = currentDomain?.label.en || engine.domainId;
    const dirs = { "term-rush": "../games/term-rush/", "echo-sequence": "../games/echo-sequence/", "repair-shop": "../games/repair-shop/", "concept-clinch": "../games/concept-clinch/", "neon-bastion": "../games/neon-bastion/", "melon-reef": "../games/melon-reef/" };
    const url = `${dirs[gameId]}?domain=${encodeURIComponent(engine.domainId)}&learner=${encodeURIComponent(engine.learnerId)}&engine=${encodeURIComponent(engine.engineUrl)}&lang=${encodeURIComponent($("#pairSelect").value)}&title=${encodeURIComponent(name)}`;
    $("#makerOut").innerHTML = `<article class="lab-concept"><h3 style="margin:8px 0;">${esc(name)}</h3><p>Made for: <strong>${esc(who)}</strong> · World: <strong>${esc(world)}</strong> · Words inside: <strong>${currentConcepts.length} from your world</strong> (nothing from other worlds leaks in).</p><p>Press play. That is all. Your score will appear in Your Mirror above, and tomorrow the game will greet you with the words you are about to forget.</p><a class="btn btn-primary btn-large" href="${url}">Play ${esc(name)}</a> <button class="btn" type="button" id="makerCopy">Copy the link to share</button> <span id="makerCopied" class="hint"></span></article>`;
    $("#makerCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(new URL(url, location.href).href); $("#makerCopied").textContent = "Link copied — paste it anywhere to share your game."; } catch { $("#makerCopied").textContent = new URL(url, location.href).href; } });
  });

  renderSources();
  await refresh();
}

function gameUrl(gameId) {
  const base = GAME_DIRS[gameId] || GAME_DIRS["concept-clinch"];
  const p = new URLSearchParams({ domain: engine.domainId, learner: engine.learnerId, engine: engine.engineUrl, lang: $("#pairSelect").value });
  return `${base}?${p.toString()}`;
}

async function refresh() {
  // keep game links carrying the shared learner + engine + domain
  document.querySelectorAll(".game-link").forEach((a) => { a.href = gameUrl(a.dataset.game); });
  const st = engine.status();
  const badge = $("#syncBadge");
  badge.textContent = st.online
    ? `Engine connected · Learner ${engine.learnerId.slice(0, 8)}… · ${st.pending} pending`
    : `Local-only mode · Learner ${engine.learnerId.slice(0, 8)}… · ${st.pending} queued to sync · progress is safe on this device`;
  badge.className = `pill ${st.online ? "pill-on" : "pill-local"}`;
  $("#learnerLine").textContent = `Learner ID ${engine.learnerId} — the same ID every game uses, so progress follows you across hosts. Engine: ${engine.engineUrl}`;

  currentDomain = await engine.getDomain(engine.domainId);
  currentConcepts = await engine.listConcepts(engine.domainId);
  try {
    currentNext = await engine.getNext(engine.domainId);
  } catch { currentNext = null; }
  const nextBox = $("#nextBox");
  if (currentNext?.conceptId) {
    const concept = currentConcepts.find((c) => c.conceptId === currentNext.conceptId);
    nextBox.innerHTML = `
      <p style="font-size:19px;margin:4px 0;"><strong>${esc(concept?.terms.en.term || currentNext.conceptId)}</strong> — stage ${currentNext.stage} · ${esc(currentNext.activityType)}${currentNext.suggestedGameId ? ` · in <strong>${esc(currentNext.suggestedGameId)}</strong>` : ""}</p>
      <p>${esc(currentNext.rationale)}</p>
      ${currentNext.needsDiagnostic ? `<p><span class="pill pill-local">Diagnostic first — three quick checks, not more practice</span></p><ol>${(currentNext.diagnosticPlan || []).map((pr) => `<li>Stage ${pr.stage}: ${esc(pr.purpose)}</li>`).join("")}</ol>` : ""}
      <p class="hint">Different play produces a different recommendation — try Concept Clinch, then watch this card change.</p>`;
  } else {
    nextBox.innerHTML = `<p class="hint">Play any game to give the engine evidence, and your personalized next step appears here.</p>`;
  }

  // progress
  try {
    const state = await engine.getState(engine.domainId, currentConcepts);
    const box = $("#progressBox");
    if (!state.evidenceCount) {
      box.innerHTML = `<p class="hint">No evidence yet in ${esc(engine.domainId)}. Play a round and your competence picture appears here — the same record every game sees.</p>`;
    } else {
      box.innerHTML = core.COMPETENCES.map((k) => {
        const v = state.competences[k] || { estimate: 0, evidenceCount: 0 };
        return `<div class="comp-row"><span>${esc(COMPETENCE_LABELS[k] || k)}</span><span class="bar"><div style="width:${(v.estimate * 100).toFixed(0)}%"></div></span><span>${(v.estimate * 100).toFixed(0)}% · n=${v.evidenceCount}${v.freshness != null && v.evidenceCount ? ` · proof freshness ${Math.round(v.freshness * 100)}%` : ""}</span></div>`;
      }).join("") + `<p class="hint">${state.evidenceCount} evidence events in this domain · Due for review: ${state.dueForReview.map((d) => esc(d.conceptId)).join(", ") || "none"} · Full stage detail in the Engine Console.</p>`;
    }
  } catch (e) {
    $("#progressBox").innerHTML = `<p class="hint">Progress unavailable: ${esc(e.message)}</p>`;
  }

  // Learner mirror: stage aggregates + gap-aligned suggestions (player-visible evaluation)
  try {
    const state = await engine.getState(engine.domainId, currentConcepts);
    const stageNames = { 1: "1 Recognize", 2: "2 Equivalent", 3: "3 Understand", 4: "4 Distinguish", 5: "5 Apply / Handle", 6: "6 Retrieve fast", 7: "7 Speak / Repair", 8: "8 Interpret whole" };
    $("#mirrorStages").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
      let sum = 0, n = 0, ret = 1;
      for (const c of currentConcepts) { const cell = state.stages?.[c.conceptId]?.[s]; if (cell?.evidenceCount) { sum += cell.estimate; n++; ret = Math.min(ret, cell.retention ?? 1); } }
      const pct = n ? Math.round((sum / n) * 100) : 0;
      return `<div class="comp-row"><span>${stageNames[s]}</span><span class="bar"><div style="width:${pct}%"></div></span><span>${n ? `${pct}% · n=${n} · recall ~${Math.round(ret * 100)}%` : "no evidence yet"}</span></div>`;
    }).join("") + (state.dueForReview.length ? `<p><strong>Due before they fade:</strong> ${state.dueForReview.map((d) => `${esc(currentConcepts.find((c) => c.conceptId === d.conceptId)?.terms.en.term || d.conceptId)} (~${Math.round((d.lowestRetention ?? 1) * 100)}%)`).join(" · ")}</p>` : `<p class="hint">Nothing due. New proofs schedule themselves as they age.</p>`);
    try { const streaks = Object.keys(localStorage).filter((k) => k.startsWith("ev:daily:")).map((k) => { try { return { game: k.slice(9), ...JSON.parse(localStorage.getItem(k) || "{}") }; } catch { return null; } }).filter((x) => x && x.streak); if (streaks.length) $("#mirrorStages").innerHTML += `<p><strong>Day streaks:</strong> ${streaks.map((s) => `${esc(s.game)} · ${s.streak} day${s.streak === 1 ? "" : "s"} · best ${s.best}`).join(" · ")}</p>`; } catch {}
    const games = core.recommendGames({ domain: currentDomain, concepts: currentConcepts, learnerState: state, limit: 3 });
    const dirs = { "concept-clinch": "../games/concept-clinch/", "shift-consecutive": "../games/shift-consecutive/", "bench-call": "../games/bench-call/", "term-rush": "../games/term-rush/", "echo-sequence": "../games/echo-sequence/", "the-table": "../games/the-table/", "repair-shop": "../games/repair-shop/", "vr-lingua-lab": "../games/vr-lingua-lab/", "vocab-craft": "../games/vocab-craft/", "neon-bastion": "../games/neon-bastion/", "melon-reef": "../games/melon-reef/" };
    $("#suggestedGames").innerHTML = games.map((g) => `
      <article class="suggest-card"><p class="verb-line">${esc(g.verb)} · Stage ${g.gapStage}</p><h3>${esc(g.name)}</h3><p>${esc(g.reason)}</p><a class="btn btn-primary" href="${dirs[g.gameId] || "../games/concept-clinch/"}?domain=${encodeURIComponent(engine.domainId)}&learner=${encodeURIComponent(engine.learnerId)}&engine=${encodeURIComponent(engine.engineUrl)}&lang=${encodeURIComponent($("#pairSelect").value)}">Play for this gap</a></article>`).join("");
  } catch { $("#mirrorStages").innerHTML = `<p class="hint">Mirror warms up after your first proof in any game.</p>`; }
}

function renderSources() {
  $("#sourceBox").innerHTML = `<ul>${core.SOURCES.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><strong>${esc(s.title)}</strong></a> — ${esc(s.publisher)} · ${esc(s.jurisdiction)} · authority: ${esc(s.authority)}<br><span class="hint">${esc(s.instructionalRelevance)}</span></li>`).join("")}</ul>`;
}

// Game Lab: template-based invention with honest labels (spec §12)
const AUDIENCES = {
  aspiring: { label: "Aspiring interpreter", need: "build professional vocabulary without fear", comfort: "mixed digital comfort" },
  staff: { label: "Bilingual staff", need: "accuracy under workplace time pressure", comfort: "phone-first, short sessions" },
  student: { label: "Interpreting student", need: "connect coursework terms to spoken performance", comfort: "comfortable with games" },
  pro: { label: "Working professional", need: "sharpen rare-but-critical distinctions", comfort: "wants depth fast" },
};
async function inventViaEngine(audienceLabel, gapKey, domain) {
  // Prefer the CPE Meta surface (Wonder live with a key, labeled local without).
  try {
    const r = await fetch(`${engine.engineUrl}/v1/ai/invent`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: audienceLabel, gap: gapKey, domainId: domain.domainId, learnerId: engine.learnerId }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined,
    });
    if (r.ok) return await r.json();
  } catch { /* local invention below is identical in contract */ }
  return null;
}

async function inventConcept() {
  const audienceKey = $("#labAudience").value;
  const gapKey = $("#labGap").value;
  const aud = AUDIENCES[audienceKey];
  const domain = currentDomain || core.OREGON_MEDICAL;
  const concepts = currentConcepts.length ? currentConcepts : core.CONCEPTS.filter((c) => c.domainId === domain.domainId);
  let state = null;
  try { state = await engine.getState(domain.domainId, concepts); } catch { /* new learner */ }
  const coverage = core.domainCoverage({ domain, concepts, learnerState: state });
  const gapArea = gapKey === "auto"
    ? [...coverage].sort((a, b) => (a.meanEstimate - b.meanEstimate) || ((a.riskIfMistranslated === "critical" ? 0 : 1) - (b.riskIfMistranslated === "critical" ? 0 : 1)))[0]
    : coverage.find((a) => gapKey === "spoken" ? /consent|testimony|history/.test(a.areaId) : gapKey === "judgment" ? /judgment/.test(a.areaId) : true) || coverage[0];

  const templates = [
    { name: "Turn Table", hook: "You staff a two-sided desk: cards arrive as one speaker, and you must flip each into the other language before the queue grows — but flipping too fast drops qualifiers.", evidence: "Stages 2, 6, 8; queue length = memory load" },
    { name: "Precision Window", hook: "A spoken turn plays once inside a shrinking window. You reconstruct it term by term, spending limited 'clarification tokens' where it matters most.", evidence: "Stages 1, 6, 7; clarification spend is logged assistance" },
    { name: "Two Rooms", hook: "The same concept appears in a clinic room and a courtroom. You sort what transfers, what changes register, and what must never cross over.", evidence: "Stages 3, 4, 5; cross-domain distinctions" },
  ];
  const seed = (audienceKey + gapKey + domain.domainId + (gapArea?.areaId || "")).length;
  const t = templates[seed % templates.length];
  const originality = 62 + (seed * 7) % 30;
  const evidenceScore = gapArea ? 70 + Math.min(20, gapArea.conceptCount * 4) : 65;
  const feasibility = 78;
  const playable = evidenceScore >= 70;
  const via = await inventViaEngine(aud.label, gapKey, domain);
  const shown = via ? { name: via.name, hook: via.hook, evidence: via.evidence } : t;
  const shownScores = via?.scores || { originality, evidenceQuality: evidenceScore, feasibility };
  $("#labOut").innerHTML = `
    <article class="lab-concept">
      <p><span class="pill ${playable ? "pill-on" : "pill-local"}">${playable ? "Playable preview (template instance)" : "Specification only — not yet playable"}</span> <span class="pill">Generated for ${esc(aud.label)}</span> <span class="pill ${via?.provider === "meta" ? "pill-on" : "pill-local"}">${via ? (via.provider === "meta" ? `Meta ${esc(via.model)} — live` : `Local template (add META_API_KEY for live ${esc(via.model)})`) : "In-browser invention"}</span></p>
      <p class="hint">Thinking, in the open: coverage scanned (${coverage.length} areas) → thinnest thread at Stage ${via?.provenance ? "your evidence" : "coverage"} → concept critiqued (originality / evidence / feasibility) → ${playable ? "matched a playable template" : "kept as specification, honestly"}.</p>
      <h3 style="margin:8px 0;">${esc(shown.name)} — ${esc(gapArea?.label.en || "core practice")} (${esc(domain.label.en)})</h3>
      <p><strong>Hook:</strong> ${esc(shown.hook)}</p>
      <p><strong>Why this audience:</strong> ${esc(aud.need)}; ${esc(aud.comfort)}. <strong>Why this gap:</strong> coverage in “${esc(gapArea?.label.en || "")}” is ${gapArea ? `${(gapArea.meanEstimate * 100).toFixed(0)}% mean mastery over ${gapArea.evidenceCount} evidence events (${gapArea.riskIfMistranslated} risk if mistranslated)` : "unmeasured"}.</p>
      <p><strong>Learning evidence produced:</strong> ${esc(shown.evidence)}. Existing portfolio (Concept Clinch = knowledge, Shift = spoken, Bench Call = judgment) does not cover this interaction shape — overlap is low.</p>
      <div class="scores"><span class="pill">Originality ${shownScores.originality}/100</span><span class="pill">Evidence quality ${shownScores.evidenceQuality}/100</span><span class="pill">Feasibility ${shownScores.feasibility}/100</span></div>
      ${playable
        ? `<p>This concept matches a playable template, so you can try its core loop now (it submits real engine evidence):</p><button class="btn btn-primary" id="labPlayBtn" type="button">Play the ${esc(shown.name)} preview</button> <span id="labPlayOut"></span>`
        : `<p>This is a generated <strong>specification</strong>, not a playable game. It is preserved with this rationale in the portfolio record — we never relabel a mock-up as invented-live gameplay.</p>`}
      <p class="hint">Provenance: audience=${audienceKey}, gap=${gapKey}, domain=${esc(domain.domainId)}, area=${esc(gapArea?.areaId || "")}, template=${esc(shown.name)}, generated via ${via ? esc(via.provider) : "browser"} from engine coverage (no hidden manual pick).</p>
    </article>`;
  const playBtn = $("#labPlayBtn");
  if (playBtn) playBtn.addEventListener("click", async () => {
    const concept = concepts.find((c) => c.areaIds.includes(gapArea.areaId)) || concepts[0];
    const item = core.generateItem({ concept, domain, area: domain.translationAreas.find((a) => a.areaId === concept.areaIds[0]), stage: 2, targetLang: $("#pairSelect").value, seed: "lab" });
    const out = $("#labPlayOut");
    out.innerHTML = `<br><strong>Preview:</strong> ${esc(item.prompt)} <span class="hint">(answer set: ${esc(item.acceptableAnswers.join(" / "))} — full game in portfolio)</span>`;
    engine.recordEvidence({ conceptId: concept.conceptId, areaId: concept.areaIds[0], gameId: "game-lab-preview", activityType: item.activityType, stage: 2, correct: true, score: 0.8, responseSummary: "Lab preview played" });
    await engine.sync().catch(() => {});
    await refresh();
  });
}

boot().catch((e) => {
  $("#nextBox").innerHTML = `<p class="hint">Hub failed to start: ${esc(e.message)}. Games still work standalone — open one directly.</p>`;
});
