// Parry — scène three.js. La caméra regarde l'arme de l'adversaire par-dessus l'épaule du joueur.
// Écran propre (pas de filtre CRT), mais du bloom. Décor d'après le tableau d'Anato Finnstark : une dalle sur une colline, une vallée,
// deux statues colossales et des arbres en cartes peintes (art/decor/). Personnages riggés dans Blender (modeles/).
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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
const easeIn = t => t < 0 ? 0 : t > 1 ? 1 : t * t * t;
const lin = t => t < 0 ? 0 : t > 1 ? 1 : t;

// ---- poses. Clés : <joint> = rotation z (plan sagittal, le stickman regarde +x),
// <joint>_y = rotation y (balayages), x = fente, y = hauteur des hanches.
const IDLE_ARME = { brasR: .3, avantR: 1.0, mainR: 1.3, brasR_y: .15, brasL: -.3, avantL: .2, brasL_y: 0, cuisseL: .3, tibiaL: -.2, cuisseR: -.35, tibiaR: .1, torse: .12, torse_y: 0, x: 0, y: 0 };
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
    arme: { brasR: -.35, avantR: 1.75, brasR_y: -.1, brasL: 1.1, avantL: .6, torse: -.08, torse_y: .5, cuisseR: -.4, tibiaR: -.2, x: -.25 },
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
    arme: { brasR: 2.4, avantR: -.5, brasR_y: .6, brasL: 1.6, avantL: .4, torse: -.25, torse_y: .5, x: -.1, y: -.03 },
    coup: { brasR: 1.9, avantR: .1, brasR_y: -.8, brasL: -.6, avantL: .4, cuisseL: .8, tibiaL: -.5, cuisseR: -.3, tibiaR: .2, torse: -.1, torse_y: -.6, x: .3, y: -.06 },
    recul: { brasR: 2.3, avantR: -.4, brasR_y: -.2, brasL: 1.3, avantL: .7, cuisseL: -.2, tibiaL: .1, cuisseR: .5, tibiaR: -.4, torse: -.6, x: -.4 } },
  tir: { montee: 300, frappe: 40,
    arme: { brasR: 1.5, avantR: 0, brasR_y: .35, brasL: 1.5, avantL: 0, brasL_y: .1, cuisseL: .3, tibiaL: -.2, cuisseR: -.3, tibiaR: .1, torse: .1, torse_y: .45, x: 0, y: -.02 },
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

const REPOS_J_ER = { brasL: .55, avantL: 1.0, brasR: -.25, avantR: .45, cuisseL: .5, tibiaL: -.55, cuisseR: -.3, tibiaR: -.25, torse: .18, x: .02, y: -.07 };
const PARADE_J_ER = { brasL: .9, avantL: .7, brasR: -.6, avantR: .5, cuisseL: .5, tibiaL: -.3, cuisseR: -.3, tibiaR: .2, torse: .15, x: .12, y: -.03 };
const REPOS_J_SF = { brasL: 1.0, avantL: 1.6, brasR: .9, avantR: 1.7, cuisseL: .3, tibiaL: -.3, cuisseR: -.3, tibiaR: .3, torse: .08, x: 0, y: -.04 };
const PARADE_J_SF = { brasL: 1.5, avantL: .3, brasR: 1.4, avantR: .4, cuisseL: .5, tibiaL: -.4, cuisseR: -.3, tibiaR: .3, torse: .2, x: .1, y: -.06 };
const TOUCHE_TOT = { brasL: -.9, avantL: .3, brasL_y: -.7, brasR: .7, avantR: .6, cuisseL: .2, tibiaL: -.4, cuisseR: -.5, tibiaR: .3, torse: -.45, torse_y: .35, x: -.18, y: -.08 };
const TOUCHE_J = { brasL: -.2, avantL: .6, brasR: .8, avantR: .4, cuisseL: .1, tibiaL: -.1, cuisseR: -.6, tibiaR: .5, torse: -.55, x: -.35, y: -.05 };

function melange(a, b, t) {
  const p = {};
  for (const k of Object.keys(a)) p[k] = a[k] + ((b[k] == null ? a[k] : b[k]) - a[k]) * t;
  return p;
}
const complet = (base, p) => Object.assign({}, base, { mainR: 0 }, p); // le poignet se remet dans l'axe dès qu'on quitte la garde

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

// ---- personnages modélisés : GLB riggés dans Blender (work/blender/rigger.py), os nommés comme les articulations du stickman.
// Le GLB est normalisé (hauteur 1, face +Z) ; on le tourne pour qu'il regarde +x comme le stickman.
// Une pose du jeu (rotation z = plan sagittal, _y = balayage) devient, pour chaque os, un delta exprimé dans le repère
// du personnage : local = P⁻¹ · D · P · repos, P étant l'orientation monde de repos du parent.
const chargeur = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const modelesCharges = {};
const chargerModele = nom => modelesCharges[nom] || (modelesCharges[nom] = chargeur.loadAsync(`modeles/${nom}.glb`));
// capes qui ondulent et liseré de lumière, partagés par tous les personnages
const uPerso = { uTempsP: { value: 0 }, uRim: { value: new THREE.Color('#ffd6a0') }, uRimForce: { value: .7 } };
const uBasJoueur = { value: .42 }, uBasBoss = { value: 1 };
function habillerMateriau(m, bas) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uPerso); sh.uniforms.uBas = bas;
    sh.vertexShader = 'uniform float uTempsP; varying float vYo;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vYo = transformed.y;
      // le tissu dans le dos, sous les épaules, flotte (espace objet : hauteur 0..1, face +z)
      float cape = smoothstep(.8, .35, transformed.y) * smoothstep(-.015, -.09, transformed.z);
      transformed.z -= cape * (.018 + .016 * sin(uTempsP * 1.7 + transformed.y * 6.0 + transformed.x * 3.0));
      transformed.x += cape * .012 * sin(uTempsP * 1.3 + transformed.y * 5.0);`);
    sh.fragmentShader = 'uniform vec3 uRim; uniform float uRimForce, uBas; varying float vYo;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rim = pow(1.0 - clamp(dot(normalize(normal + 1e-5), normalize(vViewPosition)), 0.0, 1.0), 4.5);
      outgoingLight *= mix(uBas, 1.0, smoothstep(.12, .78, vYo)) * (uBas < .9 ? .8 : 1.0);
      outgoingLight += uRim * rim * uRimForce * (.35 + .65 * diffuseColor.rgb);
      #include <opaque_fragment>`);
  };
  m.needsUpdate = true;
}
const ARTICULATIONS = ['torse', 'tete', 'brasL', 'avantL', 'mainL', 'brasR', 'avantR', 'mainR', 'cuisseL', 'tibiaL', 'cuisseR', 'tibiaR'];

function monterRig(gltf, hauteur, lisser = false, bas = uBasBoss) {
  const conteneur = new THREE.Group(), modele = gltf.scene;
  modele.rotation.y = Math.PI / 2; modele.scale.setScalar(hauteur); conteneur.add(modele);
  const os = {}, materiaux = new Set();
  modele.traverse(o => {
    if (o.isBone) os[o.name] = o;
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; materiaux.add(o.material); }
  });
  modele.traverse(o => { if (o.isMesh && lisser) o.geometry.computeVertexNormals(); });
  for (const m of materiaux) { m.metalness = 0; m.roughness = .95; m.envMapIntensity = .1; if (m.map) { m.map.anisotropy = 8; m.emissiveMap = m.map; m.emissive.set('#ffffff'); m.emissiveIntensity = bas === uBasJoueur ? .08 : .02; } habillerMateriau(m, bas); }
  conteneur.updateMatrixWorld(true); // hors scène : le monde, c'est le repère du personnage
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const info = {};
  for (const n of ARTICULATIONS) {
    const b = os[n], P = b.parent.getWorldQuaternion(Q());
    info[n] = { b, q0: b.quaternion.clone(), P, Pi: P.clone().invert(), C: Q() };
  }
  // l'A-pose : les bras descendent à ~8° du corps avant toute pose
  for (const c of ['L', 'R']) {
    const d = os['avant' + c].getWorldPosition(V()).sub(os['bras' + c].getWorldPosition(V())).normalize();
    const alpha = Math.atan2(Math.abs(d.z), -d.y) - .14;
    info['bras' + c].C.setFromAxisAngle(new THREE.Vector3(1, 0, 0), d.z > 0 ? alpha : -alpha);
  }
  // prises dans les mains : -y local = le prolongement de l'avant-bras, comme la main du stickman
  const prises = {};
  for (const c of ['L', 'R']) {
    const main = os['main' + c], poignet = main.getWorldPosition(V()), d = poignet.clone().sub(os['avant' + c].getWorldPosition(V())).normalize();
    const s = new THREE.Object3D(), A = Q().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
    s.quaternion.copy(main.getWorldQuaternion(Q()).invert().multiply(A));
    s.position.copy(main.worldToLocal(poignet.clone().addScaledVector(d, hauteur * .05)));
    s.scale.setScalar(1 / main.getWorldScale(V()).x);
    main.add(s); prises['main' + c] = s;
  }
  // décalages x (fente) et y (hanches) : dans le repère du parent de l'os racine, mis à l'échelle de la hanche
  const H = os.hanches, pos0 = H.position.clone(), hanche = H.getWorldPosition(V()).y;
  const M3 = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(H.parent.matrixWorld).invert());
  const k = hanche / .95, dv = V(), e = new THREE.Euler(), D = Q();
  function poser(p) {
    for (const n of ARTICULATIONS) {
      const I = info[n]; e.set(0, p[n + '_y'] || 0, p[n] || 0); D.setFromEuler(e).multiply(I.C);
      I.b.quaternion.copy(I.Pi).multiply(D).multiply(I.P).multiply(I.q0);
    }
    H.position.copy(pos0).add(dv.set((p.x || 0) * k, (p.y || 0) * k, 0).applyMatrix3(M3));
  }
  const j = { tete: os.tete, torse: os.torse, avantR: os.avantR, cuisseR: os.cuisseR, tibiaR: os.tibiaR, ...prises };
  return { conteneur, poser, j, materiaux: [...materiaux] };
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

// Téléphones et tablettes : GPU modeste, écran à forte densité. On garde la lecture de l'arme, on coupe le reste.
// ?qualite=haute ou ?qualite=basse force un profil.
const QUALITE = new URLSearchParams(location.search).get('qualite');
export const LEGER = QUALITE ? QUALITE === 'basse' : matchMedia('(pointer: coarse)').matches;

export function creerScene(canvas, coupNom, flash) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEGER, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(LEGER ? 1.25 : 2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = LEGER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#8eaee0', .0032);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const camera = new THREE.PerspectiveCamera(50, 900 / 420, .1, 1400);
  // Par-dessus l'épaule du joueur : seul son bouclier reste au premier plan, l'adversaire plein cadre.
  const camBase = new THREE.Vector3(-1.95, 1.95, 2.65), viseBase = new THREE.Vector3(.9, 1.72, -.33);
  const vise = viseBase.clone();

  // ---- post-traitement : rendu, bloom, sortie (tone mapping + sRGB)
  // rendu → occlusion ambiante (GTAO) → profondeur de champ sur l'arme → bloom → vignette + aberration → sortie → SMAA
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 900, 420); gtao.output = GTAOPass.OUTPUT.Default;
  gtao.updateGtaoMaterial({ radius: .35, distanceExponent: 1.2, thickness: .6, scale: 1.2, samples: 12, distanceFallOff: 1 });
  composer.addPass(gtao); gtao.enabled = !LEGER;
  const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: .0005, maxblur: .0016 });
  composer.addPass(bokeh); bokeh.enabled = !LEGER;
  const bloom = new UnrealBloomPass(new THREE.Vector2(900, 420), .45, .5, .92);
  composer.addPass(bloom);
  const cinema = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, vignette: { value: .46 }, aberration: { value: .0004 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float aberration; varying vec2 vUv;
      void main(){ vec2 d = vUv - .5; float r2 = dot(d, d);
        vec2 off = d * aberration * (1.0 + r2 * 6.0);
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        c *= 1.0 - vignette * smoothstep(.15, .85, r2 * 2.2);
        c *= mix(.46, 1.0, smoothstep(.0, .46, vUv.y)); // le bas du cadre plonge dans l'ombre, comme le tableau
        gl_FragColor = vec4(c, 1.0); }`,
  });
  // l'arme est rendue seule (calque 1) dans un masque ; ce passage dilate le masque en deux anneaux :
  // une ligne ardente collée à la silhouette, et un liseré noir au-delà (la ligne se lit claire sur foncé, même sur les nuages)
  const rtMasque = new THREE.WebGLRenderTarget(900, 420);
  // dans le masque, l'arme est gonflée d'un pixel à l'écran : une lame vue par la tranche garde une empreinte continue
  const matMasque = new THREE.ShaderMaterial({ uniforms: { resolution: { value: new THREE.Vector2(900, 420) } },
    vertexShader: 'uniform vec2 resolution; void main(){ vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vec2 n2 = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy; float l = length(n2); clip.xy += (l > 1e-4 ? n2 / l : vec2(0.0)) * 1.2 * 2.0 / resolution * clip.w; gl_Position = clip; }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }', side: THREE.DoubleSide });
  const silhouette = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tMasque: { value: null }, texel: { value: new THREE.Vector2(1 / 900, 1 / 420) }, couleur: { value: new THREE.Color() }, force: { value: 0 }, sombre: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse, tMasque; uniform vec2 texel; uniform vec3 couleur; uniform float force, sombre; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float m0 = texture2D(tMasque, vUv).r;
        float g = 0.0, d = 0.0;
        for (int i = 0; i < 16; i++) { vec2 dir = vec2(cos(float(i) * .3927), sin(float(i) * .3927));
          g = max(g, max(texture2D(tMasque, vUv + dir * texel * 1.6).r, texture2D(tMasque, vUv + dir * texel * 3.0).r));
          d = max(d, max(texture2D(tMasque, vUv + dir * texel * 6.5).r, texture2D(tMasque, vUv + dir * texel * 4.6).r)); }
        float ligne = g * (1.0 - m0), noir = d * (1.0 - g);
        c = mix(c, vec3(.02, .01, .03), noir * step(.01, sombre));
        c += couleur * force * ligne;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  silhouette.uniforms.tMasque.value = rtMasque.texture; // le ShaderPass clone ses uniforms et perd la texture
  composer.addPass(cinema);
  composer.addPass(silhouette);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(900, 420); composer.addPass(smaa);

  // ---- lumières : l'après-midi du tableau, soleil chaud haut à gauche, ciel bleu en rebond
  const hemi = new THREE.HemisphereLight('#9cc0ff', '#6d8a3c', .36); scene.add(hemi);
  const cle = new THREE.DirectionalLight('#ffe2b8', 3.1); cle.position.set(7, 6.5, -8);
  cle.castShadow = true; cle.shadow.mapSize.set(LEGER ? 1024 : 2048, LEGER ? 1024 : 2048); cle.shadow.bias = -.0004; cle.shadow.normalBias = .02;
  Object.assign(cle.shadow.camera, { left: -7, right: 7, top: 7, bottom: -5, near: 1, far: 30 });
  scene.add(cle);
  const flaque = new THREE.SpotLight('#ffcf96', 14, 16, .3, .8, 1.3); flaque.position.set(-1.2, 9, 1.2); flaque.target.position.set(-.8, 0, .6); scene.add(flaque, flaque.target); // la douche chaude sur le boss
  const contre = new THREE.PointLight('#ffd09a', 26, 14, 1.3); contre.position.set(2.4, 3.2, -1.6); scene.add(contre);
  const lueurArme = new THREE.PointLight('#d9a441', 0, 1.1, 2); scene.add(lueurArme);
  const eclatImpact = new THREE.PointLight('#fffdf2', 0, 6, 1.5); scene.add(eclatImpact);

  const charger = (url, rep) => { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };

  // ---- ciel : la toile peinte (art/decor/ciel.webp, rendue raccordable) sur un dôme ; au-dessus de la toile, le bleu du zénith
  const texCiel = charger('art/decor/ciel.webp'); texCiel.wrapS = THREE.RepeatWrapping; texCiel.generateMipmaps = false; texCiel.minFilter = THREE.LinearFilter;
  const matCiel = new THREE.ShaderMaterial({
    uniforms: { carte: { value: texCiel }, zenith: { value: new THREE.Color(23 / 255, 103 / 255, 180 / 255) }, brume: { value: new THREE.Color('#8eaee0') }, nuit: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform sampler2D carte; uniform vec3 zenith, brume; uniform float nuit; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float el = asin(clamp(d.y, -1.0, 1.0)); float az = atan(d.z, d.x);
        float v = .09 + (el + .035) / .95 * .91; // l'horizon de la toile un peu sous les yeux, le haut de la toile à ~52°
        vec3 c = texture2D(carte, vec2(az / 6.2831853 * 2.0, clamp(v, .002, .998))).rgb;
        c = mix(c, zenith, smoothstep(.9, 1.12, v));
        float voile = exp(-(az + .78) * (az + .78) / .09 - (el - .3) * (el - .3) / .04); c *= 1.0 - .58 * voile; c = mix(c, c * vec3(.86, .92, 1.08), voile);
        c = mix(c, brume, smoothstep(.12, .02, v) * .85);
        c *= 1.0 - nuit * .92;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const ciel = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), matCiel); ciel.renderOrder = -1; ciel.frustumCulled = false; scene.add(ciel);
  new THREE.TextureLoader().load('art/decor/ciel.webp', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.environment = pmrem.fromEquirectangular(t).texture; });
  // le soleil : hors champ, un lens flare qui traverse l'image quand la caméra bouge
  const texFlare = (teinte, doux) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, teinte); r.addColorStop(doux, teinte.replace(')', ',.35)').replace('rgb(', 'rgba(')); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(texFlare('rgb(255,244,214)', .12), 420, 0));
  flare.addElement(new LensflareElement(texFlare('rgb(255,200,120)', .6), 60, .55));
  flare.addElement(new LensflareElement(texFlare('rgb(227,104,168)', .7), 90, .75));
  flare.addElement(new LensflareElement(texFlare('rgb(155,92,240)', .7), 130, .95));
  const soleil = new THREE.Object3D(); soleil.position.set(-40, 70, 60); soleil.add(flare); scene.add(soleil);

  // ---- le relief : un plateau d'herbe autour de la dalle, qui descend vers une vallée où se dressent les statues.
  // Le regard part vers +x / -z (angle ~0,65 rad) : c'est là que la vallée s'ouvre.
  const bruit2 = (x, z) => Math.sin(x * .11 + Math.sin(z * .07) * 2) * Math.cos(z * .09 - x * .03) + .5 * Math.sin(x * .27 + z * .21) * Math.sin(z * .33 - x * .12);
  function hauteurSol(x, z) {
    const r = Math.hypot(x, z), ang = Math.atan2(-z, x);
    const versVallee = Math.max(0, Math.cos(ang - .65));
    const descente = r < 6 ? 0 : -Math.min(34, Math.pow((r - 6) / 26, 1.5) * 9) * (.3 + .7 * versVallee);
    const collines = r < 6 ? 0 : Math.min(1, (r - 6) / 10) * (bruit2(x * .7, z * .7) * (1.4 + Math.min(r, 120) * .01) + (1 - versVallee) * Math.min(22, (r - 6) * .2));
    const couronne = Math.max(0, Math.min(1, (r - 260) / 160)) ** 2 * (38 + 12 * bruit2(x * .08, z * .08)) * (1 - .6 * versVallee);
    return descente + collines + couronne + (r < 6 ? .13 * (1 - Math.max(0, Math.min(1, (r - 3.2) / 2.8)) ** 2) : 0);
  }
  // une carte peinte au pinceau (canvas) posée sur le sol : chemin ocre (R), taches d'herbe (G), mares (B)
  const MARES = [];
  const carte = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    const P = (x, z) => [(x + 130) / 260 * 1024, (z + 130) / 260 * 1024];
    let sd = 11; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 260; i++) { const x = rnd() * 1024, y = rnd() * 1024, r = 8 + rnd() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = rnd() < .5 ? 255 : 110; gr.addColorStop(0, `rgba(0,${v},0,.55)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.globalCompositeOperation = 'lighter';
    const chemin = [[3, 2], [9, -3], [17, -6], [27, -13], [36, -22], [46, -27], [58, -36], [72, -45]];
    for (let pass = 0; pass < 3; pass++) {
      g.strokeStyle = `rgba(255,0,0,${pass ? .35 : .8})`; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = [4, 7, 11][pass];
      g.beginPath(); chemin.forEach(([x, z], i) => { const [a, b] = P(x + (rnd() - .5) * 2, z + (rnd() - .5) * 2); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
    }
    for (const [x, z, rx, rz] of MARES) { const [a, b] = P(x, z); g.fillStyle = 'rgba(0,0,255,1)'; g.beginPath(); g.ellipse(a, b, rx * 3.9, rz * 3.9, .4, 0, Math.PI * 2); g.fill(); }
    return new THREE.CanvasTexture(c);
  })();
  const texHerbe = charger('art/decor/tex_herbe.webp', 1);
  const uSol = { uTemps: { value: 0 }, uCarte: { value: carte }, uDalle: { value: null }, uSceau: { value: null } };
  const matPrairie = new THREE.MeshStandardMaterial({ map: texHerbe, roughness: 1, metalness: 0 });
  matPrairie.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uSol);
    sh.vertexShader = 'varying vec3 vMonde;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vMonde; uniform float uTemps; uniform sampler2D uCarte, uDalle, uSceau;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 uvh = vMonde.xz / 7.0;
      vec3 h1 = texture2D(map, uvh).rgb, h2 = texture2D(map, uvh * .37 + .21).rgb;
      vec3 herbe = mix(h1, h2, .45);
      vec4 k = texture2D(uCarte, (vMonde.xz + 130.0) / 260.0);
      herbe *= mix(1.0, mix(.72, 1.22, step(.6, k.g)), smoothstep(.05, .4, k.g));
      herbe = mix(herbe, herbe * vec3(1.08, 1.02, .8), smoothstep(-6.0, -12.0, vMonde.y));
      vec3 ocre = mix(vec3(.74, .47, .18), vec3(.9, .64, .28), h2.g) * (.82 + .3 * h1.r);
      herbe = mix(herbe, ocre, smoothstep(.25, .6, k.r));
      vec3 eau = mix(vec3(.42, .62, .86), vec3(.86, .9, .95), h1.g * .6);
      herbe = mix(herbe, eau, smoothstep(.4, .6, k.b));
      float n = sin(vMonde.x * .045 + uTemps * .05) * sin(vMonde.z * .06 - uTemps * .035) + .6 * sin(vMonde.x * .11 - vMonde.z * .07 + uTemps * .08);
      herbe *= mix(1.0, .62, smoothstep(.35, .9, n));
      float rA = length(vMonde.xz); herbe *= mix(1.0, .72, smoothstep(7.0, 13.0, rA) * (1.0 - smoothstep(45.0, 80.0, rA))); // l'ombre d'un nuage sur le plan moyen
      // la clairière : des dalles usées au centre, un bord rongé par l'herbe et la terre battue
      float rr = length(vMonde.xz) + (h1.g - .5) * 1.4 + sin(atan(vMonde.z, vMonde.x) * 7.0) * .18;
      vec3 dalle = texture2D(uDalle, vMonde.xz / 3.2).rgb * vec3(.8, .74, .66);
      vec2 qS = vMonde.xz; vec2 uvS = vec2(.5 - dot(qS, vec2(.68, .73)) / 5.4, .5 + dot(qS, vec2(.73, -.68)) / 5.4);
      dalle = mix(dalle, texture2D(uSceau, uvS).rgb * vec3(.86, .8, .7), 1.0 - smoothstep(2.5, 2.68, length(qS)));
      vec3 terre = mix(vec3(.22, .16, .1), vec3(.3, .22, .14), h2.r);
      herbe = mix(herbe, terre, 1.0 - smoothstep(3.5, 4.6, rr));
      herbe = mix(herbe, dalle, 1.0 - smoothstep(2.9, 3.5, rr));
      diffuseColor.rgb *= herbe;`);
  };
  const geoSol = new THREE.PlaneGeometry(800, 800, 300, 300); geoSol.rotateX(-Math.PI / 2);
  { const p = geoSol.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hauteurSol(p.getX(i), p.getZ(i))); geoSol.computeVertexNormals(); }
  const solLoin = new THREE.Mesh(geoSol, matPrairie); solLoin.receiveShadow = true; scene.add(solLoin);


  // ---- l'herbe haute autour de la dalle : brins effilés qui ondulent, du vert profond au jaune-vert du tableau
  const NH = LEGER ? 11000 : 34000, geoBrin = new THREE.PlaneGeometry(.055, .46, 1, 5); geoBrin.translate(0, .23, 0);
  { const p = geoBrin.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / .42; p.setX(i, p.getX(i) * (1 - y * .9)); p.setZ(i, y * y * .1); } geoBrin.computeVertexNormals(); }
  const matHerbe = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const uTemps = uSol.uTemps;
  matHerbe.onBeforeCompile = sh => {
    sh.uniforms.uTemps = uTemps;
    sh.vertexShader = 'uniform float uTemps; varying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float hk = position.y / .5; vH = hk; hk *= hk;
      float onde = sin(uTemps * 1.4 + instanceMatrix[3][0] * .6 + instanceMatrix[3][2] * .8) + .4 * sin(uTemps * 3.1 + instanceMatrix[3][2] * 2.3);
      transformed.x += onde * .16 * hk; transformed.z += onde * .07 * hk;`);
    sh.fragmentShader = 'varying float vH;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(.6, 1.2, vH);');
  };
  const herbe = new THREE.InstancedMesh(geoBrin, matHerbe, NH);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    // en touffes : un centre, une teinte, une dizaine de brins qui s'évasent
    let cx = 0, cz = 0, teinte = 0, jaune = false;
    for (let i = 0; i < NH; i++) {
      if (i % 17 === 0) { const ang = Math.random() * Math.PI * 2, r = 3.85 + Math.pow(Math.random(), .75) * 21.5; cx = Math.cos(ang) * r; cz = Math.sin(ang) * r; jaune = Math.random() < .22; teinte = Math.random(); }
      const a2 = Math.random() * Math.PI * 2, r2 = Math.pow(Math.random(), .6) * .3;
      v.set(cx + Math.cos(a2) * r2, 0, cz + Math.sin(a2) * r2); v.y = hauteurSol(v.x, v.z) - .02;
      e.set((Math.random() - .5) * .35, a2 + Math.PI / 2 + (Math.random() - .5) * .8, (Math.random() - .5) * .35); q.setFromEuler(e);
      const k = .7 + Math.random() * .7; sc.set(k, k * (.75 + Math.random() * .6), k);
      herbe.setMatrixAt(i, m.compose(v, q, sc));
      herbe.setColorAt(i, col.setHSL(jaune ? .14 + teinte * .05 : .2 + teinte * .08, .38 + Math.random() * .18, jaune ? .5 + Math.random() * .12 : .34 + teinte * .14 + Math.random() * .08));
    }
    herbe.receiveShadow = true; scene.add(herbe); }
  // fleurs sauvages : jaunes et violettes, comme sur la texture
  if (false) { const NF = 900, fleurs = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 4), new THREE.MeshLambertMaterial({ color: '#ffffff' }), NF);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < NF; i++) { const ang = Math.random() * Math.PI * 2, r = 4.3 + Math.pow(Math.random(), .8) * 18, x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      m.makeTranslation(x, hauteurSol(x, z) + .25 + Math.random() * .2, z); fleurs.setMatrixAt(i, m); fleurs.setColorAt(i, Math.random() < .55 ? c.set('#ffd23a') : c.set('#9b6cf0')); }
    scene.add(fleurs); }

  // ---- la dalle : un disque de grès taillé sur une marche, un liseré d'or incrusté
  const HAUT_DALLE = .14;
  const texDalle = charger('art/decor/tex_dalle.webp', 3); uSol.uDalle.value = charger('art/decor/tex_dalle2.webp', 1); uSol.uSceau.value = charger('art/decor/sceau.webp');
  const matDessus = new THREE.MeshStandardMaterial({ map: texDalle, roughness: .9, metalness: 0, color: '#c9bba4' });
  const texBord = charger('art/decor/tex_dalle.webp'); texBord.wrapS = texBord.wrapT = THREE.RepeatWrapping; texBord.repeat.set(8, .3);
  const matBord = new THREE.MeshStandardMaterial({ map: texBord, roughness: .95, color: '#b9a88f' });
  const matAnneau = new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: .9, roughness: .3, emissive: '#d9a441', emissiveIntensity: .15 });
  const arene = new THREE.Mesh(new THREE.TorusGeometry(3.25, .03, 6, 128), matAnneau); arene.rotation.x = -Math.PI / 2; arene.position.y = HAUT_DALLE + .005;
  const arene2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, .015, 6, 128), matAnneau); arene2.rotation.x = -Math.PI / 2; arene2.position.y = HAUT_DALLE + .005;

  // ---- le décor peint en volume (modeles/volumes.glb, work/gonfler.py) : chaque silhouette du tableau gonflée
  // selon sa distance au bord, texturée par sa propre peinture, tournée vers l'arène. Statues colossales, falaise, arbres.
  const cartes = [], attenteVolumes = []; let modeleVolumes = null;
  chargeur.loadAsync('modeles/volumes.glb').then(g => { modeleVolumes = g.scene; attenteVolumes.splice(0).forEach(f => f()); }).catch(e => console.warn('volumes', e));
  function carteDecor(nom, ang, dist, haut, opts = {}) {
    const a = ang * Math.PI / 180, x = Math.cos(a) * dist, z = -Math.sin(a) * dist;
    const o = new THREE.Group(); o.position.set(x, hauteurSol(x, z) - (opts.enfonce ?? .04) * haut, z); o.scale.setScalar(haut);
    o.rotation.y = Math.atan2(-x, -z) + (opts.tourne || 0);
    const teinte = new THREE.Color(opts.teinte || '#ffffff').lerp(new THREE.Color('#b3bde8'), Math.min(.3, dist / 700));
    if (opts.desat == null && /arbre_(violet|turquoise)/.test(nom)) opts.desat = .28;
    const remplir = () => {
      const src = modeleVolumes.getObjectByName('lame_' + nom); if (!src) return;
      const mat = new THREE.MeshBasicMaterial({ map: src.material.map, color: teinte, side: THREE.DoubleSide, fog: true });
      if (opts.desat) mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(.3, .55, .15))), ${opts.desat.toFixed(2)});`); };
      const m = new THREE.Mesh(src.geometry, mat); m.castShadow = !!opts.ombre; m.userData.teinte = '#' + teinte.getHexString();
      o.add(m); cartes.push(m);
    };
    modeleVolumes ? remplir() : attenteVolumes.push(remplir);
    scene.add(o); return o;
  }
  // les deux géantes : elles surgissent de la vallée de part et d'autre de la trouée de lumière où se tient le boss
  carteDecor('statue', 21, 250, 165, { enfonce: .22, teinte: '#f0e8ee', desat: .3 });
  carteDecor('statue2', 54, 262, 165, { enfonce: .22, teinte: '#f0e8ee', desat: .3 });
  for (const [a, d, h] of [[17, 232, 44], [25, 238, 40], [50, 246, 42], [58, 252, 46], [21, 212, 24], [55, 225, 26]]) carteDecor('eboulis', a, d, h, { enfonce: .15 });
  for (const [a, d, h] of [[28, 5.1, .9], [48, 5.6, .7], [115, 5.2, .8], [200, 5.0, 1], [250, 5.4, .7], [-30, 6.2, 1.1], [80, 6.5, .9], [160, 6, .8]]) carteDecor('rochers', a, d, h, { ombre: true, enfonce: .1 });
  for (const [a, d, h] of [[8, 9, 1.2], [60, 10, 1.1], [140, 9.5, 1.3], [300, 8.5, 1.2]]) carteDecor('eboulis', a, d, h, { enfonce: .1 });
  { let sd = 17; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 40; i++) carteDecor('fleurs', rnd() * 360, 4.4 + rnd() * 9, .45 + rnd() * .35, { tourne: rnd() * 6 }); }
  carteDecor('falaise', -14, 78, 52, { enfonce: .1 });
  carteDecor('chene', 84, 11, 9.5, { ombre: true });
  carteDecor('arbre_violet', 66, 15, 6.5, { ombre: true }); carteDecor('arbre_violet', 3, 13, 5.5, { ombre: true, teinte: '#d8d0e6', desat: .42 });
  carteDecor('arbre_turquoise', 74, 22, 6.5); carteDecor('arbre_turquoise', 12, 46, 7); carteDecor('arbre_turquoise', -4, 20, 5);
  carteDecor('buisson_jaune', 50, 17, 2.6); carteDecor('buisson_jaune', 38, 25, 2.2); carteDecor('buisson_jaune', 12, 11, 2);
  // la vallée : cyprès et bosquets de plus en plus bleutés
  for (const [a, d, h, n] of [[27, 60, 9, 'cypres'], [33, 80, 10, 'cypres'], [45, 70, 8, 'cypres'], [63, 85, 9, 'cypres'], [22, 95, 8, 'cypres'], [40, 115, 11, 'cypres'],
    [30, 52, 7, 'arbre_violet'], [48, 95, 9, 'arbre_turquoise'], [18, 70, 8, 'arbre_violet'], [58, 60, 7, 'arbre_turquoise'], [36, 140, 12, 'arbre_violet'], [44, 150, 12, 'arbre_turquoise']]) carteDecor(n, a, d, h);
  // premier plan sombre, en bas à droite, comme la masse bleu-violet du tableau
  carteDecor('arbre_violet', -9, 5.4, 3.4, { teinte: '#77738f', enfonce: .25, desat: .35 }); carteDecor('arbre_turquoise', -16, 7.5, 3.8, { teinte: '#56707e', enfonce: .2 }); carteDecor('buisson_jaune', 118, 4.6, 2.4, { teinte: '#5c5a48', enfonce: .1 });
  // tout autour (derrière la caméra aussi, pour l'orbite du K.O.)
  { let sd = 5; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280; const noms = ['arbre_violet', 'arbre_turquoise', 'buisson_jaune', 'chene', 'cypres'];
    for (let i = 0; i < 26; i++) { const a = 100 + rnd() * 250, d = 10 + rnd() * 22, n = noms[Math.floor(rnd() * noms.length)]; carteDecor(n, a, d, n === 'buisson_jaune' ? 2 + rnd() : 5 + rnd() * 4); } }

  // ---- particules : graines et pollen qui dérivent dans le vent
  const tex = textureLueur();
  const ND = 500, dPos = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) dPos.set([(Math.random() - .5) * 14, .2 + Math.random() * 3.5, (Math.random() - .5) * 14], i * 3);
  const poussiere = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dPos, 3)),
    new THREE.PointsMaterial({ color: '#fff6d0', map: tex, size: .022, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(poussiere);

  // ---- corps
  const matJoueur = new THREE.MeshPhysicalMaterial({ color: '#f7f0c0', roughness: .45, metalness: .2, clearcoat: .6, clearcoatRoughness: .3, emissive: '#3a2a20', emissiveIntensity: .15, envMapIntensity: .8 });
  const matBoss = new THREE.MeshPhysicalMaterial({ color: '#1a1820', roughness: .42, metalness: .15, clearcoat: 1, clearcoatRoughness: .18, emissive: '#1b1322', emissiveIntensity: .35, envMapIntensity: 1.0 });
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
  // les armes modélisées (work/blender/armes.py) remplacent les procédurales ; leurs lames « lame* » chauffent
  const matsLame = []; // les matériaux peints des armes : ils s'assombrissent pendant l'armé
  const uChaleur = { uChaleur: { value: 0 } };
  function chaufferMateriau(m) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uChaleur);
      sh.fragmentShader = 'uniform float uChaleur;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 1.0 - .96 * uChaleur;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 1.0, uChaleur);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= 1.0 - uChaleur;');
    };
    m.needsUpdate = true;
  }
  // couleur et force de la ligne de silhouette (passe « silhouette » après le bloom)
  const uHalo = { couleur: { value: new THREE.Color('#ff4a1c') }, force: { value: 0 } };
  chargeur.loadAsync('modeles/armes.glb').then(g => {
    for (const [nom, grp] of Object.entries(armes)) {
      const src = g.scene.getObjectByName(nom); if (!src) continue;
      const p = src.getObjectByName('pointe_' + nom);
      while (grp.children.length) grp.remove(grp.children[0]);
      [...src.children].forEach(c => { if (c !== p) grp.add(c); });
      grp.userData.pointe = p.position.clone(); if (nom === 'marteau' || nom === 'hallebarde' || nom === 'hache') grp.children.forEach(c => { c.rotation.y = Math.PI / 2; });
      grp.traverse(o => { if (o.isMesh && !o.userData.contour) { o.castShadow = true; const m = o.material; m.envMapIntensity = 1.2; m.userData.arme = nom; if (m.map) m.map.anisotropy = 8; m.envMapIntensity = .6; chaufferMateriau(m); matsLame.push(m);
        o.layers.enable(1); } });
    }
  }).catch(e => console.warn('armes', e));
  for (const g of Object.values(armes)) { g.scale.setScalar(1.25); boss.j.mainR.add(g); }
  armes.ak47.scale.setScalar(1.7); armes.hallebarde.scale.set(1.6, 1.2, 1.15); armes.hache.scale.set(1.6, 1.25, 1.6); armes.marteau.scale.set(1.4, 1.2, 1.4); armes.dague.scale.setScalar(1.4); armes.katana.scale.setScalar(1.35); armes.faux.scale.setScalar(1.05);
  let armeCourante = null;
  function montrerArme(nom) {
    if (armeCourante === nom) return;
    for (const [k, g] of Object.entries(armes)) g.visible = k === nom;
    armeCourante = nom;
  }
  // le bouclier : planches peintes (art/decor/bouclier.webp) bombées, face tournée vers -y (le prolongement de l'avant-bras)
  const RB = .36, BOMBE = .05;
  const matBouclier = new THREE.MeshStandardMaterial({ map: charger('art/decor/bouclier.webp'), roughness: .55, metalness: .15, emissive: '#000000', envMapIntensity: .9 });
  const bouclier = new THREE.Group();
  const geoFace = new THREE.CircleGeometry(RB, 64, 0, Math.PI * 2);
  { const p = geoFace.attributes.position; for (let i = 0; i < p.count; i++) { const r2 = (p.getX(i) ** 2 + p.getY(i) ** 2) / (RB * RB); p.setZ(i, BOMBE * (1 - r2)); } geoFace.computeVertexNormals(); geoFace.rotateX(Math.PI / 2); }
  const disque = new THREE.Mesh(geoFace, matBouclier); disque.castShadow = true; bouclier.add(disque);
  const texDos = (() => { // l'envers : planches de bois brut et deux sangles de cuir
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    for (let i = 0; i < 7; i++) { g.fillStyle = `hsl(${22 + i % 3 * 4}, ${30 + i % 2 * 8}%, ${20 + (i * 7) % 9}%)`; g.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 256); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(i * 256 / 7, 0, 2, 256); }
    for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 8 + Math.random() * 30); }
    g.fillStyle = '#2a160e'; g.fillRect(0, 96, 256, 22); g.fillRect(0, 150, 256, 22); g.fillStyle = '#8a6a3a'; for (const y of [107, 161]) for (const x of [40, 216]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const dos = new THREE.Mesh(new THREE.CircleGeometry(RB, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texDos, roughness: .85 })); dos.position.y = .012; bouclier.add(dos);
  const matRebord = new THREE.MeshStandardMaterial({ color: '#3b3a3c', roughness: .45, metalness: .85, emissive: '#d9a441', emissiveIntensity: 0 });
  const rebord = new THREE.Mesh(new THREE.TorusGeometry(RB, .02, 8, 64), matRebord); rebord.rotation.x = Math.PI / 2; rebord.scale.z = 1.6; bouclier.add(rebord);
  // le bouclier s'abîme : une bosse sombre par coup encaissé, réparé au round suivant
  const degats = new THREE.Group(); bouclier.add(degats);
  const matDegat = new THREE.MeshStandardMaterial({ color: '#6b4a34', roughness: .95, metalness: 0, transparent: true, opacity: .7 });
  function abimer() {
    if (degats.children.length >= 14) return;
    const a = Math.random() * Math.PI * 2, r = .08 + Math.random() * .22, k = .03 + Math.random() * .035;
    const d = new THREE.Mesh(new THREE.SphereGeometry(k, 8, 6), matDegat); d.scale.set(1.8, .12, .28); d.rotation.y = Math.random() * Math.PI; d.position.set(Math.cos(a) * r, -BOMBE * (1 - (r / RB) ** 2) + .004, Math.sin(a) * r); degats.add(d);
  }
  function reparer() { while (degats.children.length) degats.remove(degats.children[0]); }
  const texOmbre = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(0,0,0,.72)'); r.addColorStop(.55, 'rgba(0,0,0,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const ombres = [0, 1].map(() => { const o = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false })); o.position.y = HAUT_DALLE + .01; o.renderOrder = 1; scene.add(o); return o; });
  scene.add(bouclier); // suit la main gauche mais s'oriente dans le repère du joueur (voir tick)

  // ---- les modèles remplacent les stickmen dès qu'ils sont chargés (le stickman reste en secours s'ils manquent)
  const MODELE_BOSS = { soldat: 'conquerant', godrick: 'conquerant', hallebardier: 'conquerant', crucible: 'dore', malenia: 'dore', marteau: 'dore',
    margit: 'sorcier', duel: 'sorcier', jp: 'sorcier', assassin: 'ombre', faucheur: 'ombre', braqueur: 'masque', ryu: 'masque', ken: 'masque', luke: 'masque', marisa: 'dore' };
  const DISPONIBLES = new Set(['conquerant', 'ombre']);
  const PAR_DEFAUT = { er: 'conquerant', ar: 'conquerant', sf: 'ombre' };
  boss.equipement = { mainR: Object.values(armes) }; joueur.equipement = {};
  const rigs = {};
  function habiller(perso, rig) {
    if (perso.rig) perso.groupe.remove(perso.rig.conteneur);
    perso.rig = rig; perso.groupe.add(rig.conteneur); perso.j.racine.visible = false;
    for (const [c, objets] of Object.entries(perso.equipement)) objets.forEach(o => rig.j[c].add(o));
    Object.assign(perso.j, rig.j); perso.poser = rig.poser;
    if (perso === boss) teinterBoss();
  }
  let modeleBoss = null, pretBoss = null;
  function choisirBoss(id) {
    const voulu = MODELE_BOSS[id], nom = voulu && DISPONIBLES.has(voulu) ? voulu : PAR_DEFAUT[jeu];
    if (nom === modeleBoss) return;
    modeleBoss = nom;
    pretBoss = chargerModele(nom).then(g => { if (modeleBoss === nom) habiller(boss, rigs[nom] || (rigs[nom] = monterRig(g, 1.85))); }).catch(e => console.warn('modèle', nom, e));
  }
  const pretJoueur = chargerModele('joueur').then(g => habiller(joueur, monterRig(g, 1.85, false, uBasJoueur))).catch(e => console.warn('modèle joueur', e));
  // Aveugle : le modèle du boss devient une silhouette
  function teinterBoss() {
    if (!boss.rig) return;
    for (const m of boss.rig.materiaux) { m.color.set(aveugle ? '#050308' : '#ffffff'); m.emissiveIntensity = aveugle ? 0 : .1; m.envMapIntensity = aveugle ? 0 : .15; }
  }
  const orbe = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), matArme); orbe.visible = false; scene.add(orbe);

  // le canon qui crache
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
    fragmentShader: `uniform vec3 couleur; varying float vA; void main(){ gl_FragColor = vec4(couleur * 1.2, vA * vA * 0.4); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const trainee = new THREE.Mesh(tGeo, matTrainee); scene.add(trainee);
  let tCurseur = 0; const dernierEchantillon = new THREE.Vector3();
  const vCible = new THREE.Vector3(), vBas = new THREE.Vector3(0, -1, 0), qVise = new THREE.Quaternion(), vMainB = new THREE.Vector3(), qB = new THREE.Quaternion(), qJ = new THREE.Quaternion();
  let reculLisse = 0;
  const derniereBase = new THREE.Vector3(), dernierePointe = new THREE.Vector3(0, 1.2, 0), vNdc = new THREE.Vector3(); let recad = 0;
  const vTip = new THREE.Vector3(), vBase = new THREE.Vector3(), vTmp = new THREE.Vector3(), vJoueur = new THREE.Vector3();
  function echantillonnerTrainee(now, a, b) { const i = tCurseur % NT; tCurseur++; tPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); tTemps[i] = now; }
  const p2 = new Float32Array(NT * 6);
  function majTrainee(now) {
    for (let k = 0; k < NT; k++) {
      const i = (tCurseur + k) % NT;
      p2.set(tPos.subarray(i * 6, i * 6 + 6), k * 6);
      const al = Math.max(0, 1 - (now - tTemps[i]) / 110) * (k / (NT - 1)); tAlpha[k * 2] = al; tAlpha[k * 2 + 1] = al * .1;
    }
    tGeo.attributes.position.array.set(p2); tGeo.attributes.position.needsUpdate = true; tGeo.attributes.alpha.needsUpdate = true;
  }

  // étincelles du parry, éclats sombres du coup pris, onde de choc au sol
  const N = 110, pos = new Float32Array(N * 3), vit = [];
  const etinc = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: '#fffdf2', map: tex, size: .09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(etinc);
  // les étincelles s'étirent en traits le long de leur vitesse ; un éclat en étoile marque le point de contact
  const posT = new Float32Array(N * 6);
  const traits = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(posT, 3)),
    new THREE.LineBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  traits.frustumCulled = false; scene.add(traits);
  const texEtoile = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 60); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-128, -128, 256, 256);
    g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4 * (i ? 2 : 1)); g.beginPath(); g.moveTo(0, -126); g.lineTo(7, 0); g.lineTo(0, 126); g.lineTo(-7, 0); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const etoile = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEtoile, color: '#fff6dc', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  etoile.renderOrder = 11; scene.add(etoile);
  const texEntaille = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,90,80,0)'); gr.addColorStop(.5, 'rgba(255,240,230,1)'); gr.addColorStop(1, 'rgba(255,90,80,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 32); g.quadraticCurveTo(128, 18, 256, 32); g.quadraticCurveTo(128, 40, 0, 32); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const reflet = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEtoile, color: '#fff2c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  reflet.renderOrder = 11; scene.add(reflet);
  const entaille = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEntaille, color: '#ffd2c8', transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  entaille.renderOrder = 12; scene.add(entaille);
  const matOnde = new THREE.MeshBasicMaterial({ color: '#fffdf2', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const onde = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 64), matOnde); onde.rotation.x = -Math.PI / 2; onde.position.y = .02; scene.add(onde);
  const onde2 = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), matOnde); onde2.rotation.x = -Math.PI / 2; onde2.position.y = .025; scene.add(onde2);

  // Les effets (sprites, traînée, particules, nuages) ne doivent pas entrer dans les tampons normales/profondeur du GTAO,
  // sinon ils ressortent en quads noirs. On les cache le temps du rendu de substitution.
  const horsAO = [trainee, cible, bouche, tracant, etinc, traits, etoile, entaille, reflet, poussiere, onde, onde2, soleil, orbe];
  const renderOverrideOrig = gtao.renderOverride.bind(gtao);
  gtao.renderOverride = (...args) => { const vis = horsAO.map(o => o.visible); horsAO.forEach(o => { o.visible = false; }); renderOverrideOrig(...args); horsAO.forEach((o, i) => { o.visible = vis[i]; }); };
  let effet = { type: null, t: 0 }, gelJusqua = 0, cine = { type: null, t: 0 };
  let jeu = 'er', aveugle = false;
  const braise = new THREE.Color(), cBraise = new THREE.Color('#b8260e'), cOrange = new THREE.Color('#ff7a1c'), cOr = new THREE.Color('#ffc94a'), cAide = new THREE.Color('#ff3f9e');
  const accent = new THREE.Color('#d9a441'), blanc = new THREE.Color('#fffdf2'), noir = new THREE.Color('#000000');
  function setJeu(id) {
    jeu = id;
    accent.set(id === 'er' ? '#d9a441' : '#e368a8');
    matArme.color.copy(accent); matArme.emissive.copy(accent); matRebord.emissive.copy(accent); matTrainee.uniforms.couleur.value.copy(accent);
    matAnneau.color.copy(accent); lueurArme.color.copy(accent); matYeux.color.copy(accent); matYeux.emissive.copy(accent);
    contre.color.set(id === 'er' ? '#f2d08a' : '#e368a8');
    bouclier.visible = id !== 'sf';
  }
  setJeu('er');
  // Aveugle : le boss n'est qu'une silhouette, seuls ses yeux et son arme éclairent.
  function setAveugle(oui) {
    aveugle = oui;
    matBoss.color.set(oui ? '#050308' : '#1a1820'); matBoss.emissive.set(oui ? '#000000' : '#1b1322'); matBoss.envMapIntensity = oui ? 0 : 1.0;
    cle.intensity = oui ? 0 : 2.6; hemi.intensity = oui ? .12 : .36; contre.intensity = oui ? 0 : 26;
    matCiel.uniforms.nuit.value = oui ? 1 : 0;
    matPrairie.color.set(oui ? '#2a3024' : '#ffffff'); matHerbe.color.set(oui ? '#232a1e' : '#ffffff');
    for (const c of cartes) c.material.color.set(oui ? '#101218' : c.userData.teinte || '#ffffff');
    scene.fog.color.set(oui ? '#0a0c10' : '#8eaee0'); soleil.visible = !oui;
    teinterBoss();
  }

  function taille() {
    const w = canvas.clientWidth || 900, h = canvas.clientHeight || Math.round(w * 420 / 900);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); composer.setSize(w, h);
      const pr = renderer.getPixelRatio(); rtMasque.setSize(Math.round(w * pr), Math.round(h * pr)); matMasque.uniforms.resolution.value.set(w * pr, h * pr); silhouette.uniforms.texel.value.set(1 / w, 1 / h); bloom.resolution.set(LEGER ? w / 2 : w, LEGER ? h / 2 : h); gtao.setSize(w, h); smaa.setSize(w, h);
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
    choisirBoss(etat.boss);
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
      const titube = complet(recul, { x: (recul.x || 0) - .55, torse: (recul.torse || 0) - .5, brasR: (recul.brasR || 0) + .9, avantR: (recul.avantR || 0) - .4 });
      pb = pare ? (tr < 160 ? melange(coupP, titube, ease(tr / 160)) : tr < 560 ? melange(titube, recul, ease((tr - 160) / 400)) : melange(recul, idle, ease((tr - 560) / 330)))
        : a.jugement && a.jugement.resultat === 'tot' ? (tr < 300 ? melange(coupP, complet(coupP, { x: coupP.x + .3, torse: coupP.torse + .35, brasR: coupP.brasR - .5 }), ease(tr / 300)) : melange(complet(coupP, { x: coupP.x + .3, torse: coupP.torse + .35, brasR: coupP.brasR - .5 }), idle, ease((tr - 300) / 450)))
        : (tr < 250 ? coupP : melange(coupP, idle, ease((tr - 250) / 400)));
    } else pb = Object.assign({}, idle, { y: idle.y + Math.sin(now / 600) * .012, torse: idle.torse + Math.sin(now / 900) * .035, brasR: idle.brasR + Math.sin(now / 1100) * .06, mainR: (idle.mainR || 0) + Math.sin(now / 1300 + 1) * .08, torse_y: (idle.torse_y || 0) + Math.sin(now / 1700) * .06 });
    pb.tete = -(pb.torse || 0) * .85; // le regard ne part pas au ciel quand il se cambre
    boss.poser(pb);
    const armeG = armes[armeCourante];
    if (armeG) {
      armeG.quaternion.identity();
      const fr = an.frappe || 90; let w = 0;
      if (enCours && t > a.preavis - fr) w = ease((t - (a.preavis - fr)) / fr);
      else if (a.phase === 'resolu' && a.jugement) w = tr < 140 ? 1 : Math.max(0, 1 - (tr - 140) / 220);
      if ((an === ANIMS.tir || an === ANIMS.estoc) && (enCours || enFeinte)) w = Math.max(w, ease(t / (a.preavis * .45)));
      if (w > 0 && !an.lineaire && bouclier.visible) {
        boss.groupe.updateMatrixWorld(true);
        const auCorps = a.phase === 'resolu' && a.jugement && a.jugement.resultat !== 'parry' && a.jugement.resultat !== 'tot';
        const poitrine = (an === ANIMS.estoc || an === ANIMS.tir) && (enCours || enFeinte) && t < a.preavis - fr;
        if (auCorps || poitrine) joueur.j.torse.getWorldPosition(vCible).add(vTmp.set(0, .5, 0)); else bouclier.localToWorld(vCible.set(0, -.1, 0));
        const loc = armeG.parent.worldToLocal(vCible).normalize();
        armeG.quaternion.slerp(qVise.setFromUnitVectors(vBas, loc), w * .95);
      }
    }
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
    const TJ = a.jugement && a.jugement.resultat === 'tot' ? TOUCHE_TOT : TOUCHE_J;
    if (a.phase === 'resolu' && a.jugement && !pare) pj = tr < 90 ? melange(repos, complet(repos, TJ), ease(tr / 90)) : tr < 380 ? complet(repos, TJ) : melange(complet(repos, TJ), repos, ease((tr - 380) / 500));
    else if (leve) pj = melange(repos, parade, a.phase !== 'resolu' ? ease((now - a.input) / 60) : 1);
    else pj = Object.assign({}, repos, { y: repos.y + Math.sin(now / 600 + 1) * .012 });
    joueur.poser(pj);
    const eclatB = pare && tr < 260 ? 1 - tr / 260 : 0;
    matBouclier.emissive.copy(eclatB ? cOr : leve ? blanc : noir); matBouclier.emissiveIntensity = eclatB ? .18 * eclatB : leve ? .25 : 0;
    if (!matBouclier.emissiveMap) { matBouclier.emissiveMap = matBouclier.map; matBouclier.needsUpdate = true; }
    // la face regarde l'adversaire, inclinée vers l'extérieur ; levée, elle monte et se referme
    joueur.groupe.updateMatrixWorld(true); joueur.j.mainL.getWorldPosition(vMainB);
    const dirB = leve ? vCible.set(.35, .3, .9) : vCible.set(.12, .12, 1); dirB.normalize();
    qB.setFromUnitVectors(vBas, dirB); joueur.groupe.getWorldQuaternion(qJ); bouclier.quaternion.copy(qJ).multiply(qB);
    bouclier.position.copy(vMainB).addScaledVector(dirB.applyQuaternion(qJ), .1);

    // ---- l'arme : c'est elle qu'on regarde
    for (const [o, p] of [[ombres[0], boss], [ombres[1], joueur]]) { p.j.torse.getWorldPosition(vCible); o.position.x = vCible.x; o.position.z = vCible.z; }
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
    const chaud = etat.aide && dansFenetre; dernierePointe.copy(pointe); derniereBase.copy(base);
    const rampe = braise.copy(charge < .4 ? cBraise : charge < .75 ? cOrange : cOr);
    const couleurArme = chaud ? cAide : pare && tr < 300 ? cOr : (enCours || enFeinte) ? rampe : accent;
    const intensite = pare && tr < 300 ? 3.2 : chaud ? 3.0 : (enCours || enFeinte) ? .7 + 1.4 * charge : .6;
    matArme.emissive.copy(couleurArme); matArme.emissiveIntensity = intensite;
    const chaleur = chaud || (pare && tr < 300) ? 1 : (enCours || enFeinte) ? Math.min(1, charge * 1.15) : 0;
    uChaleur.uChaleur.value = (enCours || enFeinte || (pare && tr < 300)) ? 1 : chaleur;
    for (const m of matsLame) m.envMapIntensity = .6 * (1 - uChaleur.uChaleur.value);
    const vise2 = (an === ANIMS.estoc || an === ANIMS.tir) && (enCours || enFeinte) && t > a.preavis * .45;
    reflet.material.opacity = vise2 ? .55 + .45 * Math.sin(reel / 60) : 0; if (vise2) { reflet.position.copy(pointe); reflet.scale.setScalar(armeCourante === 'dague' ? .1 + .12 * charge : .22 + .3 * charge); reflet.material.color.copy(chaud ? cAide : cOr); }
    uHalo.couleur.value.copy(couleurArme); if (chaud) uHalo.couleur.value.lerp(blanc, .08 + .08 * Math.sin(reel / 45));
    const pas = charge < .4 ? 1.6 : charge < .75 ? 2.8 : 6; uHalo.force.value = chaud ? 2.2 + .8 * Math.sin(reel / 45) : pare && tr < 120 ? 2 * (1 - tr / 120) : (enCours || enFeinte) ? pas * .6 : 0;
    silhouette.uniforms.couleur.value.copy(uHalo.couleur.value); silhouette.uniforms.force.value = uHalo.force.value; silhouette.uniforms.sombre.value = Math.max(chaleur, chaud ? 1 : 0, (enCours || enFeinte) ? .6 : 0);
    lueurArme.color.copy(couleurArme); lueurArme.intensity = intensite * .6; lueurArme.position.copy(pointe);
    const cibleVisible = (enCours || enFeinte) && !aveugle && a.preavis > 0;
    matCible.opacity = 0; cible.visible = false;
    if (cibleVisible || (pare && tr < 200)) { cible.position.copy(pointe); const k = cibleVisible ? .3 + .75 * Math.pow(1 - charge, 1.3) : .3 + tr / 250; cible.scale.set(k, k, 1); matCible.color.copy(chaud || pare ? blanc : accent); }
    const bouge = (enCours && t > a.preavis - (an.frappe || 90) - 20) || (a.phase === 'resolu' && tr < 80);
    if ((bouge || (pare && tr < 400)) && pointe.distanceTo(dernierEchantillon) > .03) { echantillonnerTrainee(now, pointe, vTmp.lerpVectors(base, pointe, .5)); dernierEchantillon.copy(pointe); }
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
    uTemps.value = reel / 1000; uPerso.uTempsP.value = reel / 1000;
    ciel.position.copy(camera.position);
    poussiere.rotation.y = reel / 60000; poussiere.position.y = Math.sin(reel / 4000) * .15; poussiere.position.x = Math.sin(reel / 9000) * .6;

    // ---- caméra : respire au repos, pousse vers l'arme pendant la garde, tremble à l'impact, orbite au K.O.
    let cam, zoom = (enCours || enFeinte) ? .07 * charge : 0;
    if (enCine && cine.type === 'ko') {
      const k = tc / 1600, ang = -.9 + k * 1.4; const cible = new THREE.Vector3(1.05 - .6, .9, -.1);
      cam = new THREE.Vector3(cible.x + Math.cos(ang) * 2.6, 1.3 - k * .4, cible.z + Math.sin(ang) * 2.6); vise.copy(cible);
    } else if (enCine && cine.type === 'intro') {
      const k = ease(tc / 2400); cam = new THREE.Vector3(1.05 + 1.8, 1.4, -.1 + 1.6).lerp(camBase, k); vise.copy(new THREE.Vector3(1.05, 1.2, -.1)).lerp(viseBase, k);
    } else {
      cam = camBase.clone().lerp(viseBase, zoom);
      cam.x += Math.sin(reel / 2600) * .04; cam.y += Math.sin(reel / 1900) * .03;
      vise.copy(viseBase).lerp(pointe, (enCours || enFeinte) ? .28 * Math.min(1, charge * 2) : 0);
      vNdc.copy(pointe).project(camera); recad += (Math.min(.5, Math.max(0, vNdc.y - .74)) - recad) * .08;
      const recule = ({ hallebarde: 1.1, faux: .7, marteau: .9, canne: .4, hache: .4 })[armeCourante] || 0; reculLisse += (recule - reculLisse) * .05;
      cam.addScaledVector(vTmp.subVectors(cam, viseBase).normalize(), reculLisse); cam.y += reculLisse * .3; vise.y += reculLisse * .22;
    }
    const te = reel - effet.t;
    matOnde.opacity = 0; eclatImpact.intensity = 0;
    if (effet.type && te >= 0 && te < 420) {
      const k = 1 - te / 420, s = te / 420;
      onde.scale.setScalar(.2 + s * 3.2); onde2.scale.setScalar(.2 + s * 2.2); matOnde.opacity = k * k * .3;
      if (effet.type === 'parry') {
        for (let i = 0; i < N; i++) { const v = vit[i]; pos[i * 3] = v.o.x + v.d.x * s; pos[i * 3 + 1] = v.o.y + v.d.y * s - 4.2 * s * s; pos[i * 3 + 2] = v.o.z + v.d.z * s; }
        etinc.geometry.attributes.position.needsUpdate = true; etinc.material.opacity = 0;
        for (let i = 0; i < N; i++) { const v = vit[i]; posT.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[i * 3] - v.d.x * .028, pos[i * 3 + 1] - (v.d.y - 8.4 * s) * .028, pos[i * 3 + 2] - v.d.z * .028], i * 6); }
        traits.geometry.attributes.position.needsUpdate = true; traits.material.opacity = k; traits.material.color.set(s < .25 ? '#fff3dc' : '#ffb35c');
        const ke = Math.max(0, 1 - te / 70); etoile.material.opacity = ke * .35; etoile.scale.setScalar(.08 + .14 * (1 - ke)); etoile.material.color.set('#ffc27a'); etoile.material.rotation = te * .004;
        flash.style.background = `rgba(255,253,242,${k * .12})`;
        eclatImpact.intensity = 0; matOnde.color.copy(blanc); entaille.material.opacity = 0;
        cam.add(vTmp.set((Math.random() - .5) * .05 * k, (Math.random() - .5) * .04 * k, .14 * k));
      } else {
        for (let i = 0; i < N; i++) { const v = vit[i]; pos[i * 3] = v.o.x + v.d.x * s * .5; pos[i * 3 + 1] = v.o.y + v.d.y * s * .5 - 1.2 * s * s; pos[i * 3 + 2] = v.o.z + v.d.z * s * .5; }
        etinc.geometry.attributes.position.needsUpdate = true; etinc.material.opacity = k * .8; etinc.material.color.set(effet.res === 'tot' ? '#8a9ac8' : '#ff5470');
        for (let i = 0; i < N; i++) { const v = vit[i]; posT.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[i * 3] - v.d.x * .04, pos[i * 3 + 1] - (v.d.y - 2.4 * s) * .04, pos[i * 3 + 2] - v.d.z * .04], i * 6); }
        traits.geometry.attributes.position.needsUpdate = true; traits.material.opacity = effet.res === 'tot' ? k * .4 : k; traits.material.color.set(effet.res === 'tot' ? '#9aa6d0' : '#ff6a5a');
        const ke = Math.max(0, 1 - te / 120); etoile.material.opacity = effet.res === 'tot' ? 0 : ke; etoile.material.color.set('#ff8a6a'); etoile.scale.setScalar(.3 + 1.2 * (1 - ke));
        const tot = effet.res === 'tot', vc = tot ? '76,88,140' : '230,34,58';
        flash.style.background = `radial-gradient(ellipse at center, rgba(${vc},0) 50%, rgba(${vc},${k * .6}) 100%)`;
        entaille.material.opacity = 0;
        eclatImpact.intensity = 8 * k; eclatImpact.color.set('#ff5470'); matOnde.color.set('#ff5470');
        cam.add(vTmp.set((Math.random() - .5) * .22 * k, (Math.random() - .5) * .16 * k, -.1 * k)); if (effet.res !== 'tot') cam.lerp(vise, .08 * k);
      }
    } else { etinc.material.opacity = 0; traits.material.opacity = 0; etoile.material.opacity = 0; entaille.material.opacity = 0; flash.style.background = 'transparent'; }
    bloom.strength = (effet.type === 'parry' && te >= 0 && te < 420) ? .45 + .08 * (1 - te / 420) : (enCine && cine.type === 'ko') ? .7 : .45;
    const fovVoulu = camForcee ? camera.fov : ({ hallebarde: 62, faux: 57, marteau: 59 })[armeCourante] || 50; if (Math.abs(camera.fov - fovVoulu) > .05) { camera.fov += (fovVoulu - camera.fov) * .05; camera.updateProjectionMatrix(); } // les armes longues élargissent le champ
    if (camForcee) { cam.copy(camForcee[0]); vise.copy(camForcee[1]); }
    camera.position.copy(cam); camera.lookAt(vise);
    bokeh.uniforms.focus.value += (camera.position.distanceTo(pointe) - bokeh.uniforms.focus.value) * .25;

    coupNom.textContent = coup && a.phase !== 'attente' ? coup.nom + (coup.frames ? ' · ' + coup.frames + 'f' : '') + (enFeinte ? ' · ?' : '') : '';
    if (silhouette.uniforms.force.value > 0 || silhouette.uniforms.sombre.value > 0) {
      const couleurFond = renderer.getClearColor(new THREE.Color()), alphaFond = renderer.getClearAlpha();
      scene.overrideMaterial = matMasque; camera.layers.set(1); renderer.setRenderTarget(rtMasque); renderer.setClearColor(0x000000, 1); renderer.clear();
      renderer.shadowMap.autoUpdate = false; renderer.render(scene, camera); renderer.shadowMap.autoUpdate = true;
      renderer.setRenderTarget(null); camera.layers.set(0); scene.overrideMaterial = null; renderer.setClearColor(couleurFond, alphaFond);
    } else { renderer.setRenderTarget(rtMasque); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.setRenderTarget(null); }
    composer.render();
  }

  function declencher(type, now) {
    effet = { type: type === 'riposte' ? 'parry' : type, t: now, res: arguments[2] };
    entaille.position.copy(joueur.groupe.position).add(vCible.set(.15, 1.25, .1));
    const axeLame = new THREE.Vector3().subVectors(dernierePointe, derniereBase); if (axeLame.lengthSq() > 0) axeLame.normalize();
    const nB = new THREE.Vector3(); if (jeu !== 'sf') nB.set(0, -1, 0).applyQuaternion(bouclier.getWorldQuaternion(new THREE.Quaternion()));
    const o = new THREE.Vector3(); if (jeu === 'sf') joueur.j.mainR.getWorldPosition(o).lerp(dernierePointe, .35); else { bouclier.localToWorld(o.set(0, -BOMBE - .04, 0)); const ab = vTmp.subVectors(dernierePointe, derniereBase), t2 = Math.max(0, Math.min(1, o.clone().sub(derniereBase).dot(ab) / (ab.lengthSq() || 1))); o.lerp(derniereBase.clone().addScaledVector(ab, t2), .6); }
    onde.position.set(o.x, HAUT_DALLE + .02, o.z); onde2.position.set(o.x, HAUT_DALLE + .025, o.z); eclatImpact.position.copy(o); etoile.position.copy(o);
    gelJusqua = now + (type === 'touche' ? 60 : 90); // hit-stop, plus court quand on encaisse
    if (type === 'touche' && bouclier.visible) abimer();
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = (Math.random() - .5) * Math.PI;
      const d = new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph) + .5, Math.sin(th) * Math.cos(ph));
      if (nB.lengthSq() > 0) d.addScaledVector(nB, -d.dot(nB) * .8).addScaledVector(nB, .45);
      if (axeLame.lengthSq() > 0) d.addScaledVector(axeLame, 1.4);
      vit[i] = { o, d: d.multiplyScalar(.9 + Math.random() * 1.7) };
    }
  }
  // cinématiques : 'intro' (le boss se présente, la caméra vient se placer), 'ko' (il s'effondre, la caméra orbite)
  function cinematique(type, now) { cine = { type, t: now }; if (type === 'intro') reparer(); }

  // banc d'essai et captures : caméra imposée, attente des modèles
  let camForcee = null;
  const objectif = fov => { camera.fov = fov; camera.updateProjectionMatrix(); };
  const vue = (pos, cible) => { camForcee = pos ? [new THREE.Vector3(...pos), new THREE.Vector3(...cible)] : null; };
  const pret = () => new Promise(r => { const i = setInterval(() => { if (joueur.rig && boss.rig) { clearInterval(i); r(); } }, 100); });
  return { setJeu, setAveugle, tick, declencher, cinematique, vue, objectif, pret, recaler: t => { effet.t = t; }, objets: { trainee, cible, boss, joueur } };
}
