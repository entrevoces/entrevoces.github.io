// ENTRE VOCES Engine Console — Domain Studio, Knowledge Browser, Learner Inspector
// The engine is configured here. Games read the same registry via the CPE.
// Offline: falls back to seed data + localStorage so the Studio is always usable.
import * as core from "../../packages/engine-core/index.js";
import { EngineClient } from "../../packages/engine-client/engine-client.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const COMPETENCE_LABELS = {
  "domain-knowledge": "Domain knowledge", "professional-terminology": "Professional terminology",
  "bilingual-terminology": "Bilingual terminology", "terminology-usage": "Terminology usage",
  "listening": "Listening comprehension", "speech-production": "Speech production",
  "meaning-transfer": "Meaning transfer", "cognitive-interpreting": "Cognitive interpreting",
  "professional-judgment": "Professional judgment", "integrated-performance": "Integrated performance",
};
const LANGS = ["en", "es", "zh", "pt", "ru", "vi", "ko", "ar", "fr", "de"];

const state = {
  engineUrl: localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787",
  token: sessionStorage.getItem("ev:authorToken") || "",
  connected: false,
  health: null,
  domains: [],
  sources: [...core.SOURCES],
  selectedDomainId: null,
  editingIsNew: false,
  conceptsByDomain: new Map(),
  learners: [],
  selectedLearner: localStorage.getItem("ev:learnerId") || "",
  client: null,
};

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(`${state.engineUrl}${path}`, { ...opts, headers });
}
function localDomains() { try { return JSON.parse(localStorage.getItem("ev:console:domains") || "[]"); } catch { return []; } }
function saveLocalDomain(cfg) {
  const list = localDomains();
  const i = list.findIndex((d) => d.domainId === cfg.domainId);
  if (i >= 0) list[i] = cfg; else list.push(cfg);
  localStorage.setItem("ev:console:domains", JSON.stringify(list));
}
function mergedDomains() {
  const byId = new Map();
  [...core.SEED_DOMAINS, ...localDomains()].forEach((d) => byId.set(d.domainId, d));
  state.domains.forEach((d) => byId.set(d.domainId, d));
  return [...byId.values()];
}

// ---------- connection ----------
async function connect() {
  state.engineUrl = $("#engineUrl").value.trim().replace(/\/$/, "") || state.engineUrl;
  state.token = $("#authorToken").value.trim();
  sessionStorage.setItem("ev:authorToken", state.token);
  localStorage.setItem("ev:engineUrl", state.engineUrl);
  const pill = $("#healthPill");
  try {
    const r = await fetch(`${state.engineUrl}/v1/health`);
    if (!r.ok) throw new Error(`health ${r.status}`);
    state.health = await r.json();
    state.connected = true;
    pill.textContent = `Connected · ${state.health.counts.domains} domains · ${state.health.counts.concepts} concepts`;
    pill.className = "pill pill-on";
    $("#modeBadge").textContent = "CPE connected — changes are live for all games";
    $("#healthBox").textContent = JSON.stringify(state.health, null, 2);
    await loadFromCPE();
  } catch (e) {
    state.connected = false;
    pill.textContent = "CPE unreachable — local demo mode";
    pill.className = "pill pill-off";
    $("#modeBadge").textContent = "Local demo — edits save on this device only";
    $("#healthBox").textContent = `Not connected (${e.message}).\nStart the engine:\n  cd services/progression-engine\n  AUTHOR_TOKEN=dev-author-token PORT=8787 node server.js\nThen Connect again. Seed domains below still work for preview.`;
    state.domains = [];
  }
  renderAll();
}

async function loadFromCPE() {
  try {
    const [d, s] = await Promise.all([api("/v1/domains?status=active"), api("/v1/sources")]);
    if (d.ok) state.domains = (await d.json()).data;
    if (s.ok) state.sources = (await s.json()).data;
    const l = await api("/v1/learners");
    if (l.ok) state.learners = (await l.json()).data;
  } catch { /* keep seeds */ }
}

async function conceptsFor(domainId) {
  if (state.conceptsByDomain.has(domainId)) return state.conceptsByDomain.get(domainId);
  let list = [];
  if (state.connected) {
    try { const r = await api(`/v1/concepts?domainId=${encodeURIComponent(domainId)}&limit=200`); if (r.ok) list = (await r.json()).data; } catch { /* fallback */ }
  }
  if (!list.length) list = core.CONCEPTS.filter((c) => c.domainId === domainId);
  state.conceptsByDomain.set(domainId, list);
  return list;
}

// ---------- Domain Studio ----------
function renderDomainList() {
  const domains = mergedDomains();
  const box = $("#domainList");
  box.innerHTML = domains.map((d) => `
    <button type="button" class="domain-item ${d.domainId === state.selectedDomainId ? "is-selected" : ""}" data-domain="${esc(d.domainId)}">
      <strong>${esc(d.label.en)}</strong>
      <span>${esc(d.jurisdiction.region)}, ${esc(d.jurisdiction.country)} · ${esc(d.profession)} · ${d.translationAreas.length} areas · ${d.languagePairs.map((p) => `${p.source}↔${p.target}`).join(", ")} · ${esc(d.status)} v${d.version || 1}</span>
    </button>`).join("") || `<p class="hint">No domains yet.</p>`;
  $$("[data-domain]", box).forEach((b) => b.addEventListener("click", () => selectDomain(b.dataset.domain)));
}

function selectDomain(domainId) {
  state.selectedDomainId = domainId;
  state.editingIsNew = false;
  const d = mergedDomains().find((x) => x.domainId === domainId);
  if (d) fillEditor(d);
  renderDomainList();
  renderKnowledgeSelectors();
}

function blankDomain() {
  return {
    domainId: "", label: { en: "" }, jurisdiction: { country: "US", region: "", regionCode: "" },
    profession: "education", institutions: [], languagePairs: [{ source: "en", target: "es", direction: "bidirectional" }],
    modalities: ["consecutive"], competencyWeights: Object.fromEntries(core.COMPETENCES.map((k) => [k, 0.7])),
    sourceIds: [], status: "draft", version: 1,
    translationAreas: [{ areaId: "", label: { en: "" }, setting: "", participants: [], goals: [], typicalSpeechFeatures: [], riskIfMistranslated: "medium", conceptIds: [], prerequisiteAreaIds: [], order: 1 }],
  };
}

function fillEditor(d) {
  const f = $("#domainForm");
  $("#editorTitle").textContent = state.editingIsNew ? "New domain" : `Editing: ${d.label.en}`;
  $("#versionPill").textContent = `v${d.version || 1} · ${d.status}`;
  f.domainId.value = d.domainId; f.domainId.disabled = !state.editingIsNew;
  f.profession.value = d.profession; f.labelEn.value = d.label.en || "";
  f.status.value = d.status || "draft";
  f.country.value = d.jurisdiction?.country || ""; f.region.value = d.jurisdiction?.region || ""; f.regionCode.value = d.jurisdiction?.regionCode || "";
  f.institutions.value = (d.institutions || []).join(", ");
  renderPairs(d.languagePairs || []);
  $$("#modalityChecks input").forEach((cb) => { cb.checked = (d.modalities || []).includes(cb.value); });
  renderAreas(d.translationAreas || []);
  renderWeights(d.competencyWeights || {});
  renderSources(d.sourceIds || []);
  $("#formErrors").hidden = true; $("#previewBox").hidden = true;
  $("#saveStatus").textContent = "";
}

function renderPairs(pairs) {
  $("#pairList").innerHTML = pairs.map((p) => `
    <div class="pair-row">
      <label>Source <select data-pair="source">${LANGS.map((l) => `<option ${l === p.source ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Target <select data-pair="target">${LANGS.map((l) => `<option ${l === p.target ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <button type="button" class="btn btn-small btn-ghost remove-pair">Remove</button>
    </div>`).join("");
  $$(".remove-pair").forEach((b) => b.addEventListener("click", () => b.closest(".pair-row").remove()));
}

function renderAreas(areas) {
  const box = $("#areaList");
  box.innerHTML = "";
  areas.forEach((a) => box.appendChild(areaCard(a)));
}
function areaCard(a) {
  const tpl = $("#areaTpl").content.firstElementChild.cloneNode(true);
  tpl.querySelector('[data-f="areaId"]').value = a.areaId || "";
  tpl.querySelector('[data-f="labelEn"]').value = a.label?.en || "";
  tpl.querySelector('[data-f="setting"]').value = a.setting || "";
  tpl.querySelector('[data-f="risk"]').value = a.riskIfMistranslated || "medium";
  tpl.querySelector('[data-f="participants"]').value = (a.participants || []).join(", ");
  tpl.querySelector('[data-f="goals"]').value = (a.goals || []).join("; ");
  tpl.querySelector('[data-f="features"]').value = (a.typicalSpeechFeatures || []).join(", ");
  tpl.querySelector('[data-f="order"]').value = a.order ?? 1;
  tpl.querySelector('[data-f="prereqs"]').value = (a.prerequisiteAreaIds || []).join(", ");
  tpl.querySelector(".remove-area").addEventListener("click", () => tpl.remove());
  return tpl;
}

function renderWeights(weights) {
  $("#weightList").innerHTML = core.COMPETENCES.map((k) => `
    <label>${esc(COMPETENCE_LABELS[k] || k)} <input type="range" min="0" max="1" step="0.05" value="${weights[k] ?? 0.5}" data-weight="${k}"><output>${Number(weights[k] ?? 0.5).toFixed(2)}</output></label>`).join("");
  $$("#weightList input").forEach((r) => r.addEventListener("input", () => { r.nextElementSibling.textContent = Number(r.value).toFixed(2); }));
}

function renderSources(selected) {
  $("#sourceChecks").innerHTML = state.sources.map((s) => `
    <label><input type="checkbox" value="${esc(s.sourceId)}" ${selected.includes(s.sourceId) ? "checked" : ""}> <span><strong>${esc(s.title)}</strong><br><span class="hint">${esc(s.publisher)} · ${esc(s.jurisdiction)} · authority: ${esc(s.authority)}</span></span></label>`).join("");
}

function collectDomain() {
  const f = $("#domainForm");
  const split = (v, sep) => v.split(sep).map((x) => x.trim()).filter(Boolean);
  const languagePairs = $$("#pairList .pair-row").map((row) => ({
    source: row.querySelector('[data-pair="source"]').value,
    target: row.querySelector('[data-pair="target"]').value,
    direction: "bidirectional",
  }));
  const translationAreas = $$("#areaList .area-card").map((card, i) => ({
    areaId: card.querySelector('[data-f="areaId"]').value.trim(),
    label: { en: card.querySelector('[data-f="labelEn"]').value.trim() },
    setting: card.querySelector('[data-f="setting"]').value.trim(),
    participants: split(card.querySelector('[data-f="participants"]').value, ","),
    goals: split(card.querySelector('[data-f="goals"]').value, ";"),
    typicalSpeechFeatures: split(card.querySelector('[data-f="features"]').value, ","),
    riskIfMistranslated: card.querySelector('[data-f="risk"]').value,
    conceptIds: (mergedDomains().find((d) => d.domainId === state.selectedDomainId)?.translationAreas.find((a) => a.areaId === card.querySelector('[data-f="areaId"]').value.trim())?.conceptIds) || [],
    prerequisiteAreaIds: split(card.querySelector('[data-f="prereqs"]').value, ","),
    order: Number(card.querySelector('[data-f="order"]').value || i + 1),
  }));
  const competencyWeights = {};
  $$("#weightList input").forEach((r) => { competencyWeights[r.dataset.weight] = Number(r.value); });
  return {
    domainId: f.domainId.value.trim(),
    label: { en: f.labelEn.value.trim() },
    jurisdiction: { country: f.country.value.trim(), region: f.region.value.trim(), regionCode: f.regionCode.value.trim() },
    profession: f.profession.value,
    institutions: split(f.institutions.value, ","),
    languagePairs, modalities: $$("#modalityChecks input:checked").map((c) => c.value),
    translationAreas, competencyWeights,
    sourceIds: $$("#sourceChecks input:checked").map((c) => c.value),
    status: f.status.value,
    version: mergedDomains().find((d) => d.domainId === state.selectedDomainId)?.version || 1,
  };
}

async function saveDomain(nextStatus) {
  const cfg = collectDomain();
  if (nextStatus) cfg.status = nextStatus;
  const existingIds = new Set(mergedDomains().map((d) => d.domainId));
  if (!state.editingIsNew) existingIds.delete(cfg.domainId);
  const v = core.validateDomainConfig(cfg, { existingIds });
  const errBox = $("#formErrors");
  if (!v.ok) {
    errBox.hidden = false;
    errBox.innerHTML = `<strong>Fix these before saving:</strong><ul>${v.errors.map((e) => `<li><code>${esc(e.field)}</code> — ${esc(e.message)}</li>`).join("")}</ul>`;
    errBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  errBox.hidden = true;
  if (state.connected) {
    try {
      const isNew = state.editingIsNew || !state.domains.some((d) => d.domainId === cfg.domainId);
      const r = await api(isNew ? "/v1/domains" : `/v1/domains/${encodeURIComponent(cfg.domainId)}`, {
        method: isNew ? "POST" : "PUT", body: JSON.stringify(cfg),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.detail || `save failed (${r.status})` + (body.fieldErrors ? ": " + body.fieldErrors.map((e) => `${e.field} ${e.message}`).join("; ") : ""));
      state.conceptsByDomain.delete(cfg.domainId);
      await loadFromCPE();
      state.selectedDomainId = cfg.domainId; state.editingIsNew = false;
      $("#saveStatus").textContent = `Saved to CPE as v${body.version} — games see it on next load.`;
    } catch (e) {
      errBox.hidden = false; errBox.textContent = `CPE save failed: ${e.message}. Your edit is kept in the form; reconnect or export JSON.`;
      return;
    }
  } else {
    saveLocalDomain({ ...cfg, version: (cfg.version || 1) + (state.editingIsNew ? 0 : 1) });
    state.selectedDomainId = cfg.domainId; state.editingIsNew = false;
    $("#saveStatus").textContent = "Saved locally (demo mode). Connect the CPE to publish to all games.";
  }
  renderAll();
  selectDomain(cfg.domainId);
}

// ---------- Knowledge Browser ----------
function renderKnowledgeSelectors() {
  const domains = mergedDomains();
  const kb = $("#kbDomain"), ld = $("#learnerDomain");
  const cur = kb.value || state.selectedDomainId || domains[0]?.domainId;
  kb.innerHTML = domains.map((d) => `<option value="${esc(d.domainId)}" ${d.domainId === cur ? "selected" : ""}>${esc(d.label.en)}</option>`).join("");
  ld.innerHTML = kb.innerHTML;
  const d = domains.find((x) => x.domainId === kb.value) || domains[0];
  $("#kbArea").innerHTML = `<option value="">All areas</option>` + (d?.translationAreas || []).map((a) => `<option value="${esc(a.areaId)}">${esc(a.label.en)}</option>`).join("");
}

async function renderKnowledge() {
  renderKnowledgeSelectors();
  const domainId = $("#kbDomain").value || state.selectedDomainId;
  const areaId = $("#kbArea").value;
  const lang = $("#kbLang").value;
  if (!domainId) return;
  const all = await conceptsFor(domainId);
  const list = all.filter((c) => !areaId || c.areaIds.includes(areaId));
  $("#kbCount").textContent = `${list.length} concepts · ${domainId}`;
  $("#conceptList").innerHTML = list.map((c) => `
    <button type="button" class="concept-item" data-concept="${esc(c.conceptId)}">
      <strong>${esc(c.terms.en.term)}</strong> → ${esc(c.terms[lang]?.term || "— missing —")}
      <br><span class="hint">${esc(c.areaIds.join(", "))} · difficulty ${c.difficulty}/5 ${c.inferred ? "· inferred" : ""}</span>
    </button>`).join("") || `<p class="hint">No concepts yet for this filter. Seed them via POST /v1/concepts or extend packages/engine-core/seed-data.js.</p>`;
  $$("[data-concept]").forEach((b) => b.addEventListener("click", () => showConcept(b.dataset.concept, all)));
  if (list[0]) showConcept(list[0].conceptId, all);
}

function showConcept(conceptId, all) {
  const c = all.find((x) => x.conceptId === conceptId);
  if (!c) return;
  $$(".concept-item").forEach((b) => b.classList.toggle("is-selected", b.dataset.concept === conceptId));
  const src = (c.sourceIds || []).map((id) => state.sources.find((s) => s.sourceId === id)).filter(Boolean);
  $("#conceptDetail").innerHTML = `
    <h3>${esc(c.terms.en.term)}</h3>
    <p>${c.inferred ? `<span class="badge badge-warn">Inferred — not authoritative</span> ` : ""}<span class="badge">${esc(c.domainId)}</span> <span class="badge">${esc(c.areaIds.join(", "))}</span> <span class="badge">difficulty ${c.difficulty}/5</span></p>
    <h4>Terms</h4>
    <ul>${Object.entries(c.terms).map(([l, t]) => `<li><strong>${esc(l)}:</strong> ${esc(t.term)}${t.alternatives?.length ? ` (also: ${esc(t.alternatives.join(", "))})` : ""} <span class="hint">${esc(t.register || "")}</span></li>`).join("")}</ul>
    <h4>Definition (EN)</h4><p>${esc(c.definition?.en || "")}</p>
    ${(c.distinctions || []).length ? `<h4>Distinctions that matter</h4><ul>${c.distinctions.map((d) => `<li><strong>vs. ${esc(d.contrast)}:</strong> ${esc(d.difference)}</li>`).join("")}</ul>` : ""}
    ${(c.misconceptions || []).length ? `<h4>Misconceptions this reveals</h4><ul>${c.misconceptions.map((m) => `<li><strong>${esc(m.tag || "")}:</strong> ${esc(m.description)}<br><span class="hint">Diagnose: ${esc(m.diagnosticPrompt || "")}</span></li>`).join("")}</ul>` : ""}
    ${(c.examples || []).length ? `<h4>Example</h4><p lang="en">${esc(c.examples[0].en)}</p><p lang="es">${esc(c.examples[0].es || "")}</p><p lang="zh">${esc(c.examples[0].zh || "")}</p>` : ""}
    <h4>Provenance</h4>
    ${src.length ? `<ul>${src.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> — ${esc(s.publisher)} (${esc(s.jurisdiction)}, authority: ${esc(s.authority)})</li>`).join("")}</ul>` : `<p class="badge badge-warn">No source linked — this concept must not be taught as authoritative.</p>`}
    <p class="hint">Competences: ${esc((c.competences || []).join(", "))}</p>`;
}

// ---------- Learner Inspector ----------
function discoverLearners() {
  const ids = new Set();
  state.learners.forEach((l) => ids.add(l.learnerId));
  const cur = localStorage.getItem("ev:learnerId");
  if (cur) ids.add(cur);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    const m = k.match(/^ev:log:([^:]+):/);
    if (m) ids.add(m[1]);
  }
  return [...ids];
}

async function renderLearners() {
  renderKnowledgeSelectors();
  const ids = discoverLearners();
  const sel = $("#learnerSelect");
  const prev = state.selectedLearner || sel.value;
  sel.innerHTML = ids.map((id) => `<option value="${esc(id)}" ${id === prev ? "selected" : ""}>${esc(state.learners.find((l) => l.learnerId === id)?.displayName || id.slice(0, 8) + "…")} (${esc(id.slice(0, 8))}…)</option>`).join("") || `<option value="">No learners yet</option>`;
  state.selectedLearner = sel.value;
  const learnerId = state.selectedLearner;
  const domainId = $("#learnerDomain").value || "oregon-medical";
  const domain = mergedDomains().find((d) => d.domainId === domainId);
  const concepts = await conceptsFor(domainId);
  if (!learnerId || !domain) { $("#learnerEmpty").hidden = false; $("#learnerBody").hidden = true; return; }

  let events = [], learnerState = null, next = null, coverage = null;
  if (state.connected) {
    try {
      const [s, n, cov, ev] = await Promise.all([
        api(`/v1/learners/${encodeURIComponent(learnerId)}/state?domainId=${encodeURIComponent(domainId)}`),
        api(`/v1/next?learnerId=${encodeURIComponent(learnerId)}&domainId=${encodeURIComponent(domainId)}`),
        api(`/v1/coverage?domainId=${encodeURIComponent(domainId)}&learnerId=${encodeURIComponent(learnerId)}`),
        api(`/v1/evidence?learnerId=${encodeURIComponent(learnerId)}&domainId=${encodeURIComponent(domainId)}&since=0`),
      ]);
      if (s.ok) learnerState = await s.json();
      if (n.ok) next = await n.json();
      if (cov.ok) coverage = (await cov.json()).areas;
      if (ev.ok) events = (await ev.json()).data;
    } catch { /* fall through to local */ }
  }
  if (!learnerState) {
    const client = new EngineClient({ engineUrl: state.engineUrl, learnerId, domainId, core, fallbackDomain: domain, fallbackConcepts: concepts });
    events = client.localEvidence(domainId);
    learnerState = core.computeLearnerState({ learnerId, domainId, events, concepts });
    next = core.recommendNext({ domain, concepts, learnerState });
    coverage = core.domainCoverage({ domain, concepts, learnerState });
  }

  const hasEvidence = learnerState.evidenceCount > 0;
  $("#learnerEmpty").hidden = hasEvidence;
  $("#learnerBody").hidden = !hasEvidence;
  if (!hasEvidence) return;

  $("#nextCard").innerHTML = next ? `
    <p><strong>${esc(concepts.find((c) => c.conceptId === next.conceptId)?.terms.en.term || next.conceptId || "—")}</strong> · stage ${next.stage} · ${esc(next.activityType)} ${next.suggestedGameId ? `· play in <strong>${esc(next.suggestedGameId)}</strong>` : ""}</p>
    <p>${esc(next.rationale)}</p>
    ${next.needsDiagnostic ? `<p><span class="badge badge-warn">Diagnostic needed — cause ambiguous</span></p>` : ""}
    ${(next.alternatives || []).map((a) => `<p class="hint">Alt: ${esc(a.conceptId)} stage ${a.stage} — ${esc(a.rationale)}</p>`).join("")}` : `<p class="hint">No recommendation.</p>`;

  $("#coverageList").innerHTML = (coverage || []).map((a) => `
    <p><strong>${esc(a.label?.en || a.areaId)}</strong> (${esc(a.riskIfMistranslated)} risk) — ${a.conceptCount} concepts, ${a.evidenceCount} evidence, mean ${(a.meanEstimate * 100).toFixed(0)}%</p>`).join("");

  $("#competenceList").innerHTML = core.COMPETENCES.map((k) => {
    const v = learnerState.competences[k] || { estimate: 0, evidenceCount: 0 };
    return `<div class="comp-row"><span>${esc(COMPETENCE_LABELS[k] || k)}</span><span class="bar"><div style="width:${(v.estimate * 100).toFixed(0)}%"></div></span><span>${(v.estimate * 100).toFixed(0)}% · n=${v.evidenceCount}</span></div>`;
  }).join("");

  const rows = concepts.map((c) => {
    const vec = learnerState.stages[c.conceptId];
    const cells = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
      const cell = vec?.[s] || { estimate: 0, evidenceCount: 0 };
      const pct = cell.evidenceCount ? `${(cell.estimate * 100).toFixed(0)}%` : "—";
      const bg = !cell.evidenceCount ? "#f0f3f0" : cell.estimate >= 0.7 ? "#cfe8dd" : cell.estimate >= 0.4 ? "#fdf3e0" : "#f8d7cf";
      return `<td class="cell-heat" style="background:${bg}" title="n=${cell.evidenceCount}">${pct}</td>`;
    }).join("");
    return `<tr><td><strong>${esc(c.terms.en.term)}</strong></td>${cells}</tr>`;
  }).join("");
  $("#stageTableWrap").innerHTML = `<table class="data-table"><thead><tr><th>Concept</th>${[1, 2, 3, 4, 5, 6, 7, 8].map((s) => `<th>S${s}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;

  $("#evidenceBody").innerHTML = [...events].sort((a, b) => (b.clientTs || 0) - (a.clientTs || 0)).slice(0, 60).map((e) => `
    <tr><td>${new Date(e.clientTs || e.serverTs || Date.now()).toLocaleString()}</td><td>${esc(e.gameId)}</td><td>${esc(e.conceptId)}</td><td>${e.stage}</td>
    <td>${e.correct ? "Correct" : "Not yet"} (${((e.score ?? 0) * 100).toFixed(0)}%)</td><td>${esc((e.assistance || []).join(", ") || "—")}</td><td>${esc(e.misconceptionTag || e.responseSummary || "—")}</td></tr>`).join("");
}

// ---------- wiring ----------
function renderAll() { renderDomainList(); renderKnowledgeSelectors(); }
function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  $$(".panel-view").forEach((p) => p.classList.toggle("is-active", p.id === `tab-${name}`));
  if (name === "knowledge") renderKnowledge();
  if (name === "learners") renderLearners();
}

function init() {
  $("#engineUrl").value = state.engineUrl;
  if (state.token) $("#authorToken").value = state.token;
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $("#connectBtn").addEventListener("click", connect);
  $("#newDomainBtn").addEventListener("click", () => {
    state.editingIsNew = true; state.selectedDomainId = null;
    fillEditor(blankDomain()); renderDomainList();
    $("#domainForm [name=domainId]").focus();
  });
  $("#addPairBtn").addEventListener("click", () => { renderPairs([...$$("#pairList .pair-row").map((r) => ({ source: r.querySelector('[data-pair="source"]').value, target: r.querySelector('[data-pair="target"]').value })), { source: "en", target: "es" }]); });
  $("#addAreaBtn").addEventListener("click", () => $("#areaList").appendChild(areaCard({ areaId: "", label: { en: "" }, riskIfMistranslated: "medium", order: $$("#areaList .area-card").length + 1 })));
  $("#domainForm").addEventListener("submit", (e) => { e.preventDefault(); saveDomain(); });
  $("#activateBtn").addEventListener("click", () => saveDomain("active"));
  $("#archiveBtn").addEventListener("click", () => saveDomain("archived"));
  $("#previewBtn").addEventListener("click", async () => {
    const cfg = collectDomain();
    const concepts = await conceptsFor(cfg.domainId);
    const cov = core.domainCoverage({ domain: cfg, concepts, learnerState: null });
    const box = $("#previewBox");
    box.hidden = false;
    box.innerHTML = `<strong>As games see it:</strong> ${esc(cfg.label.en)} (${esc(cfg.domainId)}) — ${cfg.languagePairs.map((p) => `${p.source}↔${p.target}`).join(", ")} · status ${esc(cfg.status)}<ul>${cov.map((a) => `<li>${esc(a.label.en)} — ${a.conceptCount} concepts, ${esc(a.riskIfMistranslated)} risk</li>`).join("")}</ul><p class="hint">Games fetch this via GET /v1/domains/${esc(cfg.domainId)} and GET /v1/concepts?domainId=${esc(cfg.domainId)}. No redeploy needed when you Activate.</p>`;
  });
  $("#exportDomainBtn").addEventListener("click", () => {
    const cfg = collectDomain();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" }));
    a.download = `${cfg.domainId || "domain"}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $("#importDomainInput").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const cfg = JSON.parse(await file.text());
      state.editingIsNew = !mergedDomains().some((d) => d.domainId === cfg.domainId);
      state.selectedDomainId = cfg.domainId;
      fillEditor(cfg); $("#saveStatus").textContent = "Imported — review, then Save.";
    } catch { $("#saveStatus").textContent = "Import failed: not valid JSON."; }
    e.target.value = "";
  });
  $("#kbDomain").addEventListener("change", renderKnowledge);
  $("#kbArea").addEventListener("change", renderKnowledge);
  $("#kbLang").addEventListener("change", renderKnowledge);
  $("#learnerDomain").addEventListener("change", renderLearners);
  $("#learnerSelect").addEventListener("change", (e) => { state.selectedLearner = e.target.value; localStorage.setItem("ev:learnerId", state.selectedLearner); renderLearners(); });
  $("#refreshLearnerBtn").addEventListener("click", renderLearners);
  $("#exportLearnerBtn").addEventListener("click", async () => {
    const learnerId = state.selectedLearner; const domainId = $("#learnerDomain").value || "oregon-medical";
    let payload;
    if (state.connected) {
      const r = await api(`/v1/learners/${encodeURIComponent(learnerId)}/export`);
      payload = r.ok ? await r.json() : { learnerId, error: "export failed" };
    } else {
      const client = new EngineClient({ engineUrl: state.engineUrl, learnerId, domainId, core });
      payload = client.exportLocal(domainId);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = `evidence-${learnerId.slice(0, 8)}-${domainId}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $("#seedDemoBtn").addEventListener("click", async () => {
    const domainId = $("#learnerDomain").value || "oregon-medical";
    const domain = mergedDomains().find((d) => d.domainId === domainId);
    const concepts = await conceptsFor(domainId);
    const learnerId = state.selectedLearner || localStorage.getItem("ev:learnerId") || (() => { const id = crypto.randomUUID(); localStorage.setItem("ev:learnerId", id); return id; })();
    state.selectedLearner = learnerId;
    const client = new EngineClient({ engineUrl: state.engineUrl, learnerId, domainId, core, fallbackDomain: domain, fallbackConcepts: concepts });
    await client.init();
    const dose = concepts.find((c) => c.conceptId === "dose") || concepts[0];
    const dosage = concepts.find((c) => c.conceptId === "dosage") || concepts[1] || concepts[0];
    const consent = concepts.find((c) => c.conceptId === "informed-consent") || concepts[2] || concepts[0];
    client.recordEvidence({ conceptId: dose.conceptId, areaId: dose.areaIds[0], gameId: "concept-clinch", activityType: "terminology", stage: 1, correct: true, score: 1 });
    client.recordEvidence({ conceptId: dose.conceptId, areaId: dose.areaIds[0], gameId: "concept-clinch", activityType: "bilingual", stage: 2, correct: false, score: 0, misconceptionTag: "dose-equals-dosage", responseSummary: "Demo: confused dose with dosage" });
    client.recordEvidence({ conceptId: dosage.conceptId, areaId: dosage.areaIds[0], gameId: "concept-clinch", activityType: "bilingual", stage: 2, correct: false, score: 0, misconceptionTag: "dose-equals-dosage", responseSummary: "Demo: confused dose with dosage" });
    client.recordEvidence({ conceptId: consent.conceptId, areaId: consent.areaIds[0], gameId: "shift-consecutive", activityType: "interpretation", stage: 8, correct: true, score: 0.9, responseSummary: "Demo: faithful consent interpretation" });
    await client.sync().catch(() => {});
    renderLearners();
  });
  $("#reseedBtn").addEventListener("click", async () => {
    if (!state.connected) { $("#healthBox").textContent = "Connect first — reseed runs on the CPE."; return; }
    const r = await api("/v1/admin/seed", { method: "POST", body: "{}" });
    $("#healthBox").textContent = JSON.stringify(await r.json().catch(() => ({})), null, 2);
    state.conceptsByDomain.clear(); await loadFromCPE(); renderAll();
  });
  $("#resetBtn").addEventListener("click", async () => {
    if (!state.connected) return;
    if (!confirm("Reset ALL demo data on the CPE (domains, concepts, learners, evidence)?")) return;
    const r = await api("/v1/admin/reset", { method: "POST", body: "{}" });
    $("#healthBox").textContent = JSON.stringify(await r.json().catch(() => ({})), null, 2);
    state.conceptsByDomain.clear(); await loadFromCPE(); renderAll();
  });

  const first = mergedDomains()[0];
  if (first) { state.selectedDomainId = first.domainId; fillEditor(first); }
  renderAll();
  connect();
}

init();

