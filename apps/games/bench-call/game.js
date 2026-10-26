// Bench Call — canvas judgement desk (regen, game-spec-kit).
// A courtroom desk as a place: paper centre, judge left, whisperer right,
// two stamps waiting. Scan by tapping paper, render by voice/keyboard,
// judge by slamming a stamp. Evidence logic unchanged (sight Stage 5,
// judgment Stage 3) — the worksheet is now furniture.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
import { Juice } from "../../../packages/game-kit/juice.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
const juice = new Juice(cv);

const CASES = [
  { id: "waiver-form", conceptId: "waiver", title: "Waiver of Jury Trial (excerpt)",
    docEn: ["I understand that I have the right", "to a trial by jury.", "By signing, I knowingly and voluntarily", "give up that right."],
    docTarget: { es: ["Entiendo que tengo derecho", "a un juicio con jurado.", "Al firmar, renuncio a ese derecho", "de forma informada y voluntaria."], zh: ["我理解我有权", "接受陪审团审判。", "签字即表示我知情并自愿", "放弃该权利。"] },
    dilemmaTitle: "The whisper — the defendant, low, to you alone:",
    dilemma: "“Just tell the judge I did not mean to sign it, okay? You tell him better than me.” The attorney is looking away. No one heard but you.",
    stamps: [
      { text: "Interpret it aloud, exactly", good: true, principle: "Completeness: interpret everything, for everyone, without addition. The court — not you — responds." },
      { text: "Quietly advise him", good: false, principle: "That is advocacy, and it breaks the record. His words stop being his." },
      { text: "Pretend you didn't hear", good: false, principle: "Omission is also editing. The duty includes the uncomfortable utterances." } ] },
  { id: "conditions-order", conceptId: "sentence-conditions", title: "Conditions of Sentence (excerpt)",
    docEn: ["You must report to your probation officer", "within 72 hours.", "You must have no contact", "with the store or its staff."],
    docTarget: { es: ["Debe presentarse ante su oficial de libertad condicional", "en un plazo de 72 horas.", "No debe tener ningún contacto", "con la tienda ni su personal."], zh: ["您必须向缓刑官报到", "在72小时内。", "您不得有任何联系", "与该商店或其员工。"] },
    dilemmaTitle: "The whisper — the probation officer, friendly, afterward:",
    dilemma: "“He looks lost. Between us — soften 'must' a little when you recap it? 'Should try' lands kinder.”",
    stamps: [
      { text: "Recap exactly: 'must' intact", good: true, principle: "Modality is the sentence. 'Must' softened to 'should' rewrites an order into advice." },
      { text: "Soften it — kindness first", good: false, principle: "Kindness that changes obligations is distortion with good manners." } ] },
  { id: "consent-form", conceptId: "informed-consent", title: "Consent — Risks & Alternatives (excerpt)",
    docEn: ["The risks include, uncommonly,", "chest pain or an irregular heartbeat,", "and, rarely, a serious adverse effect.", "You may choose the alternative, or decide tomorrow."],
    docTarget: { es: ["Los riesgos incluyen, con poca frecuencia,", "dolor de pecho o latido irregular,", "y, raramente, un efecto adverso grave.", "Puede elegir la alternativa, o decidir mañana."], zh: ["风险包括（不常见）", "胸痛或心律不齐，", "以及（罕见）严重不良反应。", "您可以选择替代方案，或明天再决定。"] },
    dilemmaTitle: "The whisper — the clinician, hurried, pen moving:",
    dilemma: "“She is frightened. Skip the 'serious adverse effect' line — we will cover it if anything happens.”",
    stamps: [
      { text: "Render every line, flag it openly", good: true, principle: "Consent without the serious risk is not informed. You render completely — and the request itself becomes visible." },
      { text: "Skip the line — calm first", good: false, principle: "A calm obtained by omission is not consent, and the record will outlive the calm." } ] },
];

let engine, domain, concepts = [], targetLang = "es";
let S = null, raf = null;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-legal")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { if (raf) cancelAnimationFrame(raf); raf = null; document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function conceptFor(c) { return concepts.find((x) => x.conceptId === c.conceptId) || { conceptId: c.conceptId, areaIds: ["sight-documents"], terms: { en: { term: c.conceptId } } }; }
function speak(text, lang) { try { const u = new SpeechSynthesisUtterance(text); u.lang = lang === "es" ? "es-ES" : lang === "zh" ? "zh-CN" : "en-US"; u.rate = 0.94; speechSynthesis.speak(u); } catch {} }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }
const PAPER = { x: 300, y: 92, w: 380, h: 330 };
function groupRect(i) { return { x: PAPER.x + 26, y: PAPER.y + 62 + i * 62, w: PAPER.w - 52, h: 52 }; }
function stampRect(i, n) { const w = 250, gap = 18, total = n * w + (n - 1) * gap, x0 = (W - total) / 2; return { x: x0 + i * (w + gap), y: 448, w, h: 62 }; }

async function boot() {
  const p = new URLSearchParams(location.search);
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "oregon-legal";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.OREGON_LEGAL, fallbackConcepts: fb });
  await engine.init();
  domain = await engine.getDomain(engine.domainId);
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb;
  syncBadge();
  $("#titleContext").innerHTML = `<strong>${esc(domain?.label.en || engine.domainId)}</strong> · ${CASES.length} desk cases — sight paper first, the whisper after.`;
  $("#startBtn").addEventListener("click", startSitting);
  $("#againBtn").addEventListener("click", startSitting);
  $("#renderBtn").addEventListener("click", renderChunk);
  $("#chunkInput").addEventListener("keydown", (e) => { if (e.key === "Enter") renderChunk(); });
  $("#nextCaseBtn").addEventListener("click", nextCase);
  $("#endBtn").addEventListener("click", endSitting);
  cv.addEventListener("pointerdown", onTap);
}
function startSitting() {
  S = { caseIndex: 0, chunkIndex: -1, seals: 0, sightOk: 0, sightTotal: 0, judged: 0, judgedWell: 0, rendered: new Set(), phase: "scan", stampAnim: 0, chosenStamp: -1, t: 0 };
  $("#recordBook").innerHTML = "";
  show("screen-play"); loadCase(); loop();
}
function cur() { return CASES[S.caseIndex]; }
function loadCase() {
  S.chunkIndex = -1; S.phase = "scan"; S.chosenStamp = -1; S.rendered = new Set();
  $("#hudCase").textContent = `Case ${S.caseIndex + 1} / ${CASES.length}`;
  $("#hudDoc").textContent = cur().title;
  $("#hudSeals").textContent = `Seals ${S.seals}`;
  $("#principleCard").hidden = true; $("#nextCaseBtn").hidden = true;
  $("#feedback").textContent = "Tap the paper to scan the first sense-group.";
  $("#chunkInput").value = "";
}
function scanNext() {
  const c = cur();
  if (S.chunkIndex >= c.docEn.length - 1) return;
  S.chunkIndex++;
  speak(c.docEn[S.chunkIndex], "en");
  Juice.pop();
  $("#feedback").textContent = `Group ${S.chunkIndex + 1} of ${c.docEn.length} is lit — render it below, then tap the paper again.`;
  $("#chunkInput").focus();
}
function normalize(s) { return (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim(); }
function renderChunk() {
  const c = cur();
  if (S.chunkIndex < 0) { $("#feedback").textContent = "Tap the paper first. Eyes lead."; $("#feedback").className = "feedback bad"; return; }
  if (S.rendered.has(S.chunkIndex)) { $("#feedback").textContent = "That group is already on the record. Tap the paper to scan on."; return; }
  const expected = (c.docTarget[targetLang] || c.docTarget.es)[S.chunkIndex];
  const got = $("#chunkInput").value.trim();
  if (!got) { $("#feedback").textContent = "Render the lit group — silence leaves a hole in the paper."; $("#feedback").className = "feedback bad"; return; }
  const expW = new Set(normalize(expected).split(" ").filter(Boolean));
  const gotW = new Set(normalize(got).split(" ").filter(Boolean));
  const overlap = [...expW].filter((w) => gotW.has(w)).length / Math.max(1, expW.size);
  const ok = overlap >= 0.45;
  S.sightTotal++; if (ok) S.sightOk++;
  S.rendered.add(S.chunkIndex);
  const fb = $("#feedback"); fb.className = `feedback ${ok ? "good" : "bad"}`;
  fb.textContent = ok ? "On the record. Tap the paper for the next group." : `Thin — the paper says: “${expected}”`;
  if (ok) { Juice.good(); juice.burst(PAPER.x + PAPER.w / 2, groupRect(S.chunkIndex).y + 20, "#177a6c", 14); }
  const concept = conceptFor(c);
  engine.recordEvidence({ conceptId: concept.conceptId, areaId: concept.areaIds?.[0] || "sight-documents", gameId: "bench-call", activityType: "sight", stage: 5, languageDirection: `en->${targetLang}`, correct: ok, score: Math.round(overlap * 100) / 100, responseSummary: `Bench sight group ${S.chunkIndex + 1} of ${c.id}` });
  syncBadge();
  $("#chunkInput").value = ""; $("#chunkInput").focus();
  if (S.chunkIndex >= c.docEn.length - 1 && S.rendered.size >= c.docEn.length) {
    S.phase = "judge";
    $("#feedback").textContent = `${cur().dilemmaTitle} Choose your stamp on the desk.`;
    speak(cur().dilemma, "en");
  }
}
function judge(i) {
  const c = cur(); const choice = c.stamps[i];
  S.chosenStamp = i; S.stampAnim = 16;
  S.judged++; if (choice.good) { S.judgedWell++; S.seals++; }
  juice.shake(choice.good ? 4 : 9); if (choice.good) Juice.good(); else Juice.bad();
  $("#hudSeals").textContent = `Seals ${S.seals}`;
  const book = $("#recordBook");
  const entry = document.createElement("div");
  entry.className = "seal-entry";
  entry.innerHTML = `<span class="seal">${choice.good ? "On the record" : "Struck — with regret"}</span><br><strong>${esc(c.title)}:</strong> ${esc(choice.text)}`;
  book.appendChild(entry);
  const card = $("#principleCard");
  card.hidden = false;
  card.innerHTML = `<strong>${choice.good ? "Why this holds:" : "Why this fails:"}</strong> ${esc(choice.principle)}<br><span class="hint">Source family: ${esc((conceptFor(c).sourceIds || []).join(", ") || "OJD / OHA ethics")} — provenance in the Console.</span>`;
  const concept = conceptFor(c);
  engine.recordEvidence({ conceptId: concept.conceptId, areaId: concept.areaIds?.[0] || "professional-judgment-legal", gameId: "bench-call", activityType: "judgment", stage: 3, languageDirection: `en->${targetLang}`, correct: choice.good, score: choice.good ? 1 : 0.15, responseSummary: `Bench stamp: ${choice.text}` });
  syncBadge();
  $("#nextCaseBtn").hidden = false; $("#nextCaseBtn").focus();
  S.phase = "done";
}
function onTap(e) {
  if (!S) return;
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
  if (S.phase === "scan" && x >= PAPER.x && x <= PAPER.x + PAPER.w && y >= PAPER.y && y <= PAPER.y + PAPER.h) { scanNext(); return; }
  if (S.phase === "judge") {
    const n = cur().stamps.length;
    for (let i = 0; i < n; i++) { const b = stampRect(i, n); if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { judge(i); return; } }
  }
}
function nextCase() { S.caseIndex++; if (S.caseIndex >= CASES.length) { endSitting(); return; } loadCase(); }
function loop() {
  if (!S) return;
  S.t++; if (S.stampAnim > 0) S.stampAnim--;
  draw(); juice.update();
  if ($("#screen-play").classList.contains("is-active")) raf = requestAnimationFrame(loop);
}
function draw() {
  const { x: sx, y: sy } = juice.shakeOffset();
  ctx.save(); ctx.translate(sx, sy);
  // room + desk
  ctx.fillStyle = "#241a10"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#3d2c17"; ctx.fillRect(0, 300, W, 240);
  ctx.fillStyle = "#4c3820"; ctx.fillRect(0, 300, W, 10);
  ctx.fillStyle = "rgba(255,214,130,.08)"; ctx.beginPath(); ctx.moveTo(330, 0); ctx.lineTo(630, 0); ctx.lineTo(760, 300); ctx.lineTo(200, 300); ctx.closePath(); ctx.fill();
  // judge (left) and whisperer (right)
  drawPerson(120, 210, "#2c3550", "#f2c29b", "JUDGE", S.phase === "judge" ? -1 : 0);
  drawPerson(842, 210, "#5a2e35", "#e8b08a", S.caseIndex === 1 ? "OFFICER" : S.caseIndex === 2 ? "CLINICIAN" : "DEFENDANT", S.phase === "judge" ? 1 : 0);
  if (S.phase === "judge" || S.phase === "done") {
    bubble(700, 96, 238, cur().dilemma.length > 90 ? 118 : 92, cur().dilemma);
  }
  // paper
  ctx.fillStyle = "#0f0803"; ctx.fillRect(PAPER.x + 7, PAPER.y + 9, PAPER.w, PAPER.h);
  ctx.fillStyle = "#fdf6e3"; ctx.fillRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h);
  ctx.strokeStyle = "#231a12"; ctx.lineWidth = 2; ctx.strokeRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h);
  ctx.fillStyle = "#6b5d4f"; ctx.font = "700 13px 'Public Sans', sans-serif"; ctx.textAlign = "center";
  ctx.fillText(cur().title.toUpperCase(), PAPER.x + PAPER.w / 2, PAPER.y + 30);
  ctx.strokeStyle = "#d9c9a3"; ctx.beginPath(); ctx.moveTo(PAPER.x + 24, PAPER.y + 42); ctx.lineTo(PAPER.x + PAPER.w - 24, PAPER.y + 42); ctx.stroke();
  cur().docEn.forEach((g, i) => {
    const r = groupRect(i);
    const state = S.rendered.has(i) ? "done" : i === S.chunkIndex ? "lit" : "idle";
    if (state === "lit") { ctx.fillStyle = "#ffe9a8"; ctx.beginPath(); ctx.roundRect(r.x - 6, r.y - 4, r.w + 12, r.h, 7); ctx.fill(); }
    ctx.font = `${state === "idle" ? "600" : "700"} 16px 'Public Sans', sans-serif`; ctx.textAlign = "left";
    ctx.fillStyle = state === "done" ? "#177a6c" : state === "lit" ? "#231a12" : "#9a8a72";
    wrapText(g, r.x, r.y + 20, r.w, 20);
    if (state === "done") { ctx.fillStyle = "#a63a2e"; ctx.font = "800 13px 'Public Sans', sans-serif"; ctx.fillText("✓", r.x + r.w - 8, r.y + 20); }
  });
  if (S.phase === "scan") {
    ctx.fillStyle = `rgba(166,58,46,${0.65 + Math.sin(S.t * 0.1) * 0.25})`;
    ctx.font = "800 15px 'Public Sans', sans-serif"; ctx.textAlign = "center";
    ctx.fillText(S.chunkIndex < 0 ? "TAP THE PAPER TO SCAN" : "TAP FOR NEXT GROUP", PAPER.x + PAPER.w / 2, PAPER.y + PAPER.h - 18);
  }
  // stamps
  if (S.phase === "judge" || S.phase === "done") {
    const n = cur().stamps.length;
    cur().stamps.forEach((s, i) => {
      const b = stampRect(i, n);
      const chosen = S.chosenStamp === i;
      const drop = chosen && S.stampAnim > 0 ? -S.stampAnim * 4 : 0;
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(b.x + 5, b.y + 8, b.w, b.h);
      ctx.fillStyle = chosen ? (s.good ? "#177a6c" : "#a63a2e") : "#7a4a22";
      ctx.beginPath(); ctx.roundRect(b.x, b.y + drop, b.w, b.h, 10); ctx.fill();
      ctx.fillStyle = "#fdf6e3"; ctx.font = "800 14px 'Public Sans', sans-serif"; ctx.textAlign = "center";
      wrapText(s.text.toUpperCase(), b.x + b.w / 2, b.y + drop + 26, b.w - 18, 17, true);
      ctx.fillStyle = "#3d2c17"; ctx.fillRect(b.x + b.w / 2 - 16, b.y - 14 + drop, 32, 14);
    });
    if (S.chosenStamp >= 0 && S.phase === "done") {
      ctx.save();
      ctx.translate(PAPER.x + PAPER.w - 86, PAPER.y + 66); ctx.rotate(-0.22);
      ctx.strokeStyle = cur().stamps[S.chosenStamp].good ? "#177a6c" : "#a63a2e"; ctx.lineWidth = 4;
      ctx.strokeRect(-72, -20, 144, 40);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = "800 16px 'Fraunces', Georgia, serif"; ctx.textAlign = "center";
      ctx.fillText(cur().stamps[S.chosenStamp].good ? "ON THE RECORD" : "STRUCK", 0, 6);
      ctx.restore();
    }
  }
  juice.draw();
  ctx.restore();
}
function drawPerson(x, y, robe, skin, label, lean) {
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y + 78, 42, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(x - 30, y + 74); ctx.quadraticCurveTo(x, y - 18, x + 30, y + 74); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + lean * 4, y - 28, 17, 0, 7); ctx.fill();
  ctx.fillStyle = "#1c1410"; ctx.beginPath(); ctx.arc(x - 6 + lean * 4, y - 30, 2.4, 0, 7); ctx.arc(x + 7 + lean * 4, y - 30, 2.4, 0, 7); ctx.fill();
  ctx.font = "800 12px 'Public Sans', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#d9c9a3";
  ctx.fillText(label, x, y + 98);
}
function bubble(x, y, w, h, text) {
  ctx.fillStyle = "#fffdf6"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = "#231a12"; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 22, y + h); ctx.lineTo(x + 40, y + h + 16); ctx.lineTo(x + 58, y + h); ctx.closePath(); ctx.fillStyle = "#fffdf6"; ctx.fill();
  ctx.fillStyle = "#231a12"; ctx.font = "600 13px 'Public Sans', sans-serif"; ctx.textAlign = "left";
  wrapText(text, x + 13, y + 22, w - 26, 17);
}
function wrapText(text, x, y, maxW, lh, center = false) {
  const words = String(text).split(/\s+/);
  let line = "", yy = y;
  const startX = x;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, center ? startX : x, yy); yy += lh; line = w; }
    else line = test;
  }
  if (line) ctx.fillText(line, center ? startX : x, yy);
}
async function endSitting() {
  if (raf) cancelAnimationFrame(raf); raf = null;
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  const sightPct = S?.sightTotal ? Math.round((S.sightOk / S.sightTotal) * 100) : 0;
  $("#endTitle").textContent = S && S.judgedWell === S.judged && S.judged > 0 ? "The record would survive being read aloud. So would you." : "The book keeps your stamps — and your near-misses. Both teach.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Sight rendering <strong>${S?.sightOk || 0}/${S?.sightTotal || 0} groups (${sightPct}%)</strong> · Professional calls <strong>${S?.judgedWell || 0}/${S?.judged || 0}</strong> · Seals <strong>${S?.seals || 0}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Sit again.")}<br><span class="hint">Atelier builds the terms, Night Shift survives them live, this desk defends them on paper.</span>`;
  show("screen-end"); syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `The desk failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
