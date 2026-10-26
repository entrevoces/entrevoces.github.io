// Bench Call — scan · render · stamp (sight translation + judgment desk)
// Paper moves at eye speed, not quiz speed. Then a human asks you to bend —
// and two heavy stamps wait. Different hands from Atelier and Night Shift:
// eyes lead, voice follows, record keeps.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Hand-authored desk cases (sight doc in sense-groups + the whisper that follows).
const CASES = [
  {
    id: "waiver-form", conceptId: "waiver", title: "Waiver of Jury Trial (excerpt)",
    docEn: ["I understand that I have the right", "to a trial by jury.", "By signing, I knowingly and voluntarily", "give up that right."],
    docTarget: { es: ["Entiendo que tengo derecho", "a un juicio con jurado.", "Al firmar, renuncio a ese derecho", "de forma informada y voluntaria."], zh: ["我理解我有权", "接受陪审团审判。", "签字即表示我知情并自愿", "放弃该权利。"] },
    dilemmaTitle: "The whisper — the defendant, low, to you alone:",
    dilemma: "“Just tell the judge I did not mean to sign it, okay? You tell him better than me.” The attorney is looking away. No one heard but you.",
    stamps: [
      { text: "Interpret the whisper aloud, exactly", good: true, principle: "Completeness (OJD): interpret everything, for everyone, without addition. The court — not you — responds. Your invisibility is what makes his words exist here." },
      { text: "Quietly advise him what to say", good: false, principle: "That is advocacy, and it breaks the record. The moment you coach, his words stop being his — and trust in every future interpreter thins." },
      { text: "Pretend you did not hear it", good: false, principle: "Omission is also editing. The OJD duty is complete and accurate rendering — the uncomfortable utterances included." },
    ],
  },
  {
    id: "conditions-order", conceptId: "sentence-conditions", title: "Conditions of Sentence (excerpt)",
    docEn: ["You must report to your probation officer", "within 72 hours.", "You must have no contact", "with the store or its staff."],
    docTarget: { es: ["Debe presentarse ante su oficial de libertad condicional", "en un plazo de 72 horas.", "No debe tener ningún contacto", "con la tienda ni su personal."], zh: ["您必须向缓刑官报到", "在72小时内。", "您不得有任何联系", "与该商店或其员工。"] },
    dilemmaTitle: "The whisper — the probation officer, friendly, afterward:",
    dilemma: "“He looks lost. Between us — soften 'must' a little when you recap it for him? 'Should try' lands kinder.”",
    stamps: [
      { text: "Recap exactly: 'must', deadlines intact", good: true, principle: "Modality is the sentence. 'Must' softened to 'should' rewrites a court order into advice — and a violation into a surprise arrest." },
      { text: "Soften it — kindness first", good: false, principle: "Kindness that changes obligations is distortion with good manners. Accuracy is the kindness the record can keep." },
    ],
  },
  {
    id: "consent-form", conceptId: "informed-consent", title: "Consent — Risks & Alternatives (excerpt)",
    docEn: ["The risks include, uncommonly,", "chest pain or an irregular heartbeat,", "and, rarely, a serious adverse effect.", "You may choose the alternative, or decide tomorrow."],
    docTarget: { es: ["Los riesgos incluyen, con poca frecuencia,", "dolor de pecho o latido irregular,", "y, raramente, un efecto adverso grave.", "Puede elegir la alternativa, o decidir mañana."], zh: ["风险包括（不常见）", "胸痛或心律不齐，", "以及（罕见）严重不良反应。", "您可以选择替代方案，或明天再决定。"] },
    dilemmaTitle: "The whisper — the clinician, hurried, pen already moving:",
    dilemma: "“She is frightened. Skip the 'serious adverse effect' line when you read it — we will cover it if anything happens.”",
    stamps: [
      { text: "Sight-translate every line, then flag the request openly", good: true, principle: "Informed consent without the serious risk is not informed (OHA/NCIHC ethics). You render completely — and the request itself becomes visible, not obeyed in silence." },
      { text: "Skip the line — calm first", good: false, principle: "A calm obtained by omission is not consent. If harm follows, the record will show she agreed to a procedure that was never fully named to her." },
    ],
  },
];

let engine, domain, concepts = [], targetLang = "es";
let sitting = null; // { order, caseIndex, chunkIndex, seals, sightOk, sightTotal }

function params() { return new URLSearchParams(location.search); }
function hubHref() {
  const p = params();
  return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-legal")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`;
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function updateSyncBadge() {
  const st = engine.status();
  const b = $("#syncBadge");
  b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`;
  b.className = `pill ${st.online ? "pill-on" : "pill-local"}`;
  $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref();
}
function conceptFor(c) { return concepts.find((x) => x.conceptId === c.conceptId) || { conceptId: c.conceptId, areaIds: ["sight-documents"], terms: { en: { term: c.conceptId } } }; }
function speak(text, lang) {
  try { const u = new SpeechSynthesisUtterance(text); u.lang = lang === "es" ? "es-ES" : lang === "zh" ? "zh-CN" : "en-US"; u.rate = 0.94; speechSynthesis.speak(u); } catch { /* typed always works */ }
}

async function boot() {
  const p = params();
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  let fallbackConcepts = core.CONCEPTS;
  try { const r = await fetch("concepts-subset.json"); if (r.ok) fallbackConcepts = await r.json(); } catch { /* bundled fallback */ }
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "oregon-legal";
  engine = new EngineClient({
    engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787",
    learnerId: p.get("learner") || "", domainId, core,
    fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.OREGON_LEGAL,
    fallbackConcepts,
  });
  await engine.init();
  domain = await engine.getDomain(engine.domainId);
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fallbackConcepts;
  updateSyncBadge();
  $("#titleContext").innerHTML = `<strong>${esc(domain?.label.en || engine.domainId)}</strong> · ${CASES.length} desk cases (sight paper + the whisper after). ${engine.online ? "Engine connected — seals sync to your career." : "Offline — the book keeps tonight's seals locally."}`;
  $("#startBtn").addEventListener("click", startSitting);
  $("#againBtn").addEventListener("click", startSitting);
  $("#scanBtn").addEventListener("click", scanNext);
  $("#renderChunkBtn").addEventListener("click", renderChunk);
  $("#chunkInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) renderChunk(); });
  $("#nextCaseBtn").addEventListener("click", nextCase);
  $("#endBtn").addEventListener("click", endSitting);
  setInterval(updateSyncBadge, 5000);
}

function startSitting() {
  sitting = { order: [...CASES], caseIndex: 0, chunkIndex: -1, seals: 0, sightOk: 0, sightTotal: 0, judged: 0, judgedWell: 0, renderedGroups: new Set() };
  $("#recordBook").innerHTML = "";
  showScreen("screen-play");
  loadCase();
}
function currentCase() { return sitting.order[sitting.caseIndex]; }

function loadCase() {
  const c = currentCase();
  sitting.chunkIndex = -1; sitting.docDone = false;
  $("#hudCase").textContent = `Case ${sitting.caseIndex + 1} / ${sitting.order.length}`;
  $("#hudDoc").textContent = c.title;
  $("#hudSeals").textContent = `Seals ${sitting.seals}`;
  $("#docTitle").textContent = c.title;
  $("#chunkLabel").textContent = "Unscanned — eyes ready";
  $("#docPaper").innerHTML = c.docEn.map((g, i) => `<span class="chunk idle" data-chunk="${i}">${esc(g)} </span>`).join("");
  $("#chunkInput").value = ""; $("#chunkFeedback").textContent = "";
  $("#stampZone").hidden = true; $("#nextCaseBtn").hidden = true;
  $("#principleCard").hidden = true;
  $("#scanBtn").disabled = false;
}

function scanNext() {
  const c = currentCase();
  if (sitting.chunkIndex >= c.docEn.length - 1) return;
  sitting.chunkIndex += 1;
  document.querySelectorAll(".chunk").forEach((el, i) => {
    el.className = `chunk ${i < sitting.chunkIndex ? "done" : i === sitting.chunkIndex ? "lit" : "idle"}`;
  });
  $("#chunkLabel").textContent = `Group ${sitting.chunkIndex + 1} of ${c.docEn.length} lit — render it before scanning on`;
  speak(c.docEn[sitting.chunkIndex], "en");
  $("#chunkInput").focus();
}

function normalize(s) { return (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim(); }

function renderChunk() {
  const c = currentCase();
  if (sitting.chunkIndex < 0) { $("#chunkFeedback").textContent = "Scan first. Eyes lead."; return; }
  const expected = (c.docTarget[targetLang] || c.docTarget.es)[sitting.chunkIndex];
  if (sitting.renderedGroups?.has(sitting.chunkIndex)) { $("#chunkFeedback").textContent = "That group is already on the record. Scan on."; return; }
  const got = $("#chunkInput").value.trim();
  if (!got) { $("#chunkFeedback").textContent = "Render the lit group — silence leaves a hole in the paper."; return; }
  const expWords = new Set(normalize(expected).split(" ").filter(Boolean));
  const gotWords = new Set(normalize(got).split(" ").filter(Boolean));
  const overlap = [...expWords].filter((w) => gotWords.has(w)).length / Math.max(1, expWords.size);
  const ok = overlap >= 0.45; // content words only — a lone first word is not a rendering
  sitting.sightTotal += 1; if (ok) sitting.sightOk += 1;
  const fb = $("#chunkFeedback");
  fb.className = `feedback ${ok ? "good" : "bad"}`;
  fb.textContent = ok ? "On the record." : `Thin. The paper says: “${expected}”`;
  document.querySelector(`[data-chunk="${sitting.chunkIndex}"]`)?.classList.add("done");
  const concept = conceptFor(c);
  engine.recordEvidence({
    conceptId: concept.conceptId, areaId: concept.areaIds?.[0] || "sight-documents", gameId: "bench-call",
    activityType: "sight", stage: 5, languageDirection: `en->${targetLang}`,
    correct: ok, score: Math.round(overlap * 100) / 100, confidence: 0.8,
    responseSummary: `Sight group ${sitting.chunkIndex + 1} of ${c.id}`,
  });
  sitting.renderedGroups.add(sitting.chunkIndex);
  updateSyncBadge();
  $("#chunkInput").value = "";
  if (sitting.chunkIndex >= c.docEn.length - 1) {
    sitting.docDone = true;
    $("#scanBtn").disabled = true;
    showDilemma();
  }
}

function showDilemma() {
  const c = currentCase();
  $("#dilemmaTitle").textContent = c.dilemmaTitle;
  $("#dilemmaText").textContent = c.dilemma;
  const zone = $("#stampZone");
  zone.hidden = false;
  $("#stampChoices").innerHTML = c.stamps.map((s, i) => `<button type="button" class="stamp-btn" data-stamp="${i}">${esc(s.text)}</button>`).join("");
  document.querySelectorAll("[data-stamp]").forEach((b) => b.addEventListener("click", () => judge(Number(b.dataset.stamp))));
  zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function judge(i) {
  const c = currentCase();
  const choice = c.stamps[i];
  document.querySelectorAll("[data-stamp]").forEach((b) => { b.disabled = true; if (Number(b.dataset.stamp) === i) b.classList.add("chosen"); });
  sitting.judged += 1; if (choice.good) { sitting.judgedWell += 1; sitting.seals += 1; }
  $("#hudSeals").textContent = `Seals ${sitting.seals}`;
  const book = $("#recordBook");
  if (book.querySelector(".hint")) book.innerHTML = "";
  const entry = document.createElement("div");
  entry.className = "seal-entry";
  entry.innerHTML = `<span class="seal">${choice.good ? "On the record" : "Struck — with regret"}</span><br><strong>${esc(c.title)}:</strong> ${esc(choice.text)}`;
  book.appendChild(entry);
  const card = $("#principleCard");
  card.hidden = false;
  card.innerHTML = `<strong>${choice.good ? "Why this holds:" : "Why this fails:"}</strong> ${esc(choice.principle)}<br><span class="hint" style="color:#c9b995;">Source family: ${esc((conceptFor(c).sourceIds || []).join(", ") || "OJD / OHA ethics")} — full provenance in the Console.</span>`;
  const concept = conceptFor(c);
  engine.recordEvidence({
    conceptId: concept.conceptId, areaId: concept.areaIds?.[0] || "professional-judgment-legal", gameId: "bench-call",
    activityType: "judgment", stage: 3, languageDirection: `en->${targetLang}`,
    correct: choice.good, score: choice.good ? 1 : 0.15, confidence: 0.85,
    responseSummary: `Bench judgment: ${choice.text}`,
  });
  updateSyncBadge();
  $("#nextCaseBtn").hidden = false; $("#nextCaseBtn").focus();
}

function nextCase() {
  sitting.caseIndex += 1;
  if (sitting.caseIndex >= sitting.order.length) { endSitting(); return; }
  loadCase();
}

async function endSitting() {
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  const sightPct = sitting.sightTotal ? Math.round((sitting.sightOk / sitting.sightTotal) * 100) : 0;
  $("#endTitle").textContent = sitting.judgedWell === sitting.judged && sitting.judged > 0 ? "The record would survive being read aloud. So would you." : "The book keeps your stamps — and your near-misses. Both teach.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Sight rendering <strong>${sitting.sightOk}/${sitting.sightTotal} groups (${sightPct}%)</strong> · Professional calls <strong>${sitting.judgedWell}/${sitting.judged}</strong> · Seals earned <strong>${sitting.seals}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Keep sitting — judgment sharpens by cases.")}<br><span class="hint">Atelier builds the terms, Night Shift survives them live, this desk defends them on paper. One career, three crafts.</span>`;
  showScreen("screen-end");
}

boot().catch((e) => {
  $("#titleContext").textContent = `The desk failed to open (${e.message}). Reload — the cases reschedule themselves.`;
  $("#startBtn").disabled = true;
});
