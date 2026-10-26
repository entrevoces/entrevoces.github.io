// Lingua Lab VR — immersive ES→EN carrying trial (three.js, WebXR-ready)
// Form first: slate lab, server monoliths, a faceted prompt crystal, stone
// pedestals. Gaze/click the true English shard. Flat fallback runs the same
// trial with the same evidence when WebGL/CDN is unavailable.
import * as core from "../../../packages/engine-core/index.js";
import { EngineClient } from "../../../packages/engine-client/engine-client.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let engine, concepts = [], targetLang = "es", THREE = null, three = null;
let lab = null; // { order, i, score, hearts, answered }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function hubHref() { const p = new URLSearchParams(location.search); return `../../hub/?domain=${encodeURIComponent(engine?.domainId || p.get("domain") || "ai-technology")}&learner=${encodeURIComponent(engine?.learnerId || p.get("learner") || "")}&engine=${encodeURIComponent(engine?.engineUrl || p.get("engine") || "")}`; }
function syncBadge() { const st = engine.status(); const b = $("#syncBadge"); b.textContent = st.online ? `Synced · ${st.pending} pending` : `Local-only · ${st.pending} queued`; b.className = `pill ${st.online ? "pill-on" : "pill-local"}`; $("#hubLink").href = hubHref(); $("#endHubLink").href = hubHref(); }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function showError(msg) { const o = $("#errOverlay"); o.hidden = false; o.textContent = msg; }

function trials() {
  // ES→EN for ai-technology (terms.es is the prompt); other worlds run EN→target.
  const isAI = engine.domainId === "ai-technology";
  return shuffle(concepts).slice(0, 6).map((c) => {
    const prompt = isAI ? (c.terms.es?.term || c.terms.en.term) : c.terms.en.term;
    const answer = isAI ? c.terms.en.term : (c.terms[targetLang]?.term || c.terms.es.term);
    const pool = concepts.filter((x) => x.conceptId !== c.conceptId).map((x) => isAI ? x.terms.en.term : (x.terms[targetLang]?.term || x.terms.es.term));
    return { concept: c, prompt, answer, options: shuffle([answer, ...shuffle(pool).slice(0, 3)]), isAI };
  });
}

async function boot() {
  const p = new URLSearchParams(location.search);
  targetLang = p.get("lang") || localStorage.getItem("ev:targetLang") || "es";
  let fb = core.CONCEPTS; try { const r = await fetch("concepts-subset.json"); if (r.ok) fb = await r.json(); } catch {}
  const domainId = p.get("domain") || localStorage.getItem("ev:domainId") || "ai-technology";
  engine = new EngineClient({ engineUrl: p.get("engine") || localStorage.getItem("ev:engineUrl") || "http://127.0.0.1:8787", learnerId: p.get("learner") || "", domainId, core, fallbackDomain: core.SEED_DOMAINS.find((d) => d.domainId === domainId) || core.AI_TECHNOLOGY, fallbackConcepts: fb });
  await engine.init();
  concepts = await engine.listConcepts(engine.domainId);
  if (!concepts.length) concepts = fb.filter((c) => c.domainId === engine.domainId);
  syncBadge();
  const dom = await engine.getDomain(engine.domainId);
  $("#titleContext").textContent = `${dom?.label.en || engine.domainId} · ${concepts.length} terms in orbit · ${engine.domainId === "ai-technology" ? "Español → English" : "English → target"}. Three cracked lights end the trial.`;
  $("#startBtn").addEventListener("click", startLab);
  $("#againBtn").addEventListener("click", startLab);
  $("#vrBtn").addEventListener("click", enterVR);
  try {
    THREE = await import("three");
    await buildScene();
  } catch (e) {
    showError("3D library could not load here — flat mode below runs the identical trial.");
    $("#fallback2d").hidden = false;
  }
}

// ---------- three.js scene (forms, materials, light — then motion) ----------
async function buildScene() {
  const canvas = $("#gl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d2a30);
  scene.fog = new THREE.Fog(0x1d2a30, 9, 22);
  const camera = new THREE.PerspectiveCamera(68, 2, 0.1, 60);
  camera.position.set(0, 1.65, 4.6);
  scene.add(new THREE.HemisphereLight(0xd8ecec, 0x2a2118, 0.85));
  const sun = new THREE.DirectionalLight(0xffe3b3, 1.6);
  sun.position.set(4, 7, 3); sun.castShadow = true; scene.add(sun);
  const PMREM = (await import("three/addons/environments/RoomEnvironment.js")).RoomEnvironment;
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new PMREM(), 0.04).texture;

  const ink = new THREE.MeshStandardMaterial({ color: 0x2e3f47, roughness: 0.55, metalness: 0.25 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.32, metalness: 0.9 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x465e68, roughness: 0.7, metalness: 0.15 });
  const tealGlow = new THREE.MeshStandardMaterial({ color: 0x1b9aaa, roughness: 0.25, metalness: 0.1, emissive: 0x0f6f7d, emissiveIntensity: 0.7 });

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.18, 48), slate);
  floor.position.y = -0.09; floor.receiveShadow = true; scene.add(floor);
  // server monoliths (rounded-feel: box + brass cap + emissive slits)
  [[-3.6, -2.4, 0.4], [3.6, -2.4, -0.4], [0, -4.4, 0]].forEach(([x, z, r]) => {
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 0.9), ink); body.castShadow = true; m.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.0), brass); cap.position.y = 1.77; m.add(cap);
    for (let i = 0; i < 4; i++) { const slit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.03), tealGlow); slit.position.set(0, 1.1 - i * 0.55, 0.47); m.add(slit); }
    m.position.set(x, 1.7, z); m.rotation.y = r; scene.add(m);
  });
  // prompt crystal (faceted octahedron on brass stem)
  const crystal = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), new THREE.MeshPhysicalMaterial({ color: 0x9fdce8, roughness: 0.12, metalness: 0, transmission: 0.35, emissive: 0x1b9aaa, emissiveIntensity: 0.35 }));
  gem.position.y = 0.55; crystal.add(gem);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 1.1, 20), brass); crystal.add(stem);
  crystal.position.set(0, 1.15, 0); scene.add(crystal);
  // pedestals + shards
  const pedestals = [];
  [[-2.2, 1.4], [-0.75, 2.1], [0.75, 2.1], [2.2, 1.4]].forEach(([x, z], i) => {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.9, 24), slate); ped.castShadow = true; g.add(ped);
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: 0.3, metalness: 0.35, emissive: 0x3a2f08, emissiveIntensity: 0.25 }));
    shard.position.y = 0.85; shard.name = `shard-${i}`; g.add(shard);
    const label = makeLabel("…"); label.position.y = 1.35; g.add(label);
    g.position.set(x, 0.45, z); scene.add(g);
    pedestals.push({ group: g, shard, label, index: i });
  });
  const promptLabel = makeLabel("…", 1.5); promptLabel.position.set(0, 3.15, 0); scene.add(promptLabel);
  // drifting motes
  const moteGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) { pos[i * 3] = (Math.random() - 0.5) * 10; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * 10; }
  moteGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0x9fdce8, size: 0.045, transparent: true, opacity: 0.7 }));
  scene.add(motes);

  three = { renderer, scene, camera, crystal, gem, pedestals, promptLabel, motes, ray: new THREE.Raycaster(), gazeStart: null, gazeTarget: null, yaw: 0, pitch: 0 };
  // WebXR controllers (platform-native): laser rays, trigger select, squeeze
  // recenters, haptic pulse on carry. Gaze remains as the hands-free path.
  three.controllers = [];
  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -6)]);
    const laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0xc9a227 }));
    laser.name = "laser"; ctrl.add(laser);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), brass);
    tip.position.set(0, 0, -0.08); ctrl.add(tip);
    ctrl.addEventListener("selectstart", () => {
      const m = new THREE.Matrix4().identity().extractRotation(ctrl.matrixWorld);
      three.ray.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
      three.ray.ray.direction.set(0, 0, -1).applyMatrix4(m);
      const hits = three.ray.intersectObjects(three.pedestals.map((p) => p.shard));
      pulse(0.4, 40);
      if (hits.length) answerShard(Number(hits[0].object.name.split("-")[1]));
    });
    ctrl.addEventListener("squeezestart", () => { three.yaw = 0; three.pitch = 0; pulse(0.7, 70); });
    scene.add(ctrl);
    three.controllers.push(ctrl);
  }
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize(); window.addEventListener("resize", resize);
  // desktop look: drag; pick: click. VR: controller/gaze via same pick().
  let dragging = false, px = 0, py = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; px = e.clientX; py = e.clientY; });
  window.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointermove", (e) => { if (!dragging) return; three.yaw -= (e.clientX - px) * 0.004; three.pitch = Math.max(-0.5, Math.min(0.6, three.pitch - (e.clientY - py) * 0.003)); px = e.clientX; py = e.clientY; });
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    pick(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  });
  renderer.setAnimationLoop((t) => {
    if (!renderer.xr.isPresenting) { camera.rotation.set(three.pitch, three.yaw, 0, "YXZ"); }
    crystal.rotation.y = t * 0.0004; gem.position.y = 0.55 + Math.sin(t * 0.0012) * 0.07;
    pedestals.forEach((p, i) => { p.shard.rotation.y = t * 0.0006 + i; p.shard.position.y = 0.85 + Math.sin(t * 0.0014 + i * 1.7) * 0.05; });
    motes.rotation.y = t * 0.00003;
    gazeTick();
    renderer.render(scene, camera);
  });
}

function makeLabel(text, scale = 1) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(1.9 * scale, 0.48 * scale, 1); sp.userData.cv = cv; sp.userData.tex = tex;
  setLabel(sp, text); return sp;
}
function setLabel(sp, text) {
  const cv = sp.userData.cv, ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(16,28,34,0.88)"; ctx.beginPath(); ctx.roundRect(6, 14, 500, 100, 18); ctx.fill();
  ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = "#fff8ea"; ctx.font = "700 44px Public Sans, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const t = text.length > 26 ? text.slice(0, 25) + "…" : text;
  ctx.fillText(t, 256, 66);
  sp.userData.tex.needsUpdate = true;
}
function pulse(intensity = 0.5, ms = 50) {
  try {
    const session = three?.renderer.xr.getSession();
    for (const src of session?.inputSources || []) {
      src.gamepad?.hapticActuators?.[0]?.pulse(intensity, ms).catch(() => {});
    }
  } catch { /* haptics are garnish */ }
}
function pick(nx, ny) {
  if (!three || !lab || lab.answered) return;
  three.ray.setFromCamera({ x: nx, y: ny }, three.camera);
  const hits = three.ray.intersectObjects(three.pedestals.map((p) => p.shard));
  if (hits.length) answerShard(Number(hits[0].object.name.split("-")[1]));
}
function gazeTick() {
  // VR gaze: center ray held ~0.9s picks (reticle shown while presenting or playing).
  if (!three?.renderer.xr.isPresenting || !lab || lab.answered) return;
  three.ray.setFromCamera({ x: 0, y: 0 }, three.camera);
  const hits = three.ray.intersectObjects(three.pedestals.map((p) => p.shard));
  const now = performance.now();
  if (!hits.length) { three.gazeStart = null; three.gazeTarget = null; return; }
  const idx = Number(hits[0].object.name.split("-")[1]);
  if (three.gazeTarget !== idx) { three.gazeTarget = idx; three.gazeStart = now; }
  else if (now - three.gazeStart > 900) { three.gazeStart = null; answerShard(idx); }
}
async function enterVR() {
  if (!three) { showError("3D is still loading — use Enter the lab, or flat mode if it fails."); return; }
  try {
    if (!navigator.xr) throw new Error("WebXR not available in this browser");
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    await three.renderer.xr.setSession(session);
    if (!lab) startLab();
  } catch (e) { showError(`VR unavailable (${e.message}). Desktop mode is the same trial — Enter the lab.`); }
}

// ---------- trial logic (shared 3D + flat) ----------
function startLab() {
  lab = { order: trials(), i: 0, score: 0, hearts: 3, answered: false, correct: 0 };
  $("#lobby").hidden = true; $("#endPanel").hidden = true; $("#hud").hidden = false;
  $("#reticle").hidden = !three?.renderer.xr.isPresenting;
  if (three) loadTrial3D(); else loadTrialFlat();
  if ($("#fallback2d").hidden === false && !three) loadTrialFlat();
  hud();
}
function hud() { $("#hudRound").textContent = `Trial ${Math.min(lab.i + 1, lab.order.length)} / ${lab.order.length}`; $("#hudScore").textContent = `Score ${lab.score}`; $("#hudHearts").textContent = `Crystal ${"●".repeat(lab.hearts)}${"○".repeat(3 - lab.hearts)}`; $("#hudPrompt").textContent = lab.order[lab.i] ? `“${lab.order[lab.i].prompt}” → ${lab.order[lab.i].isAI ? "English" : (targetLang === "zh" ? "中文" : "Español")}` : ""; }
function loadTrial3D() {
  if (three?.gem) three.gem.material.emissive.set(0x1b9aaa); // no verdict colour carries into a fresh trial
  const t = lab.order[lab.i]; lab.answered = false;
  setLabel(three.promptLabel, t.prompt);
  three.pedestals.forEach((p, i) => setLabel(p.label, t.options[i] || ""));
  hud();
}
function answerShard(i) {
  if (!lab || lab.answered) return;
  const t = lab.order[lab.i];
  judge(t.options[i] === t.answer);
}
function loadTrialFlat() {
  const t = lab.order[lab.i]; lab.answered = false;
  $("#fallback2d").hidden = false;
  $("#fbPrompt").textContent = `“${t.prompt}” → carry it into ${t.isAI ? "English" : (targetLang === "zh" ? "中文" : "Español")}:`;
  $("#fbChoices").innerHTML = t.options.map((o) => `<button type="button" class="choice-btn" data-opt="${esc(o)}">${esc(o)}</button>`).join("");
  $("#fbFeedback").textContent = "";
  document.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => judge(b.dataset.opt === t.answer)));
  hud();
}
async function judge(ok) {
  if (lab.answered) return;
  lab.answered = true;
  const t = lab.order[lab.i];
  if (ok) { lab.score += 100; lab.correct++; } else { lab.hearts--; }
  pulse(ok ? 0.8 : 0.3, ok ? 90 : 140);
  if (three) three.gem.material.emissive.set(ok ? 0x1b9aaa : 0xa63a2e);
  engine.recordEvidence({ conceptId: t.concept.conceptId, areaId: t.concept.areaIds[0], gameId: "vr-lingua-lab", activityType: "bilingual", stage: 2, languageDirection: t.isAI ? "es->en" : `en->${targetLang}`, correct: ok, score: ok ? 1 : 0.1, responseSummary: `Lingua Lab: ${t.prompt} -> ${t.answer}` });
  syncBadge(); hud();
  const fb = $("#fbFeedback"); if (fb) { fb.className = `feedback ${ok ? "good" : "bad"}`; fb.textContent = ok ? "Carried across. The crystal steadies." : `Cracked. “${t.prompt}” is “${t.answer}” — ${t.concept.distinctions?.[0]?.difference || t.concept.definition.en}`; }
  await wait(1500);
  lab.i++;
  if (lab.i >= lab.order.length || lab.hearts <= 0) { endLab(); return; }
  if (three) loadTrial3D(); else loadTrialFlat();
}
async function endLab() {
  await engine.sync().catch(() => {});
  const next = await engine.getNext(engine.domainId).catch(() => null);
  $("#hud").hidden = true; $("#reticle").hidden = true;
  $("#endTitle").textContent = lab.hearts > 0 ? "Every shard home. The lab hums in English now." : "The crystal cracked — and showed you exactly which terms to rebuild.";
  $("#endStats").innerHTML = `<p style="font-size:19px;">Carried <strong>${lab.correct}/${lab.order.length}</strong> · Score <strong>${lab.score}</strong> · Crystal <strong>${lab.hearts}/3</strong></p>`;
  $("#endExplain").innerHTML = `<strong>Engine next:</strong> ${esc(next?.rationale || "Re-enter the lab.")}<br><span class="hint">Immersion is the interface; Stage-2 evidence is the cargo. Atelier builds it slowly, Rush proves it fast.</span>`;
  $("#endPanel").hidden = false;
}

boot().catch((e) => { showError(`Lab failed (${e.message}) — flat mode runs the same trial.`); $("#fallback2d").hidden = false; });
