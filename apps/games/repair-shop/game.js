// Repair Shop — self-monitoring & repair (activity: repair; Stages 7–8).
// The flawed rendering is segmented; exactly one segment betrays the source
// (swapped term, flipped number/negation, softened obligation). Find it by
// ear, fix it from the tray. Diagnosis and repair are scored separately.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
import { Juice } from "../../../packages/game-kit/juice.js";
const $ = (s) => document.querySelector(s);
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
const juice = new Juice(cv);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, concepts = [], targetLang = "es";
let shop = null;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { if (typeof raf !== "undefined" && raf) cancelAnimationFrame(raf); document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); d.plays = (d.plays || 0) + 1; localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
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
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · jobs minted from its own concepts only · one broken segment per job, guaranteed.`;
  $("#startBtn").addEventListener("click", startShop);
  $("#againBtn").addEventListener("click", startShop);
  $("#nextBtn").addEventListener("click", nextJob);
  $("#quitBtn").addEventListener("click", endShop);
  cv.addEventListener("pointerdown", (e) => { if (!shop || shop.done) return; const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height); for (let i = 0; i < 3; i++) { const b = segRect(i); if (x >= b.x && x <= b.x + b.w && y >= b.y - 30 && y <= b.y + b.h) { pickSegment(i); return; } } const j = shop.jobs[shop.i]; for (let i = 0; i < j.tray.length; i++) { const b = trayRect(i); if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { fitPart(j.tray[i]); return; } } });
}

function buildJob(concept) {
  const ex = concept.examples?.[0] || { en: concept.definition.en, es: concept.definition.es || concept.definition.en, zh: concept.definition.zh || concept.definition.en };
  const faithful = ex[targetLang] || ex.es;
  const words = faithful.split(/\s+/).filter(Boolean);
  // Segment into 3 chunks; corrupt the chunk holding the key term (or chunk 2).
  const third = Math.max(1, Math.ceil(words.length / 3));
  const chunks = [words.slice(0, third).join(" "), words.slice(third, third * 2).join(" "), words.slice(third * 2).join(" ")].filter(Boolean);
  const term = tgt(concept);
  let badIdx = chunks.findIndex((ch) => ch.toLowerCase().includes(term.toLowerCase().split(" ")[0]));
  if (badIdx < 0) badIdx = Math.min(1, chunks.length - 1);
  else if (Math.random() < 0.4 && chunks.length > 2) badIdx = Math.floor(Math.random() * chunks.length); // vary the wound so sittings differ
  const wrongTerm = shuffle(concepts.filter((c) => c.conceptId !== concept.conceptId).map((c) => tgt(c)))[0] || "—";
  const numMatch = chunks[badIdx].match(/\d+/);
  const broken = numMatch
    ? chunks[badIdx].replace(numMatch[0], String(Number(numMatch[0]) + 1))
    : chunks[badIdx].replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), wrongTerm);
  const display = chunks.map((ch, i) => (i === badIdx ? (broken !== ch ? broken : `${wrongTerm} — ${ch}`) : ch));
  const chunkOf = (c) => { const e = c.examples?.[0] || { en: c.definition.en, es: c.definition.es || c.definition.en, zh: c.definition.zh || c.definition.en }; const f = (e[targetLang] || e.es || "").split(/\s+/).filter(Boolean); const th = Math.max(1, Math.ceil(f.length / 3)); return f.slice(th, th * 2).join(" ") || tgt(c); };
  const tray = shuffle([chunks[badIdx], ...shuffle(concepts.filter((c) => c.conceptId !== concept.conceptId)).slice(0, 2).map(chunkOf)]);
  return { concept, source: ex.en, chunks, display, badIdx, tray, fixedChunk: chunks[badIdx] };
}

let raf = null;
function segRect(i) { return { x: 130 + i * 245, y: 218, w: 225, h: 108 }; }
function trayRect(i) { return { x: 130 + i * 245, y: 408, w: 225, h: 64 }; }
function startShop() {
  shop = { jobs: shuffle(concepts).slice(0, 8).map(buildJob), i: 0, fixed: 0, spotted: 0, picked: null, done: false, smoke: 0, t: 0 };
  show("screen-play"); loadJob(); loop();
}
function loop() { if (!shop) return; shop.t++; shop.smoke++; draw(); juice.update(); if ($("#screen-play").classList.contains("is-active")) raf = requestAnimationFrame(loop); }
function draw() {
  if (!shop) return;
  const j = shop.jobs[shop.i];
  const { x: sx, y: sy } = juice.shakeOffset();
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = "#202b30"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2e3d42"; ctx.fillRect(0, 0, W, 120);
  for (const lx of [180, 480, 780]) { ctx.fillStyle = "rgba(255,214,130,.12)"; ctx.beginPath(); ctx.moveTo(lx - 12, 0); ctx.lineTo(lx + 12, 0); ctx.lineTo(lx + 42, 120); ctx.lineTo(lx - 42, 120); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - 13, 0, 26, 12); }
  // blueprint (source)
  ctx.fillStyle = "#fdf6e3"; ctx.beginPath(); ctx.roundRect(130, 26, 700, 76, 9); ctx.fill();
  ctx.fillStyle = "#56705f"; ctx.font = "700 11px 'Public Sans', sans-serif"; ctx.textAlign = "left"; ctx.fillText("THEY SAID — THE BLUEPRINT", 148, 48);
  ctx.fillStyle = "#231a12"; ctx.font = "600 15px 'Public Sans', sans-serif"; wrap(`“${j.source}”`, 148, 72, 664, 19);
  // conveyor machine
  ctx.fillStyle = "#171f23"; ctx.fillRect(100, 330, 760, 26);
  ctx.fillStyle = "#39444a"; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(126 + i * 66, 343, 11, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#f2e6c9"; ctx.font = "800 13px 'Public Sans', sans-serif"; ctx.textAlign = "center"; ctx.fillText("IT WENT OUT AS — TAP THE SMOKING SEGMENT", 480, 196);
  j.display.forEach((seg, i) => {
    const r = segRect(i);
    const lifted = shop.picked === i ? -26 : 0;
    const fixed = shop.done && i === j.badIdx;
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 8 + lifted, r.w, r.h, 10); ctx.fill();
    ctx.fillStyle = fixed ? "#177a6c" : shop.picked === i ? "#fdf0d5" : "#4a5a61";
    ctx.beginPath(); ctx.roundRect(r.x, r.y + lifted, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = fixed ? "#7fe3c8" : "#263238"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = fixed ? "#fff" : "#f2e6c9"; ctx.font = "700 14px 'Public Sans', sans-serif"; wrap(seg, r.x + 12, r.y + lifted + 28, r.w - 24, 18, true);
    if (!shop.done && i === j.badIdx) { // the wound smokes — visible, findable by eye
      for (let k = 0; k < 3; k++) { const yy = r.y + lifted - 6 - ((shop.smoke * 1.2 + k * 17) % 46); ctx.fillStyle = `rgba(200,200,200,${0.5 - ((shop.smoke + k * 17) % 46) / 100})`; ctx.beginPath(); ctx.arc(r.x + r.w / 2 + Math.sin(shop.t * 0.1 + k) * 8, yy, 6 + k * 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#ff8a5c"; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + lifted + 8, 3 + Math.sin(shop.t * 0.3) * 1, 0, 7); ctx.fill();
    }
  });
  ctx.fillStyle = "#f2e6c9"; ctx.font = "800 13px 'Public Sans', sans-serif"; ctx.fillText("PARTS TRAY — FIT THE HONEST PART", 480, 392);
  j.tray.forEach((part, i) => {
    const r = trayRect(i);
    ctx.fillStyle = "#171f23"; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
    ctx.strokeStyle = "#e9a13b"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#ffe9b0"; ctx.font = "700 13px 'Public Sans', sans-serif"; wrap(part, r.x + 10, r.y + 25, r.w - 20, 16, true);
  });
  juice.draw(); ctx.restore();
}
function wrap(text, x, y, maxW, lh, center = false) { const words = String(text).split(/\s+/); let line = "", yy = y; for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, center ? x + maxW / 2 : x, yy); if (center) ctx.textAlign = "center"; yy += lh; line = w; } else line = test; } if (line) ctx.fillText(line, center ? x + maxW / 2 : x, yy); }
function loadJob() {
  const j = shop.jobs[shop.i];
  shop.picked = null; shop.done = false;
  $("#hudJob").textContent = `Job ${shop.i + 1} / ${shop.jobs.length} · ${j.concept.terms.en.term}`;
  $("#hudFixed").textContent = `Repaired ${shop.fixed}`;
  $("#feedback").textContent = "One segment smokes. Tap it to lift, then fit the honest part.";
  $("#feedback").className = "feedback"; $("#nextBtn").hidden = true;
}
function pickSegment(i) {
  shop.picked = i; Juice.pop();
  $("#feedback").textContent = "Segment on the lift. Now fit the honest part from the tray.";
  $("#feedback").className = "feedback";
}
function fitPart(partText) { const btn = { dataset: { part: partText } };
  if (shop.picked === null) { $("#feedback").textContent = "Lift a segment first — diagnosis before parts."; return; }
  const j = shop.jobs[shop.i];
  const spotted = shop.picked === j.badIdx;
  const fitted = btn.dataset.part === j.fixedChunk;
  const ok = spotted && fitted;
  if (spotted) shop.spotted++;
  if (ok) shop.fixed++;
  shop.done = true;
  if (ok) { Juice.good(); juice.confetti(480, 240); } else { Juice.bad(); juice.shake(7); }
  const fb = $("#feedback");
  fb.className = `feedback ${ok ? "good" : "bad"}`;
  fb.textContent = ok
    ? `Repaired. The betrayal was “${j.display[j.badIdx]}” — now it reads “${j.fixedChunk}”. That second hearing is a trainable skill, and you just trained it.`
    : !spotted
      ? `Wrong lift. The betrayal hides in segment ${j.badIdx + 1}: “${j.display[j.badIdx]}” should be “${j.fixedChunk}”. Listen for the term the turn cannot lose.`
      : `Right segment, wrong part. The honest part is “${j.fixedChunk}” — close cousins are how distortions dress for work.`;
  engine.recordEvidence({ conceptId: j.concept.conceptId, areaId: j.concept.areaIds[0], gameId: "repair-shop", activityType: "repair", stage: 7, languageDirection: `en->${targetLang}`, correct: ok, score: ok ? 1 : spotted ? 0.45 : 0.1, responseSummary: `Repair spot=${spotted} fit=${fitted} on ${j.concept.conceptId}` });
  syncBadge();
  $("#hudFixed").textContent = `Repaired ${shop.fixed}`;
  $("#nextBtn").hidden = false; $("#nextBtn").focus();
}
function nextJob() { shop.i++; if (shop.i >= shop.jobs.length) { endShop(); return; } loadJob(); }
async function endShop() {
  const s = shop; shop = null;
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = s && s.fixed >= 4 ? "Your ear catches betrayals before clients pay for them." : "Every master was once slow at hearing themselves. The shop stays open.";
  const dm = dailyMark("repair-shop", s?.fixed || 0); $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Best repairs <strong>${dm.best}</strong> · Jobs <strong>${s?.jobs.length || 0}</strong> · Betrayals spotted <strong>${s?.spotted || 0}</strong> · Fully repaired <strong>${s?.fixed || 0}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "More jobs.")}<br><span class="hint">Repair evidence (Stage 7) exists only here — producing and proofreading are different muscles.</span>`;
  show("screen-end"); syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Shop failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
