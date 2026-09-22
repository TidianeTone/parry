// Parry — scène three.js. La caméra regarde l'arme de l'adversaire par-dessus l'épaule du joueur.
// Écran propre (pas de filtre CRT), mais du bloom, une dalle au milieu d'une prairie sous un ciel peint, une sculpture de bois noir, des particules et des ondes de choc.
// La logique de timing ne vit pas ici : tick() ne fait que poser les corps selon l'attaque.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
const easeIn = t => t < 0 ? 0 : t > 1 ? 1 : t * t * t;
const lin = t => t < 0 ? 0 : t > 1 ? 1 : t;

// ---- poses. Clés : <joint> = rotation z (plan sagittal, le stickman regarde +x),
// <joint>_y = rotation y (balayages), x = fente, y = hauteur des hanches.
const IDLE_ARME = { brasR: .6, avantR: .35, brasR_y: 0, brasL: -.3, avantL: .2, brasL_y: 0, cuisseL: .3, tibiaL: -.2, cuisseR: -.35, tibiaR: .1, torse: .12, torse_y: 0, x: 0, y: 0 };
const IDLE_SF = { brasR: 1.0, avantR: 1.5, brasR_y: 0, brasL: .8, avantL: 1.7, brasL_y: 0, cuisseL: .35, tibiaL: -.35, cuisseR: -.3, tibiaR: .3, torse: .08, torse_y: 0, x: 0, y: -.04 };
const KO_BOSS = { brasR: 2.6, avantR: -.6, brasL: 2.4, avantL: -.4, cuisseL: .2, tibiaL: .3, cuisseR: .1, tibiaR: .2, torse: -1.5, x: -.9, y: -.75 };
const INTRO_BOSS = { brasR: 2.6, avantR: -.5, brasL: -.7, avantL: .3, torse: -.15, x: 0, y: .02 };

// Chaque animation : `arme` (position armée, tenue jusqu'à la frappe), `coup` (impact), `recul` (après un parry),
// `montee` ms pour armer, `frappe` ms de la frappe avant l'impact.
const ANIMS = {
  taille: { montee: 350, frappe: 70,
    arme: { brasR: 2.9, avantR: -.9, brasL: -.6, avantL: .3, torse: -.3, x: -.1, y: .02 },
    coup: { brasR: 1.0, avantR: .15, brasL: -.8, avantL: .4, cuisseL: .9, tibiaL: -.5, cuisseR: -.3, tibiaR: .3, torse: .5, x: .45, y: -.08 },
    recul: { brasR: 2.2, avantR: -.4, brasL: 1.4, avantL: .6, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.6, x: -.4, y: -.05 } },
  estoc: { montee: 280, frappe: 60,
    arme: { brasR: -.9, avantR: -.7, brasL: 1.1, avantL: .6, torse: -.15, torse_y: .5, x: -.15 },
    coup: { brasR: 1.6, avantR: 0, brasL: -.6, avantL: .3, cuisseL: 1.0, tibiaL: -.6, cuisseR: -.4, tibiaR: .2, torse: .35, torse_y: -.25, x: .6, y: -.12 },
    recul: { brasR: 2.0, avantR: -.6, brasL: 1.2, avantL: .8, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.6, x: -.4, y: -.05 } },
  balayage: { montee: 380, frappe: 85,
    arme: { brasR: 1.45, avantR: .2, brasR_y: 1.5, brasL: .2, avantL: .6, torse: .05, torse_y: .9, x: -.1 },
    coup: { brasR: 1.5, avantR: .1, brasR_y: -1.3, brasL: -.5, avantL: .4, cuisseL: .7, tibiaL: -.4, cuisseR: -.3, tibiaR: .2, torse: .3, torse_y: -.9, x: .35, y: -.06 },
    recul: { brasR: 2.1, avantR: -.3, brasR_y: -.4, brasL: 1.3, avantL: .7, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.6, torse_y: -.3, x: -.4 } },
  ecrasement: { montee: 420, frappe: 95,
    arme: { brasR: 3.0, avantR: -.3, brasL: 3.0, avantL: -.3, torse: -.35, x: -.1, y: .05 },
    coup: { brasR: 1.1, avantR: .3, brasL: 1.1, avantL: .3, cuisseL: 1.1, tibiaL: -1.0, cuisseR: -.2, tibiaR: .5, torse: .7, x: .4, y: -.25 },
    recul: { brasR: 2.4, avantR: -.5, brasL: 2.4, avantL: -.5, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.65, x: -.45, y: -.05 } },
  faux: { montee: 400, frappe: 110,
    arme: { brasR: -.6, avantR: -.2, brasR_y: .9, brasL: .4, avantL: .5, torse: .2, torse_y: .6, x: -.1, y: -.03 },
    coup: { brasR: 1.9, avantR: .1, brasR_y: -.8, brasL: -.6, avantL: .4, cuisseL: .8, tibiaL: -.5, cuisseR: -.3, tibiaR: .2, torse: -.1, torse_y: -.6, x: .3, y: -.06 },
    recul: { brasR: 2.3, avantR: -.4, brasR_y: -.2, brasL: 1.3, avantL: .7, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.6, x: -.4 } },
  tir: { montee: 300, frappe: 40,
    arme: { brasR: 1.5, avantR: 0, brasL: 1.5, avantL: 0, brasL_y: -.25, cuisseL: .3, tibiaL: -.2, cuisseR: -.3, tibiaR: .1, torse: .1, x: 0, y: -.02 },
    coup: { brasR: 1.3, avantR: .15, brasL: 1.3, avantL: .15, brasL_y: -.25, torse: -.08, x: -.06, y: -.02 },
    recul: { brasR: 2.0, avantR: -.4, brasL: 1.7, avantL: .3, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.55, x: -.4 } },
  bouclier: { montee: 300, frappe: 70,
    arme: { brasL: .8, avantL: 1.2, brasR: -.5, avantR: .3, torse: -.2, torse_y: -.4, x: -.15 },
    coup: { brasL: 1.4, avantL: .6, brasR: -.8, avantR: .4, cuisseL: 1.0, tibiaL: -.6, cuisseR: -.4, tibiaR: .2, torse: .5, torse_y: .3, x: .7, y: -.1 },
    recul: { brasL: 1.6, avantL: .9, brasR: 1.2, avantR: .5, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.6, x: -.4 } },
  // Street Fighter : de la garde à l'impact en ligne droite sur tout le préavis.
  poing: { lineaire: true, coup: { brasR: 1.55, avantR: 0, brasL: .6, avantL: 1.6, cuisseL: .8, tibiaL: -.5, cuisseR: -.2, tibiaR: .2, torse: .3, x: .55, y: -.06 },
    recul: { brasR: 2.0, avantR: .8, brasL: 1.8, avantL: 1.0, cuisseL: -.2, tibiaL: .1, cuisseR: .6, tibiaR: -.5, torse: -.55, x: -.45, y: -.06 } },
  pied: { lineaire: true, coup: { brasR: .6, avantR: 1.4, brasL: -.5, avantL: 1.0, cuisseR: 1.5, tibiaR: 0, cuisseL: .1, tibiaL: -.1, torse: -.2, x: .35, y: 0 },
    recul: { brasR: 2.0, avantR: .8, brasL: 1.8, avantL: 1.0, cuisseL: -.2, tibiaL: .1, cuisseR: .6, tibiaR: -.5, torse: -.55, x: -.45, y: -.06 } },
  di: { lineaire: true, coup: { brasR: 1.6, avantR: .1, brasL: 1.6, avantL: .1, cuisseL: .9, tibiaL: -.6, cuisseR: -.3, tibiaR: .3, torse: .45, x: .8, y: -.1 },
    recul: { brasR: 2.0, avantR: .8, brasL: 1.8, avantL: 1.0, cuisseL: -.2, tibiaL: .1, cuisseR: .6, tibiaR: -.5, torse: -.55, x: -.45, y: -.06 } },
  hado: { lineaire: true, coup: { brasR: 1.5, avantR: .2, brasL: 1.5, avantL: .2, cuisseL: .5, tibiaL: -.4, cuisseR: -.4, tibiaR: .3, torse: .25, x: .1, y: -.08 },
    recul: { brasR: 2.0, avantR: .8, brasL: 1.8, avantL: 1.0, cuisseL: -.2, tibiaL: .1, cuisseR: .6, tibiaR: -.5, torse: -.55, x: -.45, y: -.06 } },
};

const REPOS_J_ER = { brasL: .5, avantL: 1.0, brasR: -.2, avantR: .3, cuisseL: .25, tibiaL: -.15, cuisseR: -.25, tibiaR: .1, torse: .05, x: 0, y: 0 };
const PARADE_J_ER = { brasL: .9, avantL: .7, brasR: -.6, avantR: .5, cuisseL: .5, tibiaL: -.3, cuisseR: -.3, tibiaR: .2, torse: .15, x: .12, y: -.03 };
const REPOS_J_SF = { brasL: 1.0, avantL: 1.6, brasR: .9, avantR: 1.7, cuisseL: .3, tibiaL: -.3, cuisseR: -.3, tibiaR: .3, torse: .08, x: 0, y: -.04 };
const PARADE_J_SF = { brasL: 1.5, avantL: .3, brasR: 1.4, avantR: .4, cuisseL: .5, tibiaL: -.4, cuisseR: -.3, tibiaR: .3, torse: .2, x: .1, y: -.06 };
const TOUCHE_J = { brasL: -.2, avantL: .6, brasR: .8, avantR: .4, cuisseL: .1, tibiaL: -.1, cuisseR: -.6, tibiaR: .5, torse: -.55, x: -.35, y: -.05 };

function melange(a, b, t) {
  const p = {};
  for (const k of Object.keys(a)) p[k] = a[k] + ((b[k] == null ? a[k] : b[k]) - a[k]) * t;
  return p;
}
const complet = (base, p) => Object.assign({}, base, p);

function membre(L, r, mat) {
  const g = new THREE.CylinderGeometry(r, r * .85, L, 12);
  g.translate(0, -L / 2, 0); // pend depuis l'origine du groupe
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}

function stickman(mat, matAccent) {
  const groupe = new THREE.Group();
  const racine = new THREE.Group(); groupe.add(racine);
  const hanches = new THREE.Group(); hanches.position.y = .95; racine.add(hanches);
  const torse = new THREE.Group(); hanches.add(torse);
  const tm = membre(.55, .065, mat); tm.rotation.z = Math.PI; torse.add(tm);
  torse.add(new THREE.Mesh(new THREE.SphereGeometry(.085, 14, 12), mat));
  const epaules = new THREE.Group(); epaules.position.y = .55; torse.add(epaules);
  epaules.add(new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), mat));
  const tete = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 16), mat); tete.position.y = .2; tete.castShadow = true; epaules.add(tete);
  // deux yeux qui luisent, tournés vers +x
  const yeux = [];
  for (const dz of [-.05, .05]) { const o = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), matAccent); o.position.set(.12, .03, dz); tete.add(o); yeux.push(o); }
  const j = { torse, hanches, racine, tete };
  for (const [nom, sz] of [['L', .19], ['R', -.19]]) {
    const epaule = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), mat); epaule.position.set(0, 0, sz); epaules.add(epaule);
    const bras = new THREE.Group(); bras.position.set(0, 0, sz); epaules.add(bras); bras.add(membre(.3, .048, mat));
    const avant = new THREE.Group(); avant.position.y = -.3; bras.add(avant); avant.add(membre(.3, .042, mat));
    avant.add(new THREE.Mesh(new THREE.SphereGeometry(.048, 10, 8), mat));
    const main = new THREE.Group(); main.position.y = -.3; avant.add(main);
    main.add(new THREE.Mesh(new THREE.SphereGeometry(.052, 10, 8), mat));
    const cuisse = new THREE.Group(); cuisse.position.set(0, 0, sz * .6); hanches.add(cuisse); cuisse.add(membre(.47, .055, mat));
    const tibia = new THREE.Group(); tibia.position.y = -.47; cuisse.add(tibia); tibia.add(membre(.48, .048, mat));
    tibia.add(new THREE.Mesh(new THREE.SphereGeometry(.052, 10, 8), mat));
    j['bras' + nom] = bras; j['avant' + nom] = avant; j['main' + nom] = main; j['cuisse' + nom] = cuisse; j['tibia' + nom] = tibia;
  }
  function poser(p) {
    for (const k in p) {
      if (k === 'x') racine.position.x = p[k];
      else if (k === 'y') hanches.position.y = .95 + p[k];
      else if (k.endsWith('_y')) { const o = j[k.slice(0, -2)]; if (o) o.rotation.y = p[k]; }
      else if (j[k]) j[k].rotation.z = p[k];
    }
  }
  return { groupe, j, poser, yeux };
}

// ---- armes : toutes procédurales, tenues dans la main droite, la longueur suit -y (le prolongement de l'avant-bras)
function fabriquerArmes(matMetal, matBois) {
  const boite = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; };
  const manche = (L, r, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), matBois); m.position.y = y != null ? y : -L / 2; m.castShadow = true; return m; };
  const armes = {};
  const faire = (nom, pointe, ...pieces) => { const g = new THREE.Group(); pieces.forEach(p => g.add(p)); g.userData.pointe = pointe; g.visible = false; armes[nom] = g; };

  faire('epee', new THREE.Vector3(0, -1.1, 0), boite(.05, 1.1, .015, matMetal, 0, -.55), boite(.2, .03, .05, matMetal, 0, 0));
  faire('katana', new THREE.Vector3(.06, -1.05, 0), (() => { const b = boite(.035, 1.05, .012, matMetal, .03, -.52); b.rotation.z = -.06; return b; })(), boite(.1, .02, .1, matMetal, 0, 0));
  faire('dague', new THREE.Vector3(0, -.5, 0), boite(.04, .5, .012, matMetal, 0, -.25), boite(.14, .025, .04, matMetal, 0, 0));
  faire('canne', new THREE.Vector3(0, -1.3, 0), manche(1.3, .02), (() => { const s = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), matMetal); s.position.y = .02; return s; })());
  faire('hache', new THREE.Vector3(.2, -1.0, 0), manche(1.05, .022), boite(.36, .24, .03, matMetal, .16, -.88));
  faire('hallebarde', new THREE.Vector3(0, -1.85, 0), manche(1.7, .02), boite(.3, .3, .025, matMetal, .16, -1.45),
    (() => { const c = new THREE.Mesh(new THREE.ConeGeometry(.04, .3, 8), matMetal); c.rotation.z = Math.PI; c.position.y = -1.7; return c; })());
  faire('marteau', new THREE.Vector3(0, -1.2, 0), manche(1.1, .025), boite(.28, .28, .42, matMetal, 0, -1.05));
  faire('faux', new THREE.Vector3(.55, -1.75, 0), manche(1.6, .02),
    (() => { const t = new THREE.Mesh(new THREE.TorusGeometry(.42, .018, 8, 20, Math.PI * .85), matMetal); t.position.set(.42, -1.55, 0); t.rotation.z = Math.PI * .55; t.castShadow = true; return t; })());
  faire('ak47', new THREE.Vector3(0, -.85, 0), boite(.05, .8, .07, matMetal, 0, -.42), boite(.04, .28, .05, matBois, 0, .18, 0),
    boite(.04, .22, .03, matMetal, .06, -.3), manche(.35, .012, -.62), boite(.06, .3, .05, matBois, 0, -.55, 0));
  return armes;
}

// Texture radiale pour les lueurs (générée, pas de fichier).
function textureLueur() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function creerScene(canvas, coupNom, flash) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#c9d6d2', .03);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const camera = new THREE.PerspectiveCamera(50, 900 / 420, .1, 80);
  // Par-dessus l'épaule du joueur : seul son bouclier reste au premier plan, l'adversaire plein cadre.
  const camBase = new THREE.Vector3(-1.3, 1.7, 1.6), viseBase = new THREE.Vector3(1.0, 1.4, -.15);
  const vise = viseBase.clone();

  // ---- post-traitement : rendu, bloom, sortie (tone mapping + sRGB)
  // rendu → occlusion ambiante (GTAO) → profondeur de champ sur l'arme → bloom → vignette + aberration → sortie → SMAA
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 900, 420); gtao.output = GTAOPass.OUTPUT.Default;
  gtao.updateGtaoMaterial({ radius: .35, distanceExponent: 1.2, thickness: .6, scale: 1.2, samples: 12, distanceFallOff: 1 });
  composer.addPass(gtao);
  const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: .0009, maxblur: .006 });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(900, 420), .45, .5, .92);
  composer.addPass(bloom);
  const cinema = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, vignette: { value: .38 }, aberration: { value: .0022 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float aberration; varying vec2 vUv;
      void main(){ vec2 d = vUv - .5; float r2 = dot(d, d);
        vec2 off = d * aberration * (1.0 + r2 * 6.0);
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        c *= 1.0 - vignette * smoothstep(.15, .85, r2 * 2.2);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  composer.addPass(cinema);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(900, 420); composer.addPass(smaa);

  // ---- lumières : plein jour voilé, un soleil chaud, le ciel bleu-vert en rebond
  const hemi = new THREE.HemisphereLight('#c2d6dc', '#7d9a5c', .9); scene.add(hemi);
  const cle = new THREE.DirectionalLight('#fff4d6', 2.2); cle.position.set(4, 8, 3);
  cle.castShadow = true; cle.shadow.mapSize.set(2048, 2048); cle.shadow.bias = -.0005;
  Object.assign(cle.shadow.camera, { left: -6, right: 6, top: 7, bottom: -4, near: 1, far: 24 });
  scene.add(cle);
  const contre = new THREE.PointLight('#e368a8', 4, 12, 1.6); contre.position.set(2.6, 2.4, -2.2); scene.add(contre);
  const lueurArme = new THREE.PointLight('#d9a441', 0, 3.5, 1.8); scene.add(lueurArme);
  const eclatImpact = new THREE.PointLight('#fffdf2', 0, 6, 1.5); scene.add(eclatImpact);

  // ---- ciel : le panorama peint (art/panorama.webp, Recraft) sur un cylindre, en miroir pour boucler sans couture
  const texPano = new THREE.TextureLoader().load('art/panorama.webp');
  texPano.colorSpace = THREE.SRGBColorSpace; texPano.wrapS = THREE.MirroredRepeatWrapping; texPano.repeat.set(2, 1);
  const matCiel = new THREE.MeshBasicMaterial({ map: texPano, side: THREE.BackSide, fog: false, depthWrite: false });
  const ciel = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 36, 64, 1, true), matCiel);
  ciel.position.y = 1.5 - .12 * 36 + 18; // l'horizon de l'image (12 % du bas) au niveau des yeux
  scene.add(ciel);
  // reflets du ciel peint sur le métal : le panorama devient aussi la carte d'environnement
  texPano.mapping = THREE.EquirectangularReflectionMapping;
  new THREE.TextureLoader().load('art/panorama.webp', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.environment = pmrem.fromEquirectangular(t).texture; });
  // le soleil : une source hors champ avec un lens flare qui traverse l'image quand la caméra bouge
  const texFlare = (teinte, doux) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, teinte); r.addColorStop(doux, teinte.replace(')', ',.35)').replace('rgb(', 'rgba(')); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(texFlare('rgb(255,244,214)', .12), 420, 0));
  flare.addElement(new LensflareElement(texFlare('rgb(255,200,120)', .6), 60, .55));
  flare.addElement(new LensflareElement(texFlare('rgb(227,104,168)', .7), 90, .75));
  flare.addElement(new LensflareElement(texFlare('rgb(155,92,240)', .7), 130, .95));
  flare.addElement(new LensflareElement(texFlare('rgb(255,244,214)', .8), 50, 1.1));
  const soleil = new THREE.Object3D(); soleil.position.set(26, 40, 18); soleil.add(flare); scene.add(soleil);
  // ombres de nuages qui glissent sur la plaine
  const texNuages = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 30 + Math.random() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,120,130,.55)'); gr.addColorStop(1, 'rgba(120,120,130,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; })();
  const nuages = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshBasicMaterial({ map: texNuages, transparent: true, blending: THREE.MultiplyBlending, depthWrite: false }));
  nuages.rotation.x = -Math.PI / 2; nuages.position.y = .5; nuages.renderOrder = 2; scene.add(nuages);
  const matVoute = new THREE.MeshBasicMaterial({ color: '#254a56', side: THREE.BackSide, fog: false, depthWrite: false });
  const voute = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12), matVoute); voute.renderOrder = -1; scene.add(voute);

  // ---- prairie : sol herbeux à perte de vue, brins instanciés qui ondulent, dalle de pierre au centre
  const texHerbe = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#8faa6b'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.strokeStyle = `hsl(${88 + Math.random() * 20}, ${30 + Math.random() * 25}%, ${38 + Math.random() * 26}%)`; g.lineWidth = 1 + Math.random(); const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 6, y - 4 - Math.random() * 8); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); return t;
  })();
  const matPrairie = new THREE.MeshStandardMaterial({ map: texHerbe, color: '#c9d6a8', roughness: 1 });
  const solLoin = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), matPrairie);
  solLoin.rotation.x = -Math.PI / 2; solLoin.position.y = -.02; solLoin.receiveShadow = true; scene.add(solLoin);
  const NH = 9000, geoBrin = new THREE.PlaneGeometry(.05, .45, 1, 3); geoBrin.translate(0, .225, 0);
  const matHerbe = new THREE.MeshLambertMaterial({ color: '#c2cf9c', side: THREE.DoubleSide });
  const uTemps = { value: 0 };
  matHerbe.onBeforeCompile = sh => {
    sh.uniforms.uTemps = uTemps;
    sh.vertexShader = 'uniform float uTemps;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float hk = position.y / .45; hk *= hk;
      float onde = sin(uTemps * 1.4 + instanceMatrix[3][0] * .6 + instanceMatrix[3][2] * .8) + .4 * sin(uTemps * 3.1 + instanceMatrix[3][2] * 2.3);
      transformed.x += onde * .16 * hk; transformed.z += onde * .07 * hk;`);
  };
  const herbe = new THREE.InstancedMesh(geoBrin, matHerbe, NH);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < NH; i++) {
      const ang = Math.random() * Math.PI * 2, r = 3.6 + Math.pow(Math.random(), .6) * 20;
      v.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); e.set((Math.random() - .5) * .5, Math.random() * Math.PI, (Math.random() - .5) * .5); q.setFromEuler(e);
      const k = .6 + Math.random() * .7; sc.set(k, k * (.8 + Math.min(1, (r - 3.6) / 10) * .6), k);
      herbe.setMatrixAt(i, m.compose(v, q, sc)); herbe.setColorAt(i, col.setHSL(.2 + Math.random() * .06, .22 + Math.random() * .18, .6 + Math.random() * .22));
    }
    herbe.castShadow = false; herbe.receiveShadow = true; scene.add(herbe); }
  const matSol = new THREE.MeshStandardMaterial({ color: '#8c867c', roughness: .85, metalness: 0 });
  const sol = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, .16, 64), matSol); sol.position.y = .06; sol.receiveShadow = true; sol.castShadow = true; scene.add(sol);
  const matAnneau = new THREE.MeshBasicMaterial({ color: '#d9a441', transparent: true, opacity: .8, side: THREE.DoubleSide });
  const arene = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.4, 96), matAnneau); arene.rotation.x = -Math.PI / 2; arene.position.y = .15; scene.add(arene);
  const arene2 = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.58, 96), matAnneau); arene2.rotation.x = -Math.PI / 2; arene2.position.y = .15; scene.add(arene2);
  // les corps posent sur la dalle
  const HAUT_DALLE = .14;

  // ---- la sculpture : un bois mort noir, tordu, qui monte en griffe (comme le tableau)
  const matBoisNoir = new THREE.MeshPhysicalMaterial({ color: '#0d0f14', roughness: .45, metalness: .1, clearcoat: 1, clearcoatRoughness: .25, envMapIntensity: 1.1 });
  function tube(pts, r0, r1) {
    const curve = new THREE.CatmullRomCurve3(pts), n = 26, seg = 8, fr = curve.computeFrenetFrames(n, false), pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t), r = (r0 + (r1 - r0) * t) * (.85 + .3 * Math.abs(Math.sin(t * 19 + r0 * 50))), N = fr.normals[i], B = fr.binormals[i];
      for (let j = 0; j < seg; j++) { const a = j / seg * Math.PI * 2; pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, matBoisNoir); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function sculpture(graine) {
    let sd = graine; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const g = new THREE.Group(), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const tronc = [V(-.9, 0, .3), V(-.2, .25, .1), V(.5, .7, -.1), V(1.1, 1.5, .05), V(1.6, 2.5, -.05), V(1.9, 3.5, .1), V(2.0, 4.4, 0)];
    g.add(tube(tronc, .3, .05));
    const courbe = new THREE.CatmullRomCurve3(tronc);
    for (let i = 0; i < 9; i++) {
      const t = .15 + rnd() * .75, o = courbe.getPoint(t), dir = V(rnd() - .5, .3 + rnd() * .9, rnd() - .5).normalize(), L = .6 + rnd() * 1.3;
      const pts = [o.clone(), o.clone().add(dir.clone().multiplyScalar(L * .4)).add(V(0, .1, 0)), o.clone().add(dir.clone().multiplyScalar(L * .75)).add(V(rnd() * .3, .3, rnd() * .3)), o.clone().add(dir.clone().multiplyScalar(L)).add(V(-.2 + rnd() * .4, .5 + rnd() * .4, 0))];
      g.add(tube(pts, .09 + rnd() * .08, .015));
      // une ou deux épines
      for (let k = 0; k < 2; k++) { const q = pts[1 + k].clone(); g.add(tube([q, q.clone().add(V(rnd() - .5, .25 + rnd() * .3, rnd() - .5))], .035, .006)); }
    }
    return g;
  }
  const bois = sculpture(7); bois.position.set(3.2, 0, -5.4); bois.rotation.y = -.6; bois.scale.setScalar(1.15); scene.add(bois);
  const bois2 = sculpture(3); bois2.position.set(-9, 0, -14); bois2.rotation.y = 1.8; bois2.scale.setScalar(.9); scene.add(bois2);

  // ---- particules : graines et pollen qui dérivent dans le vent
  const tex = textureLueur();
  const ND = 500, dPos = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) dPos.set([(Math.random() - .5) * 14, .2 + Math.random() * 3.5, (Math.random() - .5) * 14], i * 3);
  const poussiere = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dPos, 3)),
    new THREE.PointsMaterial({ color: '#fff6d0', map: tex, size: .06, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(poussiere);

  // ---- corps
  const matJoueur = new THREE.MeshPhysicalMaterial({ color: '#f7f0c0', roughness: .45, metalness: .2, clearcoat: .6, clearcoatRoughness: .3, emissive: '#3a2a20', emissiveIntensity: .15, envMapIntensity: .8 });
  const matBoss = new THREE.MeshPhysicalMaterial({ color: '#1a1820', roughness: .42, metalness: .15, clearcoat: 1, clearcoatRoughness: .18, emissive: '#1b1322', emissiveIntensity: .35, envMapIntensity: 1.0 }); // laqué comme la sculpture
  const matYeux = new THREE.MeshStandardMaterial({ color: '#d9a441', emissive: '#d9a441', emissiveIntensity: 3 });
  const matYeuxJ = new THREE.MeshStandardMaterial({ color: '#fffdf2', emissive: '#fffdf2', emissiveIntensity: 1.2 });
  const joueur = stickman(matJoueur, matYeuxJ); joueur.groupe.position.set(-1.55, HAUT_DALLE, .7); joueur.groupe.rotation.y = .263; scene.add(joueur.groupe);
  const boss = stickman(matBoss, matYeux); boss.groupe.position.set(1.05, HAUT_DALLE, -.1); boss.groupe.rotation.y = Math.PI + .263; boss.groupe.scale.setScalar(1.1); scene.add(boss.groupe);
  // cimier et épaulières du boss : une silhouette, pas un bonhomme-allumette
  const cimier = new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 8), matBoss); cimier.position.set(-.04, .3, 0); cimier.rotation.z = .5; boss.j.tete.add(cimier);
  // casque à visière et pauldrons : une armure, pas un bonhomme
  const casque = new THREE.Mesh(new THREE.SphereGeometry(.168, 22, 14, 0, Math.PI * 2, 0, Math.PI * .58), matBoss); casque.castShadow = true; boss.j.tete.add(casque);
  const visiere = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .2), matYeux); visiere.position.set(.13, .03, 0); visiere.visible = false; boss.j.tete.add(visiere);
  for (const nom of ['brasL', 'brasR']) { const pd = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), matBoss); pd.scale.set(1, .8, 1); pd.position.y = .03; pd.castShadow = true; boss.j[nom].add(pd); }
  for (const nom of ['cuisseL', 'cuisseR']) { const g = new THREE.Mesh(new THREE.CylinderGeometry(.075, .06, .3, 10, 1, true), matBoss); g.position.y = -.2; boss.j[nom].add(g); }
  // une cape : le tiers arrière d'un cône évasé, collé au dos (-x local) ; pas un cône complet qui ferait une robe
  const geoCape = new THREE.CylinderGeometry(.16, .42, .95, 12, 4, true, 3 * Math.PI / 2 - .95, 1.9);
  const cape = new THREE.Mesh(geoCape, new THREE.MeshStandardMaterial({ color: '#2a1230', roughness: .95, side: THREE.DoubleSide }));
  cape.position.set(-.02, .06, 0); cape.rotation.z = .1; boss.j.torse.add(cape); cape.castShadow = true;

  const matArme = new THREE.MeshStandardMaterial({ color: '#d9a441', emissive: '#d9a441', emissiveIntensity: 1.2, roughness: .2, metalness: .85, envMapIntensity: 1.2 });
  const matBois = new THREE.MeshStandardMaterial({ color: '#3a2a2a', roughness: .9, metalness: 0 });
  const armes = fabriquerArmes(matArme, matBois);
  for (const g of Object.values(armes)) boss.j.mainR.add(g);
  let armeCourante = null;
  function montrerArme(nom) {
    if (armeCourante === nom) return;
    for (const [k, g] of Object.entries(armes)) g.visible = k === nom;
    armeCourante = nom;
  }
  const matBouclier = new THREE.MeshStandardMaterial({ color: '#8F5C5C', roughness: .35, metalness: .6, emissive: '#000000', envMapIntensity: 1 });
  const bouclier = new THREE.Group();
  const disque = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .035, 32), matBouclier); disque.castShadow = true; bouclier.add(disque);
  const matRebord = new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: .3, metalness: .9, emissive: '#d9a441', emissiveIntensity: .25 });
  const rebord = new THREE.Mesh(new THREE.TorusGeometry(.28, .022, 8, 40), matRebord); rebord.rotation.x = Math.PI / 2; bouclier.add(rebord);
  const umbo = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 10), matRebord); umbo.position.y = .03; bouclier.add(umbo);
  // le bouclier s'abîme : une bosse sombre par coup encaissé, réparé au round suivant
  const degats = new THREE.Group(); bouclier.add(degats);
  const matDegat = new THREE.MeshStandardMaterial({ color: '#241a1a', roughness: .9, metalness: .1 });
  function abimer() {
    if (degats.children.length >= 14) return;
    const a = Math.random() * Math.PI * 2, r = .05 + Math.random() * .2, k = .03 + Math.random() * .035;
    const d = new THREE.Mesh(new THREE.SphereGeometry(k, 8, 6), matDegat); d.scale.y = .35; d.position.set(Math.cos(a) * r, .018, Math.sin(a) * r); degats.add(d);
  }
  function reparer() { while (degats.children.length) degats.remove(degats.children[0]); }
  joueur.j.mainL.add(bouclier);
  const orbe = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), matArme); orbe.visible = false; scene.add(orbe);

  // lueurs additives sur l'arme, et le canon qui crache
  const matLueur = new THREE.SpriteMaterial({ map: tex, color: '#d9a441', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  const lueurs = Array.from({ length: 4 }, () => { const s = new THREE.Sprite(matLueur); s.scale.set(.5, .5, 1); scene.add(s); return s; });
  const matBouche = new THREE.SpriteMaterial({ map: tex, color: '#fffdf2', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  // la cible : un anneau qui se referme sur l'arme pendant tout le préavis, blanc dans la fenêtre. C'est ça qu'on regarde.
  const texAnneau = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const matCible = new THREE.SpriteMaterial({ map: texAnneau, color: '#d9a441', transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
  const cible = new THREE.Sprite(matCible); cible.renderOrder = 10; scene.add(cible);
  const bouche = new THREE.Sprite(matBouche); bouche.scale.set(.9, .9, 1); scene.add(bouche);
  const tracant = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: '#fffdf2', transparent: true, opacity: 0 }));
  scene.add(tracant);

  // traînée de l'arme : ruban entre la pointe et la garde, qui s'efface en 140 ms
  const NT = 22, tPos = new Float32Array(NT * 2 * 3), tAlpha = new Float32Array(NT * 2), tTemps = new Array(NT).fill(-1e9);
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tGeo.setAttribute('alpha', new THREE.BufferAttribute(tAlpha, 1));
  const idx = []; for (let i = 0; i < NT - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tGeo.setIndex(idx);
  const matTrainee = new THREE.ShaderMaterial({
    uniforms: { couleur: { value: new THREE.Color('#d9a441') } },
    vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 couleur; varying float vA; void main(){ gl_FragColor = vec4(couleur * 1.6, vA * 0.85); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const trainee = new THREE.Mesh(tGeo, matTrainee); scene.add(trainee);
  let tCurseur = 0;
  const vTip = new THREE.Vector3(), vBase = new THREE.Vector3(), vTmp = new THREE.Vector3(), vJoueur = new THREE.Vector3();
  function echantillonnerTrainee(now, a, b) { const i = tCurseur % NT; tCurseur++; tPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); tTemps[i] = now; }
  const p2 = new Float32Array(NT * 6);
  function majTrainee(now) {
    for (let k = 0; k < NT; k++) {
      const i = (tCurseur + k) % NT;
      p2.set(tPos.subarray(i * 6, i * 6 + 6), k * 6);
      const al = Math.max(0, 1 - (now - tTemps[i]) / 140); tAlpha[k * 2] = al; tAlpha[k * 2 + 1] = al;
    }
    tGeo.attributes.position.array.set(p2); tGeo.attributes.position.needsUpdate = true; tGeo.attributes.alpha.needsUpdate = true;
  }

  // étincelles du parry, éclats sombres du coup pris, onde de choc au sol
  const N = 110, pos = new Float32Array(N * 3), vit = [];
  const etinc = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: '#fffdf2', map: tex, size: .09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(etinc);
  const matOnde = new THREE.MeshBasicMaterial({ color: '#fffdf2', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const onde = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 64), matOnde); onde.rotation.x = -Math.PI / 2; onde.position.y = .02; scene.add(onde);
  const onde2 = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), matOnde); onde2.rotation.x = -Math.PI / 2; onde2.position.y = .025; scene.add(onde2);

  // Les effets (sprites, traînée, particules, nuages) ne doivent pas entrer dans les tampons normales/profondeur du GTAO,
  // sinon ils ressortent en quads noirs. On les cache le temps du rendu de substitution.
  const horsAO = [trainee, cible, bouche, tracant, etinc, poussiere, onde, onde2, nuages, soleil, orbe, ...lueurs];
  const renderOverrideOrig = gtao.renderOverride.bind(gtao);
  gtao.renderOverride = (...args) => { const vis = horsAO.map(o => o.visible); horsAO.forEach(o => { o.visible = false; }); renderOverrideOrig(...args); horsAO.forEach((o, i) => { o.visible = vis[i]; }); };
  let effet = { type: null, t: 0 }, gelJusqua = 0, cine = { type: null, t: 0 };
  let jeu = 'er', aveugle = false;
  const accent = new THREE.Color('#d9a441'), blanc = new THREE.Color('#fffdf2'), noir = new THREE.Color('#000000');
  function setJeu(id) {
    jeu = id;
    accent.set(id === 'er' ? '#d9a441' : '#e368a8');
    matArme.color.copy(accent); matArme.emissive.copy(accent); matRebord.color.copy(accent); matRebord.emissive.copy(accent); matLueur.color.copy(accent); matTrainee.uniforms.couleur.value.copy(accent);
    matAnneau.color.copy(accent); lueurArme.color.copy(accent); matYeux.color.copy(accent); matYeux.emissive.copy(accent);
    contre.color.set(id === 'er' ? '#f2d08a' : '#e368a8');
    bouclier.visible = id !== 'sf';
  }
  setJeu('er');
  // Aveugle : le boss n'est qu'une silhouette, seuls ses yeux et son arme éclairent.
  function setAveugle(oui) {
    aveugle = oui;
    matBoss.color.set(oui ? '#050308' : '#1a1820'); matBoss.emissive.set(oui ? '#000000' : '#1b1322'); matBoss.envMapIntensity = oui ? 0 : 1.0;
    cle.intensity = oui ? 0 : 2.2; hemi.intensity = oui ? .12 : .9; contre.intensity = oui ? 0 : 4;
    matCiel.color.set(oui ? '#12141c' : '#ffffff'); matVoute.color.set(oui ? '#06070c' : '#254a56');
    matPrairie.color.set(oui ? '#2a3024' : '#c9d6a8'); matHerbe.color.set(oui ? '#232a1e' : '#c2cf9c');
    scene.fog.color.set(oui ? '#0a0c10' : '#c9d6d2'); soleil.visible = !oui; nuages.visible = !oui;
  }

  function taille() {
    const w = canvas.clientWidth || 900, h = canvas.clientHeight || Math.round(w * 420 / 900);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w, h); gtao.setSize(w, h); smaa.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
  }

  // Pose du boss pour une attaque en cours (préavis P, temps t depuis le début).
  function poseBoss(an, idle, t, P, feinte) {
    const armee = complet(idle, an.arme || {}), coup = complet(idle, an.coup);
    if (an.lineaire) {
      if (feinte) return t < P - 120 ? melange(idle, coup, lin(t / P) * .6) : melange(melange(idle, coup, .6), idle, ease((t - (P - 120)) / 120));
      return melange(idle, coup, lin(t / P));
    }
    const montee = Math.min(an.montee, P * .6);
    if (feinte) return t < P - 120 ? melange(idle, armee, ease(t / montee)) : melange(armee, idle, ease((t - (P - 120)) / 120));
    return t < P - an.frappe ? melange(idle, armee, ease(t / montee)) : melange(armee, coup, easeIn((t - (P - an.frappe)) / an.frappe));
  }

  // etat : { attaque, aide, fenetre, armeRepos }
  function tick(now, etat) {
    taille();
    if (now < gelJusqua) return; // hit-stop : l'image reste figée
    const reel = performance.now();
    const a = etat.attaque || { phase: 'attente' };
    const enCours = a.phase === 'preavis' && !a.vide;
    const enFeinte = a.phase === 'feinte';
    const t = enCours || enFeinte ? now - a.tDebut : 0;
    const tr = a.phase === 'resolu' ? now - a.tResolu : Infinity;
    const pare = a.phase === 'resolu' && a.jugement && a.jugement.resultat === 'parry';
    const f = etat.fenetre;
    const dansFenetre = enCours && f && t >= f.ouvre && t <= f.ferme;
    const coup = a.coup || null;
    const an = ANIMS[(coup && coup.anim) || (jeu === 'sf' ? 'poing' : 'taille')] || ANIMS.taille;
    const idle = jeu === 'sf' ? IDLE_SF : IDLE_ARME;
    montrerArme(jeu === 'sf' && !(coup && coup.arme && coup.arme !== 'aucune') ? (coup && coup.arme) || etat.armeRepos || 'aucune' : (coup && coup.arme) || etat.armeRepos || 'epee');
    const tc = reel - cine.t;
    const enCine = cine.type && tc < (cine.type === 'intro' ? 2400 : 1600);

    // ---- boss
    let pb, charge = 0;
    if (enCine && cine.type === 'ko') pb = tc < 700 ? melange(complet(idle, an.recul), complet(idle, KO_BOSS), easeIn(tc / 700)) : complet(idle, KO_BOSS);
    else if (enCine && cine.type === 'intro') pb = tc < 500 ? melange(idle, complet(idle, INTRO_BOSS), ease(tc / 500)) : tc < 900 ? complet(idle, INTRO_BOSS) : melange(complet(idle, INTRO_BOSS), idle, ease((tc - 900) / 400));
    else if (enCours || enFeinte) { pb = poseBoss(an, idle, t, a.preavis, enFeinte); charge = Math.min(1, t / a.preavis); }
    else if (a.phase === 'resolu') {
      const coupP = complet(idle, an.coup), recul = complet(idle, an.recul);
      if (a.riposte) Object.assign(recul, { x: -.95, torse: -1.05, y: -.2 }); // le critique le renverse
      pb = pare ? (tr < 420 ? melange(coupP, recul, ease(tr / 420)) : melange(recul, idle, ease((tr - 420) / 330)))
        : (tr < 250 ? coupP : melange(coupP, idle, ease((tr - 250) / 400)));
    } else pb = Object.assign({}, idle, { y: idle.y + Math.sin(now / 600) * .012 });
    boss.poser(pb);
    // les yeux s'allument avec la charge, blancs pendant la fenêtre avec l'aide
    matYeux.emissiveIntensity = (enCine && cine.type === 'intro') ? 8 : 2.5 + 4 * charge + (dansFenetre && etat.aide ? 6 : 0);

    // projectile SF
    const proj = coup && coup.projectile && (enCours || (a.phase === 'resolu' && tr < 120));
    orbe.visible = !!proj;
    if (proj) { const k = enCours ? lin(t / a.preavis) : 1; orbe.position.lerpVectors(vTmp.set(.5, 1.25, .05), vJoueur.set(-.85, 1.2, .4), k); orbe.rotation.y = now * .02; }

    // ---- joueur
    const repos = jeu === 'sf' ? REPOS_J_SF : REPOS_J_ER, parade = jeu === 'sf' ? PARADE_J_SF : PARADE_J_ER;
    let pj;
    const leve = ((a.phase === 'preavis' || a.phase === 'feinte') && a.input != null) || (a.phase === 'resolu' && a.input != null && tr < 320);
    if (a.phase === 'resolu' && a.jugement && !pare) pj = tr < 110 ? melange(repos, TOUCHE_J, ease(tr / 110)) : melange(TOUCHE_J, repos, ease((tr - 110) / 500));
    else if (leve) pj = melange(repos, parade, a.phase !== 'resolu' ? ease((now - a.input) / 60) : 1);
    else pj = Object.assign({}, repos, { y: repos.y + Math.sin(now / 600 + 1) * .012 });
    joueur.poser(pj);
    matBouclier.emissive.copy(leve ? blanc : noir); matBouclier.emissiveIntensity = leve ? .5 : 0;

    // ---- l'arme : c'est elle qu'on regarde
    boss.groupe.updateMatrixWorld(true);
    const arme = armes[armeCourante];
    let pointe, base;
    if (arme) { arme.getWorldPosition(vBase); vTip.copy(arme.userData.pointe).applyMatrix4(arme.matrixWorld); pointe = vTip; base = vBase; }
    else {
      const jambe = an === ANIMS.pied;
      if (orbe.visible) pointe = orbe.position; else { (jambe ? boss.j.tibiaR : boss.j.mainR).getWorldPosition(vTip); pointe = vTip; }
      base = (jambe ? boss.j.cuisseR : boss.j.avantR).getWorldPosition(vBase);
    }
    // l'aide : l'arme chauffe à blanc pendant la fenêtre. Sans aide, elle chauffe simplement avec la charge.
    const chaud = etat.aide && dansFenetre;
    const couleurArme = chaud ? blanc : accent;
    const intensite = pare && tr < 300 ? 3.2 : chaud ? 3.0 : (enCours || enFeinte) ? .7 + 1.4 * charge : .6;
    matArme.emissive.copy(couleurArme); matArme.emissiveIntensity = intensite;
    matLueur.color.copy(couleurArme); matLueur.opacity = Math.min(1, intensite * .3);
    lueurArme.color.copy(couleurArme); lueurArme.intensity = intensite * 2.5; lueurArme.position.copy(pointe);
    lueurs.forEach((s, i) => { s.position.lerpVectors(base, pointe, i / (lueurs.length - 1)); const k = .28 + .22 * (i / 3); s.scale.set(k * (1 + intensite * .25), k * (1 + intensite * .25), 1); });
    const cibleVisible = (enCours || enFeinte) && !aveugle && a.preavis > 0;
    matCible.opacity = cibleVisible ? .55 + .45 * charge : (pare && tr < 200 ? 1 - tr / 200 : 0);
    if (cibleVisible || (pare && tr < 200)) { cible.position.copy(pointe); const k = cibleVisible ? .35 + 1.7 * Math.pow(1 - charge, 1.3) : .35 + tr / 200; cible.scale.set(k, k, 1); matCible.color.copy(chaud || pare ? blanc : accent); }
    const bouge = (enCours && t > a.preavis - (an.frappe || 90) - 20) || (a.phase === 'resolu' && tr < 80);
    if (bouge || (pare && tr < 400)) echantillonnerTrainee(now, pointe, base);
    majTrainee(now);

    // le tir : éclair au canon et traçante jusqu'au joueur, autour de l'impact
    const tirEnCours = an === ANIMS.tir && ((enCours && t > a.preavis - 30) || (a.phase === 'resolu' && tr < 70));
    matBouche.opacity = tirEnCours ? 1 : 0; tracant.material.opacity = tirEnCours ? .9 : 0;
    if (tirEnCours) {
      bouche.position.copy(pointe); bouche.scale.set(.7 + Math.random() * .5, .7 + Math.random() * .5, 1);
      joueur.j.mainL.getWorldPosition(vJoueur); if (jeu === 'sf') joueur.j.mainR.getWorldPosition(vJoueur);
      tracant.geometry.setFromPoints([pointe, vJoueur]);
    }

    // ---- ambiance : le vent dans l'herbe, le pollen qui dérive
    uTemps.value = reel / 1000;
    texNuages.offset.set(reel / 90000, reel / 130000);
    poussiere.rotation.y = reel / 60000; poussiere.position.y = Math.sin(reel / 4000) * .15; poussiere.position.x = Math.sin(reel / 9000) * .6;

    // ---- caméra : respire au repos, pousse vers l'arme pendant la garde, tremble à l'impact, orbite au K.O.
    let cam, zoom = (enCours || enFeinte) ? .12 * charge : 0;
    if (enCine && cine.type === 'ko') {
      const k = tc / 1600, ang = -.9 + k * 1.4; const cible = new THREE.Vector3(1.05 - .6, .9, -.1);
      cam = new THREE.Vector3(cible.x + Math.cos(ang) * 2.6, 1.3 - k * .4, cible.z + Math.sin(ang) * 2.6); vise.copy(cible);
    } else if (enCine && cine.type === 'intro') {
      const k = ease(tc / 2400); cam = new THREE.Vector3(1.05 + 1.8, 1.4, -.1 + 1.6).lerp(camBase, k); vise.copy(new THREE.Vector3(1.05, 1.2, -.1)).lerp(viseBase, k);
    } else {
      cam = camBase.clone().lerp(viseBase, zoom);
      cam.x += Math.sin(reel / 2600) * .04; cam.y += Math.sin(reel / 1900) * .03;
      vise.copy(viseBase).lerp(pointe, (enCours || enFeinte) ? .3 : 0);
    }
    const te = reel - effet.t;
    matOnde.opacity = 0; eclatImpact.intensity = 0;
    if (effet.type && te >= 0 && te < 420) {
      const k = 1 - te / 420, s = te / 420;
      onde.scale.setScalar(.2 + s * 3.2); onde2.scale.setScalar(.2 + s * 2.2); matOnde.opacity = k * .7;
      if (effet.type === 'parry') {
        for (let i = 0; i < N; i++) { const v = vit[i]; pos[i * 3] = v.o.x + v.d.x * s; pos[i * 3 + 1] = v.o.y + v.d.y * s - 1.8 * s * s; pos[i * 3 + 2] = v.o.z + v.d.z * s; }
        etinc.geometry.attributes.position.needsUpdate = true; etinc.material.opacity = k; etinc.material.color.copy(blanc);
        flash.style.background = `rgba(255,253,242,${k * .12})`;
        eclatImpact.intensity = 12 * k; eclatImpact.color.copy(blanc); matOnde.color.copy(blanc);
        cam.add(vTmp.set((Math.random() - .5) * .05 * k, (Math.random() - .5) * .04 * k, .14 * k));
      } else {
        for (let i = 0; i < N; i++) { const v = vit[i]; pos[i * 3] = v.o.x + v.d.x * s * .5; pos[i * 3 + 1] = v.o.y + v.d.y * s * .5 - 1.2 * s * s; pos[i * 3 + 2] = v.o.z + v.d.z * s * .5; }
        etinc.geometry.attributes.position.needsUpdate = true; etinc.material.opacity = k * .8; etinc.material.color.set('#ff5470');
        flash.style.background = `rgba(255,84,112,${k * .3})`;
        eclatImpact.intensity = 8 * k; eclatImpact.color.set('#ff5470'); matOnde.color.set('#ff5470');
        cam.add(vTmp.set((Math.random() - .5) * .14 * k, (Math.random() - .5) * .1 * k, 0));
      }
    } else { etinc.material.opacity = 0; flash.style.background = 'transparent'; }
    bloom.strength = (effet.type === 'parry' && te >= 0 && te < 420) ? .45 + .45 * (1 - te / 420) : (enCine && cine.type === 'ko') ? .7 : .45;
    camera.position.copy(cam); camera.lookAt(vise);
    bokeh.uniforms.focus.value += (camera.position.distanceTo(pointe) - bokeh.uniforms.focus.value) * .25;

    coupNom.textContent = coup && a.phase !== 'attente' ? coup.nom + (coup.frames ? ' · ' + coup.frames + 'f' : '') + (enFeinte ? ' · ?' : '') : '';
    composer.render();
  }

  function declencher(type, now) {
    effet = { type: type === 'riposte' ? 'parry' : type, t: now };
    const o = new THREE.Vector3(); (jeu === 'sf' ? joueur.j.mainR : joueur.j.mainL).getWorldPosition(o);
    onde.position.set(o.x, HAUT_DALLE + .02, o.z); onde2.position.set(o.x, HAUT_DALLE + .025, o.z); eclatImpact.position.copy(o);
    if (type === 'parry' || type === 'riposte') gelJusqua = now + 90; // hit-stop
    if (type === 'touche' && bouclier.visible) abimer();
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = (Math.random() - .5) * Math.PI;
      vit[i] = { o, d: new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph) + .7, Math.sin(th) * Math.cos(ph)).multiplyScalar(1.0 + Math.random() * 1.8) };
    }
  }
  // cinématiques : 'intro' (le boss se présente, la caméra vient se placer), 'ko' (il s'effondre, la caméra orbite)
  function cinematique(type, now) { cine = { type, t: now }; if (type === 'intro') reparer(); }

  return { setJeu, setAveugle, tick, declencher, cinematique };
}
