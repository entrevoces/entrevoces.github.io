// VocabCraft — voxel mine/craft/build (Stages 2 & 5). three.js, WebGL.
// Mine the TRUE equivalent blocks, lay three spans across the river, walk across.
// The bridge is the assessment you can stand on; wrong blocks crumble at the bank.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, concepts = [], targetLang = "es", THREE = null, T = null;
let craft = null; let flatMode = false;
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "oregon-medical")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function tgt(c) { return c.terms[targetLang]?.term || c.terms.es?.term || c.terms.en.term; }
function showError(m) { const o = $("#errOverlay"); o.hidden = false; o.textContent = m; }

async function boot() {
  const p = new URLSearchParams(location.search);
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "oregon-medical";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.OREGON_MEDICAL, fallbackConcepts: fb });
  await engine.init();
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb.filter((c) => c.domainId === engine.domainId);
  syncBadge();
  const dom = await engine.getDomain(engine.domainId);
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · bridge needs 3 mined spans · English → ${targetLang === "zh" ? "中文" : "Español"}.`;
  $("#startBtn").addEventListener("click", startCraft);
  $("#modeBtn")?.addEventListener("click", toggleMode);
  $("#againBtn").addEventListener("click", startCraft);
  try { THREE = await import("three"); buildWorld(); }
  catch (e) { flatMode = true; showError("3D did not load here — no dead end: the flat crossing below plays the same mine-and-build trial without WebGL."); $("#startBtn").textContent = "Play the flat crossing"; setTimeout(()=>{$("#errOverlay").hidden=true;},4000); }
}

function blockTexture(text, top = "#7fae56") {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const x = cv.getContext("2d");
  x.fillStyle = top; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i < 26; i++) x.fillRect(Math.random() * 120, Math.random() * 120, 7, 7);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  // term label on a second canvas used as sprite above block
  const lc = document.createElement("canvas"); lc.width = 512; lc.height = 128;
  const lx = lc.getContext("2d");
  lx.fillStyle = "rgba(20,28,18,0.9)"; lx.beginPath(); lx.roundRect(6, 14, 500, 100, 16); lx.fill();
  lx.strokeStyle = "#f4d58a"; lx.lineWidth = 4; lx.stroke();
  lx.fillStyle = "#fff8ea"; lx.font = "700 40px Public Sans, sans-serif"; lx.textAlign = "center"; lx.textBaseline = "middle";
  lx.fillText(text.length > 24 ? text.slice(0, 23) + "…" : text, 256, 66);
  const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
  return { tex, ltex };
}

function buildWorld() {
  const canvas = $("#gl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x87b5d6, 26, 60);
  const camera = new THREE.PerspectiveCamera(66, 2, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x3a4a2a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1cf, 1.7);
  sun.position.set(10, 18, 6); sun.castShadow = true; scene.add(sun);

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x6da34c, roughness: 0.95 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e7ea6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 0.85 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const ground = new THREE.Group(); scene.add(ground);
  const RIVER_X = 0; // river runs along z at x in [-1.5..1.5]
  for (let gx = -12; gx <= 12; gx++) for (let gz = -10; gz <= 10; gz++) {
    const isRiver = Math.abs(gx) <= 1;
    const m = new THREE.Mesh(box, isRiver ? waterMat : (Math.random() < 0.82 ? grassMat : dirtMat));
    m.position.set(gx, isRiver ? -0.55 : 0, gz); m.receiveShadow = true; ground.add(m);
  }
  // bridge ghost slots (5 across the river at z=0)
  const slots = [];
  for (let gx = -1; gx <= 1; gx++) {
    const ghost = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xf4d58a, transparent: true, opacity: 0.35, roughness: 0.6 }));
    ghost.position.set(gx, 0.06, 0); ghost.name = `slot-${gx + 1}`; scene.add(ghost); slots.push(ghost);
  }
  // far-bank flag
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 10), woodMat);
  pole.position.set(4.5, 1.7, 0); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xd84f35, roughness: 0.7 }));
  flag.position.set(5.1, 3.05, 0); scene.add(flag);

  T = { renderer, scene, camera, ray: new THREE.Raycaster(), blocks: [], slots, yaw: -0.4, pitch: -0.32, keys: {}, pos: new THREE.Vector3(-8, 2.2, 5) };
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize(); window.addEventListener("resize", resize);
  let px = null, py = null;
  canvas.addEventListener("pointerdown", (e) => { px = e.clientX; py = e.clientY; });
  window.addEventListener("pointerup", () => { px = null; });
  canvas.addEventListener("pointermove", (e) => { if (px === null) return; T.yaw -= (e.clientX - px) * 0.005; T.pitch = Math.max(-1, Math.min(0.4, T.pitch - (e.clientY - py) * 0.004)); px = e.clientX; py = e.clientY; });
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    T.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)), camera);
    onTap();
  });
  window.addEventListener("keydown", (e) => { T.keys[e.code] = true; if (e.code === "KeyB") toggleMode(); });
  window.addEventListener("keyup", (e) => { T.keys[e.code] = false; });
  const pad = $("#touchPad"); if (pad) { pad.hidden = false; pad.querySelectorAll("[data-k]").forEach((b) => { b.addEventListener("pointerdown", (e) => { e.preventDefault(); T.keys[b.dataset.k] = true; }); b.addEventListener("pointerup", () => { T.keys[b.dataset.k] = false; }); b.addEventListener("pointerleave", () => { T.keys[b.dataset.k] = false; }); }); }
  renderer.setAnimationLoop(step);
}

function step(t) {
  if (!T) return;
  const sp = 0.09;
  const fwd = new THREE.Vector3(-Math.sin(T.yaw), 0, -Math.cos(T.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  if (T.keys.KeyW || T.keys.ArrowUp) T.pos.addScaledVector(fwd, sp);
  if (T.keys.KeyS || T.keys.ArrowDown) T.pos.addScaledVector(fwd, -sp);
  if (T.keys.KeyA || T.keys.ArrowLeft) T.pos.addScaledVector(right, -sp);
  if (T.keys.KeyD || T.keys.ArrowRight) T.pos.addScaledVector(right, sp);
  T.pos.x = Math.max(-11.5, Math.min(11.5, T.pos.x));
  T.pos.z = Math.max(-9.5, Math.min(9.5, T.pos.z));
  // river blocks walking unless on bridge row
  if (Math.abs(T.pos.x) < 1.6 && !(craft?.placed >= 3)) T.pos.x += T.pos.x < 0 ? -sp : sp; // river is a wall until 3 spans exist — no free crossing
  T.camera.position.copy(T.pos);
  T.camera.rotation.set(T.pitch, T.yaw, 0, "YXZ");
  T.blocks.forEach((b, i) => { b.group.position.y = 0.55 + Math.sin(t * 0.0016 + i * 1.9) * 0.06; });
  if (craft && !craft.done && T.pos.x > 3.4 && Math.abs(T.pos.z) < 1.6 && craft.placed >= 3) finishCraft();
  T.renderer.render(T.scene, T.camera);
}

function spawnBlocks() {
  for (const b of T.blocks) T.scene.remove(b.group);
  T.blocks = [];
  const target = craft.target;
  const wrongs = shuffle(concepts.filter((c) => c.conceptId !== target.conceptId)).slice(0, 4);
  const defs = [
    ...Array.from({ length: 5 }, () => ({ label: tgt(target), gold: true })),
    ...wrongs.map((c) => ({ label: tgt(c), gold: false })),
  ];
  shuffle(defs).forEach((d, i) => {
    const { tex, ltex } = blockTexture(d.label, d.gold ? "#8fc45f" : "#c9cfb8");
    const g = new THREE.Group();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    cube.castShadow = true; cube.name = `block-${i}`; g.add(cube);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true }));
    sp.scale.set(2.1, 0.52, 1); sp.position.y = 0.95; g.add(sp);
    const col = (i % 5) - 2, row = Math.floor(i / 5);
    g.position.set(-7 + col * 1.7 + (Math.random() * 0.7 - 0.35), 0.55, -4 + row * 3.4);
    if (Math.abs(g.position.x) < 2.2) g.position.x -= 4.5; // keep the river clear
    T.scene.add(g);
    T.blocks.push({ group: g, cube, gold: d.gold, mined: false });
  });
}

function startCraft() {
  if (!T) { startFlat(); return; }
  const target = concepts[Math.floor(Math.random() * concepts.length)];
  craft = { target, mined: 0, placed: 0, mode: "mine", done: false, wrongMines: 0 };
  T.slots.forEach((s) => { s.material.opacity = 0.35; });
  // clear previously placed planks
  T.scene.children.filter((o) => o.name === "plank").slice().forEach((o) => T.scene.remove(o));
  spawnBlocks();
  $("#lobby").hidden = true; $("#endPanel").hidden = true; $("#hud").hidden = false; $("#crosshair").hidden = false;
  hud();
}
function hud() {
  $("#hudPrompt").textContent = `Bridge needs: “${craft.target.terms.en.term}” → “${tgt(craft.target)}”`;
  $("#hudInv").textContent = `Mined true ${craft.mined}`;
  $("#hudBridge").textContent = `Bridge ${craft.placed}/3 spans`;
  $("#hudMode").textContent = craft.mode === "mine" ? "MINE (click true blocks)" : "BUILD (click gold slots)";
}
function toggleMode() { if (!craft || craft.done) return; craft.mode = craft.mode === "mine" ? "build" : "mine"; hud(); }

function onTap() {
  if (!craft || craft.done) return;
  if (craft.mode === "mine") {
    const hits = T.ray.intersectObjects(T.blocks.filter((b) => !b.mined).map((b) => b.cube));
    if (!hits.length) return;
    const b = T.blocks.find((x) => x.cube === hits[0].object);
    b.mined = true; T.scene.remove(b.group);
    if (b.gold) {
      craft.mined++;
      engine.recordEvidence({ conceptId: craft.target.conceptId, areaId: craft.target.areaIds[0], gameId: "vocab-craft", activityType: "bilingual", stage: 2, languageDirection: `en->${targetLang}`, correct: true, score: 1, responseSummary: "VocabCraft mined a true block" });
      if (craft.mined >= 3 && craft.mode === "mine") { craft.mode = "build"; }
    } else {
      craft.wrongMines++;
      engine.recordEvidence({ conceptId: craft.target.conceptId, areaId: craft.target.areaIds[0], gameId: "vocab-craft", activityType: "bilingual", stage: 2, languageDirection: `en->${targetLang}`, correct: false, score: 0.1, responseSummary: "VocabCraft mined a neighbor block (crumbled)" });
      showError("That block was a neighbor — it crumbles at the bank. The bridge only trusts true equivalents.");
      setTimeout(() => { $("#errOverlay").hidden = true; }, 2200);
    }
  } else {
    const hits = T.ray.intersectObjects(T.slots);
    if (!hits.length || craft.mined <= 0) return;
    const slot = hits[0].object;
    if (slot.material.opacity > 0.9) return;
    craft.mined--; craft.placed++;
    slot.material.opacity = 1;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 1), new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 0.85 }));
    plank.position.set(slot.position.x, 0.22, slot.position.z); plank.name = "plank"; T.scene.add(plank);
    engine.recordEvidence({ conceptId: craft.target.conceptId, areaId: craft.target.areaIds[0], gameId: "vocab-craft", activityType: "contextual-usage", stage: 5, languageDirection: `en->${targetLang}`, correct: true, score: 1, responseSummary: `VocabCraft laid span ${craft.placed}` });
    if (craft.placed < 3 && craft.mined <= 0) craft.mode = "mine";
  }
  syncBadge(); hud();
}


function startFlat() {
  const target = concepts[Math.floor(Math.random() * concepts.length)];
  craft = { target, mined: 0, placed: 0, mode: "mine", done: false, wrongMines: 0, flat: true };
  $("#lobby").hidden = true; $("#endPanel").hidden = true; $("#hud").hidden = false;
  const stage = $("#stage");
  let panel = document.querySelector("#flatPanel");
  if (!panel) { panel = document.createElement("section"); panel.id = "flatPanel"; panel.className = "panel"; stage.appendChild(panel); }
  panel.hidden = false;
  const wrongs = shuffle(concepts.filter((c) => c.conceptId !== target.conceptId)).slice(0, 4);
  const blocks = shuffle([...Array.from({length:3},()=>({label:tgt(target),gold:true})), ...wrongs.map((c)=>({label:tgt(c),gold:false}))]);
  panel.innerHTML = `<h3>Mine: “${esc(target.terms.en.term)}” → “${esc(tgt(target))}”</h3><p class="hint">Tap 3 true blocks. Neighbours crumble. Then lay your spans and walk.</p><div class="flat-blocks">${blocks.map((b,i)=>`<button type="button" class="btn" data-flat="${i}" data-gold="${b.gold}">${esc(b.label)}</button>`).join("")}</div><p id="flatMsg" role="status"></p><button type="button" id="flatWalk" class="btn btn-primary" hidden>Walk across my bridge →</button>`;
  panel.querySelectorAll("[data-flat]").forEach((btn)=>btn.addEventListener("click",()=>{
    if (btn.disabled) return; btn.disabled = true;
    if (btn.dataset.gold === "true") { craft.mined++; engine.recordEvidence({ conceptId: target.conceptId, areaId: target.areaIds[0], gameId: "vocab-craft", activityType: "bilingual", stage: 2, languageDirection: `en->${targetLang}`, correct: true, score: 1, responseSummary: "VocabCraft flat mined a true block" }); }
    else { craft.wrongMines++; engine.recordEvidence({ conceptId: target.conceptId, areaId: target.areaIds[0], gameId: "vocab-craft", activityType: "bilingual", stage: 2, languageDirection: `en->${targetLang}`, correct: false, score: 0.1, responseSummary: "VocabCraft flat mined a neighbor" }); }
    craft.placed = Math.min(3, craft.mined);
    panel.querySelector("#flatMsg").textContent = `Mined true ${craft.mined}/3 · neighbours crumbled ${craft.wrongMines}`;
    hud(); syncBadge();
    if (craft.mined >= 3) panel.querySelector("#flatWalk").hidden = false;
  }));
  panel.querySelector("#flatWalk").addEventListener("click", ()=>{ panel.hidden = true; finishCraft(); });
  hud();
}

async function finishCraft() {
  craft.done = true;
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#endTitle").textContent = craft.wrongMines === 0 ? "You crossed on equivalents that held. Clean craft." : "Across — with crumbled lessons under the waterline.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Bridge concept <strong>${esc(craft.target.terms.en.term)} → ${esc(tgt(craft.target))}</strong> · Wrong mines <strong>${craft.wrongMines}</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "New valley.")}<br><span class="hint">Mining is Stage-2 retrieval with hands; laying spans is Stage-5 application you can stand on.</span>`;
  $("#endPanel").hidden = false; $("#crosshair").hidden = true;
  syncBadge();
}

boot().catch((e) => { showError(`Valley failed (${e.message}).`); $("#startBtn").disabled = true; });
