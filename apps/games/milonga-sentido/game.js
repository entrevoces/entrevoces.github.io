// Milonga del Sentido — cultural translation of tango (Stages 3, 4, 8).
// NOT interpreting: carrying vibe, lunfardo, and barrio memory across languages.
// All verses are original pastiche written for this game. The classics are
// real recordings, linked to streaming search — lyrics are never reproduced.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
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
}
function renderShelf() {
  $("#shelf").innerHTML = CLASSICS.map((r, i) => {
    const unlocked = G?.unlocked.has(i);
    return `<article class="record ${unlocked ? "" : "locked"}"><p class="kicker">${unlocked ? "On your shelf" : "Locked — carry a verse"}</p><h4>${esc(r.title)}</h4><p><strong>${esc(r.artist)}</strong></p><p>${unlocked ? esc(r.culture) : "Its story unlocks when its verse is carried across."}</p>${unlocked ? `<div class="listen-links"><a class="btn" target="_blank" rel="noopener" href="${spotify(r.query)}">Listen on Spotify</a><a class="btn" target="_blank" rel="noopener" href="${apple(r.query)}">Apple Music</a></div>` : ""}</article>`;
  }).join("");
}
function startGame() {
  G = { i: 0, order: shuffle(VERSES.map((_, i) => i)), carried: 0, hearts: 3, unlocked: new Set() };
  show("screen-play"); loadVerse();
}
function hud() { $("#hudRound").textContent = `Verse ${G.i + 1} / ${G.order.length}`; $("#hudHearts").textContent = `Hearts ${"●".repeat(Math.max(0, G.hearts))}${"○".repeat(Math.max(0, 3 - G.hearts))}`; $("#hudShelf").textContent = `Records ${G.unlocked.size} / ${CLASSICS.length}`; }
function loadVerse() {
  const v = VERSES[G.order[G.i]];
  const concept = concepts.find((c) => c.conceptId === v.conceptId) || concepts[0];
  G.concept = concept;
  $("#verseText").textContent = `“${v.es}”`;
  $("#verseMood").textContent = `· ${v.mood}`;
  $("#verseSub").textContent = demoMode ? `Word-for-word (the trap): ${v.literal}` : "";
  $("#verseQ").textContent = `What is this verse really saying — culturally? (Spotlight: “${concept.terms.es.term}”)`;
  const options = shuffle([
    { text: v.vibe, kind: "vibe", label: "Carries the vibe" },
    { text: v.literal, kind: "literal", label: "Faithful gloss" },
    { text: v.flat, kind: "flat", label: "Tourist version" },
  ]);
  $("#choiceZone").innerHTML = options.map((o, i) => `<button type="button" class="choice-btn" data-kind="${o.kind}">${esc(o.text)}<small>${o.label}?</small></button>`).join("");
  document.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => choose(b)));
  $("#feedback").textContent = ""; $("#nextBtn").hidden = true;
  hud(); renderShelf();
}
function choose(btn) {
  const v = VERSES[G.order[G.i]]; const kind = btn.dataset.kind; const ok = kind === "vibe";
  document.querySelectorAll("[data-kind]").forEach((b) => { b.disabled = true; });
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
