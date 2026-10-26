// Milonga del Sentido — cultural translation of tango (Stages 3, 4, 8).
// NOT interpreting: carrying vibe, lunfardo, and barrio memory across languages.
// All verses are original pastiche written for this game. The classics are
// real recordings, linked to streaming search — lyrics are never reproduced.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
import { Juice } from "../../../packages/game-kit/juice.js";
const $ = (s) => document.querySelector(s);
const cv = $("#game"), ctx = cv.getContext("2d");
const W = 960, H = 540;
const juiceC = new Juice(cv);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, concepts = [], targetLang = "es", demoMode = false;
let G = null;

// Original verses (pastiche, ours) each tied to a lunfardo concept + classic.
const VERSES = [
  { conceptId: "arrabal", mood: "nostalgia", record: 0, es: "Vuelvo al arrabal de siempre, con el farol encendido, y el corazón hecho nido de un tiempo que ya se fue.", literal: "I return to the usual outskirts, with the streetlamp lit, and my heart made a nest of a time that has gone.", vibe: "I go back to my old barrio, the streetlamp still burning, my heart nested in a time that's gone for good.", flat: "I am going to the suburbs with a lamp.", note: "Arrabal is homeland, farol is memory's lighthouse. The vibe keeps both; the gloss files them under infrastructure." },
  { conceptId: "chamuyo", mood: "seduction & suspicion", record: 1, es: "No me vengas con chamuyo, que tu verso ya lo sé: lo cantaste en otro barrio con la misma fe.", literal: "Don't come to me with chat, because I already know your poem: you sang it in another neighbourhood with the same faith.", vibe: "Save the sweet-talk — I know that routine. You sang the same song across town, just as sincere.", flat: "Do not talk to me, I know your poem.", note: "Chamuyo is patter with an agenda. 'Sweet-talk' keeps the wink; 'chat' deletes the crime." },
  { conceptId: "bandoneon", mood: "longing", record: 2, es: "Llora el bandoneón bajito, como quien pide perdón, y en cada nota se escapa un pedazo de corazón.", literal: "The accordion cries softly, like someone asking forgiveness, and in each note a piece of heart escapes.", vibe: "The bandoneon weeps under its breath, like it's begging pardon — every note leaks a piece of somebody's heart.", flat: "The accordion plays quietly with notes.", note: "Fueye (bellows) sighs and weeps in tango; naming the bandoneon keeps the character on stage." },
  { conceptId: "guita", mood: "hard luck philosophy", record: 3, es: "Sin guita, sin amor, sin suerte, ¿qué me queda por perder? Un farol, una milonga, y las ganas de volver.", literal: "Without money, without love, without luck, what do I have left to lose? A streetlamp, a dance hall, and the desire to return.", vibe: "Broke, unloved, out of luck — what's left to lose? A streetlamp, a milonga, and the urge to go back.", flat: "I have no money and will return.", note: "Guita is dough, not 'money' in a bank statement — the triple bankruptcy is tango arithmetic." },
  { conceptId: "laburo", mood: "dawn vs night", record: 4, es: "El laburo a la mañana, la milonga a medianoche: entre el pan y la canción se me va la vida entera.", literal: "Work in the morning, the dance hall at midnight: between bread and song my whole life goes.", vibe: "The grind at dawn, the milonga at midnight — between bread and song, my whole life slips away.", flat: "I work and dance every day.", note: "Laburo vs milonga is the immigrant city's heartbeat: dignity at dawn, desire at midnight." },
  { conceptId: "milonga", mood: "ritual & invitation", record: 5, es: "Un cabeceo de lejos, una tanda que promete, y la pista se convierte en patria de los pies.", literal: "A nod from far away, a set of songs that promises, and the floor becomes a homeland of the feet.", vibe: "One nod across the room, one tanda that promises everything — and the dance floor turns into a homeland you walk with your feet.", flat: "People nod and dance at a club.", note: "Cabeceo and tanda are ritual technology. Translating the ritual is translating the culture." },
];
const CLASSICS = [
  { title: "Volver", artist: "Carlos Gardel (1935)", culture: "The exile's return — twenty years gone, forehead wrinkled, temples silvered. Tango's thesis that memory outlives geography.", query: "Volver Carlos Gardel" },
  { title: "Cambalache", artist: "Enrique Santos Discépolo / Julio Sosa", culture: "1934's furious catalogue of a world where honour and theft share a shop window — still quoted in Argentine politics daily.", query: "Cambalache Julio Sosa" },
  { title: "Por una cabeza", artist: "Carlos Gardel (1935)", culture: "A racehorse lost by a head, a love lost the same way — Gardel's smile over ruin, famous far beyond tango.", query: "Por una cabeza Carlos Gardel" },
  { title: "El día que me quieras", artist: "Carlos Gardel", culture: "The romantic counterweight: the day you love me, even the stars will envy us. Every wedding in the Río de la Plata knows it.", query: "El dia que me quieras Carlos Gardel" },
  { title: "A media luz", artist: "Edgardo Donato / Carlos Lenzi", culture: "A dim-lit apartment, a street named Corrientes — desire staged in half-light, with a cat on the piano for luck.", query: "A media luz tango Donato" },
  { title: "La cumparsita", artist: "Gerardo Matos Rodríguez (instrumental)", culture: "The most recognised tango melody on earth — written by a teenager in Montevideo, argued over for a century.", query: "La cumparsita tango" },
];
function spotify(q) { return `https://open.spotify.com/search/${encodeURIComponent(q)}`; }
function apple(q) { return `https://music.apple.com/us/search?term=${encodeURIComponent(q)}`; }
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "rio-tango")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id)); }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function speak(t, lang) { try { const u = new SpeechSynthesisUtterance(t); u.lang = "es-ES"; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} }
function dailyMark(gameId, score) { try { const k = `ev:daily:${gameId}`; const today = new Date().toDateString(); let d = {}; try { d = JSON.parse(localStorage.getItem(k) || "{}"); } catch {} const yest = new Date(Date.now() - 86400000).toDateString(); d.streak = d.lastDay === today ? (d.streak || 1) : d.lastDay === yest ? (d.streak || 0) + 1 : 1; d.lastDay = today; d.best = Math.max(d.best || 0, score || 0); localStorage.setItem(k, JSON.stringify(d)); return d; } catch { return { streak: 1, best: score || 0 }; } }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }

async function boot() {
  const p = new URLSearchParams(location.search);
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  demoMode = localStorage.getItem("ev:demoMode") === "1";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "rio-tango";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.RIO_TANGO || core.OREGON_MEDICAL, fallbackConcepts: fb });
  await engine.init();
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb.filter((c) => c.domainId === engine.domainId);
  syncBadge();
  $("#titleContext").textContent = `Cultural translation, Río de la Plata · ${VERSES.length} original verses · ${CLASSICS.length} classics to unlock.${demoMode ? " Demo mode: English under every verse." : ""} This path is about vibe and context — no patient, no judge, just the music's memory.`;
  $("#startBtn").addEventListener("click", startGame);
  $("#againBtn").addEventListener("click", startGame);
  $("#nextBtn").addEventListener("click", nextVerse);
  $("#listenVerseBtn").addEventListener("click", () => { if (G) speak(VERSES[G.i].es, "es"); });
  $("#quitBtn").addEventListener("click", () => endGame());
  renderShelf();
  cv.addEventListener("pointerdown", onTap);
}
function renderShelf() {
  $("#shelf").innerHTML = CLASSICS.map((r, i) => {
    const unlocked = G?.unlocked.has(i);
    return `<article class="record ${unlocked ? "" : "locked"}"><p class="kicker">${unlocked ? "On your shelf" : "Locked — carry a verse"}</p><h4>${esc(r.title)}</h4><p><strong>${esc(r.artist)}</strong></p><p>${unlocked ? esc(r.culture) : "Its story unlocks when its verse is carried across."}</p>${unlocked ? `<div class="listen-links"><a class="btn" target="_blank" rel="noopener" href="${spotify(r.query)}">Listen on Spotify</a><a class="btn" target="_blank" rel="noopener" href="${apple(r.query)}">Apple Music</a></div>` : ""}</article>`;
  }).join("");
}
let raf = null;
function recordRect(i) { return { x: 92 + i * 272, y: 300, w: 244, h: 150 }; }
function startGame() {
  G = { i: 0, order: shuffle(VERSES.map((_, i) => i)), carried: 0, hearts: 3, unlocked: new Set(), options: [], answered: false, t: 0, spin: 0 };
  show("screen-play"); loadVerse(); loop();
}
function loop() { if (!G) return; G.t++; G.spin += 0.008; draw(); juiceC.update(); if ($("#screen-play").classList.contains("is-active")) raf = requestAnimationFrame(loop); }
function onTap(e) {
  if (!G || G.answered) return;
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
  const i = G.options.findIndex((o, bi) => { const b = recordRect(bi); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; });
  if (i >= 0) choose(G.options[i].kind, recordRect(i));
}
function draw() {
  const v = VERSES[G.order[G.i]];
  const { x: sx, y: sy } = juiceC.shakeOffset();
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = "#150a0e"; ctx.fillRect(0, 0, W, H);
  // bar: lamps, smoke bands, stage
  for (const lx of [170, 480, 790]) { ctx.fillStyle = "rgba(255,190,90,.13)"; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 26, 0); ctx.lineTo(lx + 90, 250); ctx.lineTo(lx - 64, 250); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ffbe5a"; ctx.beginPath(); ctx.arc(lx + 13, 16, 9, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#241118"; ctx.fillRect(0, 238, W, 70);
  // bandoneon player silhouette left, singer centre
  ctx.fillStyle = "#0d0508"; ctx.beginPath(); ctx.ellipse(170, 238, 52, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#3a2030"; ctx.fillRect(138, 150, 64, 76); ctx.fillStyle = "#f2c29b"; ctx.beginPath(); ctx.arc(170, 136, 17, 0, 7); ctx.fill();
  ctx.fillStyle = "#c9a227"; ctx.fillRect(196, 168, 54, 44); ctx.fillStyle = "#241114"; for (let i = 0; i < 4; i++) ctx.fillRect(202 + i * 12, 174, 6, 32);
  ctx.fillStyle = "#0d0508"; ctx.beginPath(); ctx.ellipse(480, 238, 58, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#7a2230"; ctx.beginPath(); ctx.moveTo(448, 226); ctx.quadraticCurveTo(480, 130, 512, 226); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2c29b"; ctx.beginPath(); ctx.arc(480, 122, 18, 0, 7); ctx.fill();
  ctx.fillStyle = "#1c1410"; ctx.beginPath(); ctx.arc(474, 120, 2.4, 0, 7); ctx.arc(487, 120, 2.4, 0, 7); ctx.fill();
  ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(494, 138); ctx.lineTo(506, 108); ctx.stroke(); ctx.fillStyle = "#ddd"; ctx.beginPath(); ctx.arc(508, 104, 7, 0, 7); ctx.fill();
  // verse in smoke
  ctx.textAlign = "center";
  ctx.fillStyle = "#c9a227"; ctx.font = "700 13px 'Public Sans', sans-serif"; ctx.fillText(`EL VERSO · ${v.mood.toUpperCase()} · SPOTLIGHT ${conceptName()}`, 480, 286 - 232 + 218);
  ctx.fillStyle = "#fff8ec"; ctx.font = "italic 700 22px 'Fraunces', Georgia, serif";
  wrapC(`“${v.es}”`, 480, 84, 760, 28);
  if (demoMode) { ctx.fillStyle = "#7fe3c8"; ctx.font = "600 13px 'Public Sans', sans-serif"; wrapC(`Word-for-word (the trap): ${v.literal}`, 480, 158, 720, 18); }
  ctx.fillStyle = "#f7e9e4"; ctx.font = "800 16px 'Public Sans', sans-serif"; ctx.fillText("WHICH RECORD CARRIES IT?", 480, 286);
  // records as choices
  G.options.forEach((o, i) => {
    const b = recordRect(i);
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.roundRect(b.x + 5, b.y + 7, b.w, b.h, 13); ctx.fill();
    ctx.fillStyle = o.kind === "vibe" ? "#2b171d" : "#1e1216"; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 13); ctx.fill();
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 1.6; ctx.stroke();
    // vinyl
    ctx.save(); ctx.translate(b.x + 40, b.y + 42); ctx.rotate(G.spin + i);
    ctx.fillStyle = "#0d0508"; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.fill();
    ctx.strokeStyle = "#4a2c33"; for (const rr of [19, 14]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.stroke(); }
    ctx.fillStyle = "#c9a227"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff8ec"; ctx.font = "600 13px 'Public Sans', sans-serif"; ctx.textAlign = "left";
    wrapL(o.text, b.x + 76, b.y + 28, b.w - 90, 17);
    ctx.fillStyle = "#c9a227"; ctx.font = "800 11px 'Public Sans', sans-serif"; ctx.textAlign = "center";
    ctx.fillText(o.label.toUpperCase() + "?", b.x + b.w / 2, b.y + b.h - 12);
    ctx.textAlign = "center";
  });
  juiceC.draw(); ctx.restore();
}
function conceptName() { return G?.concept?.terms?.es?.term || ""; }
function wrapC(text, cx, y, maxW, lh) { const words = String(text).split(/\s+/); let line = "", yy = y; for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); yy += lh; line = w; } else line = test; } if (line) ctx.fillText(line, cx, yy); }
function wrapL(text, x, y, maxW, lh) { const words = String(text).split(/\s+/); let line = "", yy = y; for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); yy += lh; line = w; } else line = test; } if (line) ctx.fillText(line, x, yy); }
function hud() { $("#hudRound").textContent = `Verse ${G.i + 1} / ${G.order.length}`; $("#hudHearts").textContent = `Hearts ${"●".repeat(Math.max(0, G.hearts))}${"○".repeat(Math.max(0, 3 - G.hearts))}`; $("#hudShelf").textContent = `Records ${G.unlocked.size} / ${CLASSICS.length}`; }
function loadVerse() {
  const v = VERSES[G.order[G.i]];
  const concept = concepts.find((c) => c.conceptId === v.conceptId) || concepts[0];
  G.concept = concept; G.answered = false;
  G.options = shuffle([
    { text: v.vibe, kind: "vibe", label: "Carries the vibe" },
    { text: v.literal, kind: "literal", label: "Faithful gloss" },
    { text: v.flat, kind: "flat", label: "Tourist version" },
  ]);
  $("#feedback").textContent = "";
  $("#nextBtn").hidden = true;
  hud(); renderShelf();
}
function choose(kind, rect) {
  const v = VERSES[G.order[G.i]]; const ok = kind === "vibe"; G.answered = true;
  if (ok) juiceC.confetti(rect.x + rect.w / 2, rect.y + 30); else juiceC.shake(8);
  if (ok) { G.carried++; G.unlocked.add(v.record); }
  else G.hearts--;
  const fb = $("#feedback"); fb.className = `feedback ${ok ? "good" : "bad"}`;
  fb.textContent = ok
    ? `Carried. ${v.note}`
    : kind === "literal"
      ? `Word-true, vibe-lost. ${v.note}`
      : `That is the tourist version — the barrio evaporates. ${v.note}`;
  engine.recordEvidence({ conceptId: G.concept.conceptId, areaId: G.concept.areaIds[0], gameId: "milonga-sentido", activityType: "conceptual", ...(ok ? { stage: 8 } : { stage: 4 }), languageDirection: "es->en", correct: ok, score: ok ? 1 : kind === "literal" ? 0.45 : 0.1, responseSummary: `Milonga: ${v.conceptId} carried as ${kind}` });
  syncBadge(); hud(); renderShelf();
  if (G.hearts <= 0 || G.i >= G.order.length - 1) { $("#nextBtn").hidden = true; setTimeout(endGame, 900); }
  else { $("#nextBtn").hidden = false; $("#nextBtn").focus(); }
}
function nextVerse() { G.i++; loadVerse(); speak(VERSES[G.order[G.i]].es, "es"); }
async function endGame() {
  const g = G; const dm = dailyMark("milonga-sentido", g?.carried || 0);
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = (g?.carried || 0) >= 5 ? "You don't translate tango. You smuggle it, heart intact." : "The milonga keeps your seat warm.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Day streak <strong>${dm.streak}</strong> · Verses carried <strong>${g?.carried || 0} / ${g?.order.length || 0}</strong> · Records unlocked <strong>${g?.unlocked.size || 0} / ${CLASSICS.length}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Another night.")}<br><span class="hint">Cultural evidence (Stages 3–4–8): distinctions and meaning carried — the anti-dictionary skill every real translation eventually demands.</span>`;
  show("screen-end"); syncBadge();
}
boot().catch((e) => { $("#titleContext").textContent = `Milonga failed (${e.message}). Reload.`; $("#startBtn").disabled = true; });
