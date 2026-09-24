// Parry — interface, entrées clavier/manette, modes Lab et Run. La scène 3D vit dans scene3d.js.
import { creerScene } from './scene3d.js';

const { F, fenetre, juger, stats, histogramme, tirerPreavis } = Moteur;
const { PARADES, JEUX, RELIQUES } = Data;
const $ = id => document.getElementById(id);
const CLE = 'parry.v1';

// ---- état persistant ---------------------------------------------------------
let sauve = { reglages: { decalageClavier: 0, decalageManette: 0, son: true, regle: true, replay: true }, sessions: [], runs: [], hi: {} };
try { const b = JSON.parse(localStorage.getItem(CLE)); if (b && b.reglages) { sauve = Object.assign(sauve, b); sauve.reglages = Object.assign({ regle: true, replay: true }, b.reglages); sauve.hi = b.hi || {}; } } catch (e) {}
function persister() { try { localStorage.setItem(CLE, JSON.stringify(sauve)); } catch (e) {} }

// ---- écrans ------------------------------------------------------------------
const ecrans = [...document.querySelectorAll('.ecran')];
let ecranCourant = 'accueil';
function aller(id) {
  ecranCourant = id;
  for (const e of ecrans) e.hidden = e.id !== id;
  if (id === 'accueil') { rendreHistorique(); document.documentElement.removeAttribute('data-jeu'); }
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-aller]').forEach(b => b.addEventListener('click', () => aller(b.dataset.aller)));

// ---- son : fichiers dans sfx/ s'ils existent, sinon synthèse -----------------
let ac = null;
let maitre = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); maitre = ac.createGain(); maitre.gain.value = (sauve.reglages.volume ?? 70) / 100; maitre.connect(ac.destination); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume(); return ac;
}
function bip(freq, duree, type, gain, glisse, delai) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (delai || 0);
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t + duree);
  g.gain.setValueAtTime(gain || .08, t); g.gain.exponentialRampToValueAtTime(.0001, t + duree);
  o.connect(g).connect(maitre); o.start(t); o.stop(t + duree + .02);
}
function bruit(duree, gain, passeHaut) {
  const c = audio(); if (!c) return;
  const n = Math.floor(c.sampleRate * duree), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = gain || .2;
  if (passeHaut) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = passeHaut; s.connect(f).connect(g); } else s.connect(g);
  g.connect(maitre); s.start();
}
// Synthèses « à la Melee » : la batte (claquement sec + thump), le trophée (arpège clair).
const synth = {
  tic: () => bip(1100, .04, 'square', .05),
  debut: () => bip(140, .12, 'sawtooth', .05),
  parry: () => { bruit(.04, .35, 2500); bip(3200, .03, 'square', .15, 1200); bip(180, .16, 'sine', .3, 50); },
  touche: () => { bip(90, .25, 'sawtooth', .12, 40); bruit(.12, .25); },
  victoire: () => [523, 659, 784, 1047, 1319].forEach((f, i) => bip(f, .22, 'sine', .12, null, i * .07)),
  manche: () => { bruit(.06, .5, 900); [110, 220, 330].forEach(f => bip(f, .9, 'triangle', .14, null, 0)); bip(1760, .5, 'sine', .08, 880, .05); },
  mort: () => [392, 311, 233, 175].forEach((f, i) => bip(f, .35, 'triangle', .12, null, i * .16)),
  yaaa: (rate) => voix(rate || 1),
};
// « YAAA » de synthèse : une voix (dent de scie + vibrato) qui glisse de /i/ vers /a/ à travers deux formants. Dépose sfx/yaaa.wav pour le vrai.
function voix(rate) {
  const c = audio(); if (!c) return; const t = c.currentTime, d = .75 / rate;
  const o = c.createOscillator(), v = c.createOscillator(), vg = c.createGain(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(230 * rate, t); o.frequency.exponentialRampToValueAtTime(300 * rate, t + d * .25); o.frequency.exponentialRampToValueAtTime(190 * rate, t + d);
  v.frequency.value = 6; vg.gain.value = 12 * rate; v.connect(vg).connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .05); g.gain.setValueAtTime(.5, t + d * .7); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  for (const [fi, fa] of [[300, 750], [2300, 1200]]) {
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(fi * rate, t); f.frequency.exponentialRampToValueAtTime(fa * rate, t + d * .2);
    o.connect(f).connect(g);
  }
  g.connect(maitre); o.start(t); v.start(t); o.stop(t + d + .05); v.stop(t + d + .05);
}
const fichiers = {};
async function chargerSfx(nom) {
  for (const ext of ['wav', 'mp3', 'ogg']) {
    try {
      const r = await fetch(`sfx/${nom}.${ext}`); if (!r.ok) continue;
      const c = audio(); if (!c) return;
      fichiers[nom] = await c.decodeAudioData(await r.arrayBuffer()); return;
    } catch (e) {}
  }
}
function jouer(nom, rate) {
  if (!sauve.reglages.son) return;
  const buf = fichiers[nom];
  if (buf) { const c = audio(); const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate || 1; s.connect(maitre); s.start(); }
  else synth[nom](rate);
}
const son = {};
for (const n of Object.keys(synth)) son[n] = rate => jouer(n, rate);
for (const n of ['sigma', 'sigma2']) synth[n] = () => {}; // banques de voix : fichiers seulement, jamais de synthèse
// La voix : le YAAA au naturel la première fois, ensuite le YAAA ou une tranche au hasard des clips sigma,
// pitchés vers l'aigu si on gagne, vers le grave si on perd. Une seule voix à la fois : tant qu'une joue, les autres sautent.
let yaaaEntendu = false, voixJusqua = 0;
function yaaa(gagne) {
  const now = performance.now(); if (now < voixJusqua) return;
  const rate = !yaaaEntendu ? 1 : gagne ? 1.15 + Math.random() * .6 : .55 + Math.random() * .35;
  const banques = ['sigma', 'sigma2'].filter(n => fichiers[n]);
  if (!yaaaEntendu || !banques.length || Math.random() < .4) { yaaaEntendu = true; voixJusqua = now + 1400 / rate; son.yaaa(rate); return; }
  yaaaEntendu = true;
  if (!sauve.reglages.son) return;
  const c = audio(), buf = fichiers[banques[Math.floor(Math.random() * banques.length)]];
  const duree = .9 + Math.random() * .7, depart = Math.random() * Math.max(0, buf.duration - duree - .1), t = c.currentTime;
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.playbackRate.value = rate;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(1, t + .03); g.gain.setValueAtTime(1, t + duree / rate - .08); g.gain.exponentialRampToValueAtTime(.0001, t + duree / rate);
  s.connect(g).connect(maitre); s.start(t, depart, duree); voixJusqua = now + duree / rate * 1000;
}
let sfxCharges = false;
function chargerTousSfx() { if (sfxCharges) return; sfxCharges = true; for (const n of Object.keys(synth)) chargerSfx(n); }

// ---- partie ------------------------------------------------------------------
let partie = null;   // { mode, jeu, parade, pool, n, jugements, aide, annonce, run }
let attaque = null;  // { coup, tDebut, preavis, impact, input, jugement, phase, tResolu, tics }
let prochainDebut = 0;
const scene = creerScene($('scene'), $('coup-nom'), $('flash'));
const pad6 = n => String(Math.max(0, Math.round(n))).padStart(6, '0');
const cleHi = () => partie.mode + '-' + partie.jeu.id;
let minuteurs = [];
function plusTard(fn, ms) { minuteurs.push(setTimeout(fn, ms)); }
function annuler() { minuteurs.forEach(clearTimeout); minuteurs = []; }
// Une annonce plein écran sur la borne : READY, FIGHT, K.O.
// Début de manche : un gros PARRY sur l'écran, le marquee clignote, puis l'étiquette (Round N / Ready ?), puis Fight.
function presenterBoss(boss) {
  const p = $('presentation'), nom = $('presentation-nom'), ligne = $('presentation-ligne');
  p.hidden = false; nom.textContent = ''; nom.className = 'presentation-nom'; ligne.textContent = boss.replique || ''; ligne.className = 'presentation-ligne';
  const lettres = [...boss.nom];
  lettres.forEach((l, i) => plusTard(() => { nom.textContent += l; if (i === lettres.length - 1) { nom.classList.add('fini'); ligne.classList.add('visible'); } }, 45 * i));
}
function lancerManche(etiquette) {
  annoncer('Parry', 'titre'); son.manche();
  if (partie.boss) plusTard(() => presenterBoss(partie.boss), 350); else $('presentation').hidden = true;
  plusTard(() => { $('presentation').hidden = true; }, 2450);
  const cab = document.querySelector('.cabinet'); cab.classList.remove('manche'); void cab.offsetWidth; cab.classList.add('manche');
  plusTard(() => annoncer(etiquette, 'tient'), 1100);
  plusTard(() => { annoncer('Fight !'); planifier(performance.now() + 500); }, 2500);
}
function annoncer(texte, style) {
  const e = $('annonce-ecran'); e.className = 'annonce'; e.textContent = texte;
  void e.offsetWidth; e.classList.add(style || 'claque');
}

const multPreavis = () => partie.run ? partie.run.preavisMult : 1;
// coupForce / preavisForce / restant servent aux enchaînements : le coup suivant part sans tirage ni pause.
function nouvelleAttaque(now, coupForce, preavisForce, restant) {
  const coup = coupForce || partie.pool[Math.floor(Math.random() * partie.pool.length)];
  const preavis = preavisForce != null ? preavisForce : tirerPreavis(coup, multPreavis());
  const feinte = !coupForce && !!coup.feinte;
  attaque = { coup, tDebut: now, preavis, impact: now + preavis, input: null, jugement: null, phase: feinte ? 'feinte' : 'preavis', tResolu: 0,
    restant: restant || (coup.enchaine ? coup.enchaine.map(ms => ms * multPreavis()) : []) };
  son.debut();
  $('verdict-mot').textContent = ' '; $('verdict-mot').className = 'verdict-mot';
  $('verdict-ms').textContent = ' ';
}

function planifier(now) {
  // Une attente aléatoire, précédée de trois tics si l'annonce est active.
  const attente = 900 + Math.random() * 1500;
  prochainDebut = now + attente;
  attaque = { phase: 'attente', annonceA: prochainDebut - 1500, tics: partie.annonce ? [prochainDebut - 1500, prochainDebut - 1000, prochainDebut - 500] : [] };
}

function appui(T, source) {
  if (ecranCourant !== 'jeu' || !partie || !attaque) return;
  const decalage = source === 'manette' ? sauve.reglages.decalageManette : sauve.reglages.decalageClavier;
  T -= decalage;
  if (attaque.phase === 'attente') {
    // Appui à vide : compté comme « tôt » seulement si un coup est annoncé.
    if (!partie.annonce || T < attaque.annonceA) return;
    attaque = { coup: partie.pool[0], tDebut: prochainDebut, preavis: 0, impact: prochainDebut, input: T, phase: 'preavis', jugement: null, vide: true };
    return;
  }
  if (attaque.phase === 'feinte') { if (attaque.input == null) attaque.input = T; return; } // baited
  if (attaque.phase === 'replay') { attaque.saut = true; return; }
  if (attaque.phase === 'resolu') { if (attaque.riposteJusqua && !attaque.riposte && T <= attaque.riposteJusqua) riposter(T); return; }
  if (attaque.phase !== 'preavis' || attaque.input != null) return;
  if (T > attaque.impact + 100) return;
  attaque.input = T;
}

function resoudre(now) {
  const a = attaque;
  const parade = partie.parade, bonus = partie.run ? partie.run.bonusFrames : 0;
  if (a.phase === 'feinte') {
    a.jugement = { resultat: 'feinte', ecart: null }; // on a mordu à la feinte : le boss punit
  } else if (a.vide) {
    // On a mashé avant le coup : le coup part quand même et touche.
    const preavis = tirerPreavis(a.coup, partie.run ? partie.run.preavisMult : 1);
    a.jugement = { resultat: 'tot', ecart: a.input - (a.tDebut + fenetre(preavis, parade, bonus).centre) };
    a.preavis = preavis; a.impact = a.tDebut + preavis;
  } else {
    a.jugement = juger(a.input == null ? null : a.input - a.tDebut, a.preavis, parade, bonus);
  }
  a.phase = 'resolu'; a.tResolu = now;
  partie.jugements.push(Object.assign({ coup: a.coup.nom }, a.jugement));
  const ok = a.jugement.resultat === 'parry';
  const perfect = ok && Math.abs(a.jugement.ecart) < F;
  scene.declencher(ok ? 'parry' : 'touche', now, attaque.jugement && attaque.jugement.resultat);
  ok ? son.parry() : son.touche();
  if (perfect) plusTard(() => yaaa(true), 120); else if (!ok) plusTard(() => yaaa(false), 200);
  // score arcade : 100 par parade, 300 si parfaite, multiplié par le combo (jusqu'à x8)
  if (ok) { partie.combo++; partie.score += (perfect ? 300 : 100) * Math.min(8, partie.combo); partie.maxCombo = Math.max(partie.maxCombo, partie.combo); }
  else partie.combo = 0;
  if (perfect) a.riposteJusqua = now + 300; // un second appui dans les 300 ms = critique
  afficherVerdict(a.jugement, a.preavis, perfect);
  if (partie.run) { if (ok) partie.run.bossPv--; else partie.run.vies--; }
  rendreHud();
}

// Riposte : après un parry parfait, un second appui dans la fenêtre inflige un critique.
function riposter(T) {
  const a = attaque; a.riposte = true;
  partie.score += 500 * Math.min(8, partie.combo); partie.ripostes = (partie.ripostes || 0) + 1;
  if (partie.run) partie.run.bossPv = Math.max(0, partie.run.bossPv - 1);
  scene.declencher('riposte', performance.now()); son.parry();
  const m = $('verdict-mot'); m.textContent = 'Riposte'; m.className = 'verdict-mot riposte'; void m.offsetWidth; m.classList.add('claque');
  $('verdict-ms').textContent = 'critique · +' + (500 * Math.min(8, partie.combo));
  rendreHud();
}
function afficherVerdict(j, preavis, perfect) {
  const mots = { parry: 'Parry', tot: 'Early', tard: 'Late', touche: 'Hit', feinte: 'Baited' };
  const m = $('verdict-mot'); m.textContent = perfect ? 'Perfect' : mots[j.resultat]; m.className = 'verdict-mot ' + (perfect ? 'perfect' : j.resultat === 'feinte' ? 'touche' : j.resultat);
  void m.offsetWidth; m.classList.add('claque');
  $('verdict-ms').textContent = (j.resultat === 'feinte' ? 'feinte' : j.ecart == null ? 'aucun appui' : (j.ecart > 0 ? '+' : '') + Math.round(j.ecart) + ' ms') + (perfect ? ' · riposte ?' : '');
  rendreRegle(j, preavis);
}

function rendreRegle(j, preavis) {
  const f = fenetre(preavis, partie.parade, partie.run ? partie.run.bonusFrames : 0);
  const borne = 300, W = 600, x = ms => W / 2 + (ms / borne) * (W / 2);
  const o = Math.max(0, x(f.ouvre - f.centre)), fe = Math.min(W, x(f.ferme - f.centre));
  let s = `<line x1="0" y1="22" x2="${W}" y2="22" stroke="#2c2338" stroke-width="2"/>`;
  s += `<rect x="${o}" y="10" width="${fe - o}" height="24" rx="3" fill="var(--accent)" opacity=".35"/>`;
  s += `<line x1="${W / 2}" y1="6" x2="${W / 2}" y2="38" stroke="#a9959f" stroke-width="1"/>`;
  s += `<text x="4" y="42" font-size="10" fill="#a9959f" font-family="JetBrains Mono">-${borne} ms</text>`;
  s += `<text x="${W - 4}" y="42" font-size="10" fill="#a9959f" text-anchor="end" font-family="JetBrains Mono">+${borne} ms</text>`;
  if (j.ecart != null) {
    const px = Math.max(3, Math.min(W - 3, x(j.ecart)));
    const coul = { parry: '#F5E9E2', tot: '#F7A366', tard: '#9b5cf0' }[j.resultat];
    s += `<circle cx="${px}" cy="22" r="6" fill="${coul}"/>`;
  }
  $('regle').innerHTML = s;
}

function rendreHud() {
  const b = partie.boss;
  $('hud-boss').textContent = b ? b.nom : 'Tous les boss';
  $('hud-titre').textContent = b ? b.titre : partie.jeu.nom;
  $('hud-score').textContent = pad6(partie.score);
  $('hud-hi').textContent = pad6(Math.max(sauve.hi[cleHi()] || 0, partie.score));
  $('combo').textContent = partie.combo > 1 ? partie.combo + ' combo' : '';
  if (partie.run) {
    $('hud-pv').innerHTML = Array.from({ length: partie.run.bossPvMax }, (_, i) => `<i class="${i < partie.run.bossPv ? '' : 'vide'}"></i>`).join('');
    $('hud-vies').innerHTML = Array.from({ length: Math.max(partie.run.vies, partie.run.viesMax) }, (_, i) => `<i class="${i < partie.run.vies ? '' : 'vide'}"></i>`).join('');
    $('hud-compteur').textContent = 'étage ' + partie.run.etage;
  } else {
    $('hud-pv').innerHTML = ''; $('hud-vies').innerHTML = '';
    $('hud-compteur').textContent = partie.jugements.length + ' / ' + partie.n;
  }
}

// ---- boucle -------------------------------------------------------------------
let boutonsPrec = new Map();
function sonderManettes(now) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let vue = false;
  for (const gp of gps) {
    if (!gp) continue; vue = true;
    const prec = boutonsPrec.get(gp.index) || [];
    const etat = gp.buttons.map(b => b.pressed);
    for (let i = 0; i < etat.length; i++) if (etat[i] && !prec[i]) {
      // gp.timestamp date la dernière mise à jour : plus précis que l'instant du sondage.
      const T = gp.timestamp && now - gp.timestamp < 100 ? gp.timestamp : now;
      if (ecranCourant === 'continue') reprendre(); else appui(T, 'manette');
    }
    boutonsPrec.set(gp.index, etat);
  }
  return vue;
}

let derniereFrame = 0;
function avancer(now) {
  const manette = sonderManettes(now);
  if (ecranCourant === 'accueil') $('manette-etat').textContent = manette ? 'Manette détectée.' : 'Aucune manette détectée (appuie sur un bouton).';
  if (ecranCourant !== 'jeu' || !partie) return;
  if (attaque.phase === 'attente') {
    while (attaque.tics.length && now >= attaque.tics[0]) { attaque.tics.shift(); son.tic(); }
    if (now >= prochainDebut) nouvelleAttaque(now);
  } else if (attaque.phase === 'feinte') {
    if (attaque.input != null) resoudre(now);
    else if (now >= attaque.impact) {
      // la feinte est passée sans appui : le vrai coup part, court
      const a = attaque, p = a.coup.suite * multPreavis();
      attaque = { coup: a.coup, tDebut: now, preavis: p, impact: now + p, input: null, jugement: null, phase: 'preavis', tResolu: 0, restant: a.restant, apresFeinte: true };
      son.debut();
    }
  } else if (attaque.phase === 'preavis') {
    if (now >= attaque.impact && (attaque.input != null || now >= attaque.impact + 100)) resoudre(now);
  } else if (attaque.phase === 'resolu') {
    const dt = now - attaque.tResolu, a = attaque;
    const rate = a.jugement && ['tot', 'tard', 'touche'].includes(a.jugement.resultat) && !a.vide;
    if (dt > 750 && rate && sauve.reglages.replay) { a.phase = 'replay'; a.tReplay = now; $('replay-etiquette').hidden = false; document.querySelector('.verre').classList.add('en-replay'); }
    else apresResolution(now, dt);
  } else if (attaque.phase === 'replay') {
    // 750 ms de jeu rejouées à ¼ : de 600 ms avant l'impact à 150 ms après
    if (attaque.saut || now - attaque.tReplay > 3000) { $('replay-etiquette').hidden = true; document.querySelector('.verre').classList.remove('en-replay'); attaque.phase = 'resolu'; attaque.tResolu = now - 751; apresResolution(now, 751); }
  }
}
// La barre de temps du coup (option) : se remplit du départ à l'impact, la fenêtre de parade marquée dessus.
function rendreChrono(t, a) {
  const barre = $('chrono-barre');
  const actif = partie.chrono && (a.phase === 'preavis' || a.phase === 'feinte') && a.preavis > 0 && !a.vide;
  barre.hidden = !actif; if (!actif) return;
  const f = fenetre(a.preavis, partie.parade, partie.run ? partie.run.bonusFrames : 0);
  $('chrono-fenetre').style.left = (f.ouvre / a.preavis * 100) + '%'; $('chrono-fenetre').style.width = ((f.ferme - f.ouvre) / a.preavis * 100) + '%';
  $('chrono-curseur').style.left = Math.min(100, (t - a.tDebut) / a.preavis * 100) + '%';
  barre.classList.toggle('feinte', a.phase === 'feinte');
}
function apresResolution(now, dt) {
  const a = attaque;
  const fini = partie.run ? (partie.run.vies <= 0 || partie.run.bossPv <= 0) : partie.jugements.length >= partie.n;
  if (!fini && a.restant && a.restant.length && dt > 160) nouvelleAttaque(now, a.coup, a.restant[0], a.restant.slice(1));
  else if (dt > 750) suite(now);
}
function boucle() {
  const now = derniereFrame = performance.now();
  avancer(now);
  if (ecranCourant === 'jeu' && partie) {
    let a = attaque, t = now, aide = partie.aide;
    if (a.phase === 'replay') {
      // on rejoue l'attaque telle quelle, au ralenti, la fenêtre allumée sur l'arme
      t = a.impact - 600 + (now - a.tReplay) * .25; aide = true;
      a = t < a.impact ? Object.assign({}, a, { phase: 'preavis' }) : Object.assign({}, a, { phase: 'resolu', tResolu: a.impact });
    }
    rendreChrono(t, a);
    scene.tick(t, { attaque: a, aide, fenetre: a.preavis ? fenetre(a.preavis, partie.parade, partie.run ? partie.run.bonusFrames : 0) : null,
      armeRepos: partie.boss ? partie.boss.arme : partie.pool[0].arme, boss: partie.boss && partie.boss.id });
  }
  if (!window.__fige) requestAnimationFrame(boucle);
}
// Si le navigateur gèle rAF (onglet non peint), la logique avance quand même.
setInterval(() => { if (window.__fige) return; const now = performance.now(); if (now - derniereFrame > 120) avancer(now); }, 40);

function suite(now) {
  if (partie.run) {
    const r = partie.run;
    if (r.vies <= 0) { attaque = { phase: 'fin' }; annoncer('K.O.'); son.mort(); plusTard(() => yaaa(false), 350); plusTard(proposerContinue, 1100); return; }
    if (r.bossPv <= 0) { attaque = { phase: 'fin' }; scene.cinematique('ko', performance.now()); plusTard(() => annoncer('K.O.'), 500); son.victoire(); plusTard(() => yaaa(true), 600); plusTard(bossVaincu, 1700); return; }
  } else if (partie.jugements.length >= partie.n) { attaque = { phase: 'fin' }; annoncer('Time', 'tient'); plusTard(finLab, 900); return; }
  planifier(now);
}

// ---- entrées -----------------------------------------------------------------
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (!$('tuto').hidden) { if (e.key === 'Escape') fermerTuto(); return; }
  if (e.key === 'Escape') { if (ecranCourant === 'jeu' || ecranCourant === 'continue') { annuler(); partie = null; aller('accueil'); } return; }
  if (ecranCourant === 'continue') { if (e.key !== 'Tab') reprendre(); return; }
  if (ecranCourant !== 'jeu') return;
  if (e.key === 'Tab' || e.key.startsWith('F') && e.key.length > 1 || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === ' ') e.preventDefault();
  audio();
  appui(e.timeStamp, 'clavier');
});
$('scene').addEventListener('pointerdown', e => { audio(); appui(e.timeStamp, 'clavier'); });
document.querySelectorAll('.bouton').forEach(b => b.addEventListener('pointerdown', e => { audio(); if (ecranCourant === 'continue') reprendre(); else appui(e.timeStamp, 'clavier'); }));
document.addEventListener('pointerdown', () => { audio(); chargerTousSfx(); }, { once: true });
window.addEventListener('keydown', () => { audio(); chargerTousSfx(); }, { once: true });

// ---- config ------------------------------------------------------------------
let config = { mode: 'lab', jeu: 'er' };
document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { config.mode = b.dataset.mode; ouvrirConfig(); }));
document.querySelectorAll('#choix-jeu .pastille').forEach(b => b.addEventListener('click', () => { config.jeu = b.dataset.jeu; remplirConfig(); }));

function ouvrirConfig() {
  $('config-titre').textContent = config.mode === 'lab' ? 'Lab' : 'Run';
  const run = config.mode === 'run';
  $('champ-cible').hidden = run; $('champ-nb').hidden = run; $('champ-aide').hidden = run; $('champ-freerun').hidden = !run;
  remplirConfig(); aller('config');
}
function remplirConfig() {
  document.documentElement.dataset.jeu = config.jeu;
  document.querySelectorAll('#choix-jeu .pastille').forEach(b => b.setAttribute('aria-pressed', b.dataset.jeu === config.jeu));
  const jeu = JEUX[config.jeu];
  $('parade').innerHTML = PARADES[config.jeu].map(p =>
    `<option value="${p.id}">${p.nom} · ${p.startup}+${p.actifs}f (${Math.round(p.actifs * F)} ms)${p.approx ? ' ≈' : ''}</option>`).join('');
  $('cible').innerHTML = `<option value="">Tous les boss</option>` + jeu.bosses.map(b => `<option value="${b.id}">${b.nom}</option>`).join('');
  $('annonce').checked = config.jeu === 'sf';
  $('champ-annonce').hidden = config.mode === 'run';
  $('config-note').textContent = {
    sf: 'Le Perfect Parry fait 2 frames. Seul le Drive Impact (26f, 433 ms) se réagit ; le reste se pare sur un read, d’où les tics. Les startups marqués ≈ sont de mémoire, corrige-les dans data.js.',
    er: 'Frames de parade relevées sur le guide Steam « Parry Frame Data 1.17.1 » ; les préavis des boss, eux, sont estimés (≈). Un coup « retardé » tient sa garde plus longtemps : attends la lame, pas le rythme. Certains coups sont des feintes : le boss arme, retient, puis frappe court. En run, les tics sont une relique.',
    ar: 'Le roster maison : hallebarde, marteau, faux, AK-47, et un duel qui change d’arme à chaque coup. Feintes et enchaînements partout. Tout est inventé, donc ≈.',
  }[config.jeu];
}
$('entrer').addEventListener('click', () => {
  audio(); chargerTousSfx();
  const jeu = JEUX[config.jeu];
  const parade = PARADES[config.jeu].find(p => p.id === $('parade').value) || PARADES[config.jeu][0];
  if (config.mode === 'lab') {
    const boss = jeu.bosses.find(b => b.id === $('cible').value) || null;
    demarrerLab(jeu, parade, boss, +$('nb').value, $('aide').checked, $('annonce').checked);
  } else demarrerRun(jeu, parade, $('freerun').checked);
  partie.chrono = $('chrono').checked;
  scene.setAveugle($('aveugle').checked);
});

function preparerJeu(jeu) {
  annuler();
  document.documentElement.dataset.jeu = jeu.id;
  scene.setJeu(jeu.id);
  $('annonce-ecran').className = 'annonce';
  $('regle').hidden = !sauve.reglages.regle; $('replay-etiquette').hidden = true; $('presentation').hidden = true; document.querySelector('.verre').classList.remove('en-replay');
  document.documentElement.dataset.parade = partie.parade.id;
  $('regle').innerHTML = ''; $('verdict-mot').textContent = ' '; $('verdict-mot').className = 'verdict-mot'; $('verdict-ms').textContent = ' ';
  rendreHud();
}

// ---- Lab ---------------------------------------------------------------------
function demarrerLab(jeu, parade, boss, n, aide, annonce) {
  partie = { mode: 'lab', jeu, parade, boss, n, aide, annonce, jugements: [], run: null, score: 0, combo: 0, maxCombo: 0,
    pool: boss ? boss.coups : jeu.bosses.flatMap(b => b.coups) };
  preparerJeu(jeu);
  aller('jeu'); attaque = { phase: 'fin' };
  scene.cinematique('intro', performance.now());
  lancerManche('Ready ?');
}
function finLab() {
  const s = stats(partie.jugements);
  const session = { date: Date.now(), jeu: partie.jeu.id, cible: partie.boss ? partie.boss.nom : 'Tous', parade: partie.parade.id,
    n: s.n, taux: s.taux, moyenne: s.moyenne, sigma: s.sigma, aide: partie.aide, score: partie.score };
  sauve.sessions.push(session); if (sauve.sessions.length > 200) sauve.sessions.shift();
  const record = enregistrerHi();
  $('res-contexte').textContent = `${partie.jeu.nom} · ${session.cible} · ${partie.parade.nom} · ${s.n} coups · combo max ${partie.maxCombo}` + (partie.ripostes ? ` · ${partie.ripostes} riposte${partie.ripostes > 1 ? 's' : ''}` : '') + (record ? ' · NOUVEAU HI-SCORE' : '');
  $('res-score').textContent = pad6(partie.score);
  $('res-taux').textContent = Math.round(s.taux * 100) + ' %';
  $('res-moyenne').textContent = s.moyenne == null ? '—' : (s.moyenne > 0 ? '+' : '') + Math.round(s.moyenne) + ' ms';
  $('res-sigma').textContent = s.sigma == null ? '—' : '±' + Math.round(s.sigma) + ' ms';
  $('res-meilleur').textContent = s.meilleur == null ? '—' : Math.round(s.meilleur) + ' ms';
  $('res-lecture').textContent = lecture(s, partie);
  rendreHisto(partie.jugements.map(j => j.ecart));
  const p = partie; $('encore').onclick = () => demarrerLab(p.jeu, p.parade, p.boss, p.n, p.aide, p.annonce);
  aller('resultats');
}
function enregistrerHi() {
  const k = cleHi(), record = partie.score > (sauve.hi[k] || 0);
  if (record) sauve.hi[k] = partie.score;
  persister(); return record;
}
function lecture(s, p) {
  const f = fenetre(1000, p.parade, p.run ? p.run.bonusFrames : 0);
  const l = Math.round(f.largeur);
  if (s.moyenne == null) return 'Aucun appui enregistré. La fenêtre fait ' + l + ' ms : commence avec l’anneau.';
  const phr = [];
  if (s.biais === 'tot') phr.push('Tu pares trop tôt : ton appui part avant la fenêtre.');
  else if (s.biais === 'tard') phr.push('Tu pares trop tard : ton appui part après la fenêtre.');
  else phr.push('Ton timing est centré.');
  if (s.sigma != null) phr.push(s.sigma > l ? `Ta dispersion (±${Math.round(s.sigma)} ms) dépasse la fenêtre (${l} ms) : le problème est la régularité, pas le biais.`
    : `Ta dispersion (±${Math.round(s.sigma)} ms) tient dans la fenêtre (${l} ms).`);
  if (p.aide && !p.run) phr.push('Refais la même session sans l’anneau.');
  return phr.join(' ');
}
function rendreHisto(ecarts) {
  const pas = 20, borne = 300, h = histogramme(ecarts, pas, borne), max = Math.max(1, ...h);
  const W = 600, H = 120, w = W / h.length;
  const f = fenetre(1000, partie.parade, partie.run ? partie.run.bonusFrames : 0), x = ms => W / 2 + ms / borne * W / 2;
  let s = `<rect x="${x(f.ouvre - f.centre)}" y="0" width="${x(f.ferme - f.centre) - x(f.ouvre - f.centre)}" height="${H}" fill="var(--accent)" opacity=".18"/>`;
  h.forEach((v, i) => { const bh = v / max * (H - 24); const c = i * pas - borne + pas / 2; s += `<rect x="${i * w + 1}" y="${H - 16 - bh}" width="${w - 2}" height="${bh}" fill="${c < f.ouvre - f.centre ? '#F7A366' : c > f.ferme - f.centre ? '#9b5cf0' : '#F5E9E2'}"/>`; });
  s += `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H - 16}" stroke="#a9959f" stroke-dasharray="3 3"/>`;
  s += `<text x="4" y="${H - 4}" font-size="10" fill="#a9959f" font-family="JetBrains Mono">tôt</text><text x="${W - 4}" y="${H - 4}" font-size="10" fill="#a9959f" text-anchor="end" font-family="JetBrains Mono">tard</text>`;
  $('histo').innerHTML = s;
}

// ---- Run ---------------------------------------------------------------------
function demarrerRun(jeu, parade, freerun) {
  const run = { vies: freerun ? 9 : 3, viesMax: freerun ? 9 : 3, freerun: !!freerun, bonusFrames: 0, aide: false, preavisMult: 1, estoc: 0, annonce: jeu.id === 'sf', etage: 0, reliques: [], bossPv: 0, bossPvMax: 0, continues: 0 };
  partie = { mode: 'run', jeu, parade, boss: null, n: 0, aide: false, annonce: run.annonce, jugements: [], run, pool: [], score: 0, combo: 0, maxCombo: 0 };
  prochainBoss();
}
function prochainBoss() {
  const r = partie.run; r.etage++;
  const boss = partie.jeu.bosses[r.etage - 1];
  if (!boss) return finRun(true);
  partie.boss = boss; partie.pool = boss.coups; partie.aide = r.aide; partie.annonce = r.annonce;
  r.bossPvMax = boss.pv; r.bossPv = Math.max(1, boss.pv - r.estoc);
  preparerJeu(partie.jeu);
  aller('jeu'); attaque = { phase: 'fin' };
  scene.cinematique('intro', performance.now());
  lancerManche('Round ' + r.etage);
}
function proposerContinue() {
  const r = partie.run;
  if (r.continues >= 3) return finRun(false);
  aller('continue');
  let n = 9; $('continue-compte').textContent = n;
  const tic = setInterval(() => { n--; $('continue-compte').textContent = n; son.tic(); if (n <= 0) { clearInterval(tic); if (ecranCourant === 'continue') finRun(false); } }, 1000);
  minuteurs.push(tic);
}
function reprendre() {
  const r = partie.run; annuler();
  r.vies = r.viesMax; r.continues++; partie.combo = 0;
  preparerJeu(partie.jeu);
  aller('jeu'); attaque = { phase: 'fin' };
  lancerManche('Continue');
}
$('continuer').addEventListener('click', reprendre);
$('abandonner').addEventListener('click', () => { annuler(); finRun(false); });
function bossVaincu() {
  const r = partie.run;
  $('relique-titre').textContent = partie.boss.nom + ' tombe';
  const dispo = RELIQUES.filter(q => !(q.id === 'oeil' && r.aide) && !(q.id === 'metronome' && r.annonce));
  const tirage = dispo.sort(() => Math.random() - .5).slice(0, 3);
  $('reliques').innerHTML = tirage.map((q, i) => `<button class="relique" data-i="${i}"><b>${q.nom}</b><span>${q.texte}</span></button>`).join('');
  $('reliques').querySelectorAll('.relique').forEach(b => b.addEventListener('click', () => {
    const q = tirage[+b.dataset.i]; q.appliquer(r); r.reliques.push(q.nom); prochainBoss();
  }));
  aller('relique');
  $('reliques').querySelector('.relique').focus();
}
function finRun(victoire) {
  const r = partie.run, s = stats(partie.jugements);
  if (victoire) son.victoire();
  const etage = victoire ? partie.jeu.bosses.length : r.etage;
  sauve.runs.push({ date: Date.now(), jeu: partie.jeu.id, etage, victoire, taux: s.taux, score: partie.score }); if (sauve.runs.length > 100) sauve.runs.shift();
  const record = enregistrerHi();
  $('fin-titre').textContent = (victoire ? 'Tous les boss sont tombés' : 'Game over') + (record ? ' · nouveau hi-score' : '');
  $('fin-score').textContent = pad6(partie.score);
  $('fin-contexte').textContent = victoire ? `${partie.jeu.nom} · ${partie.parade.nom}` : `${partie.boss.nom} · ${partie.jeu.nom} · ${partie.parade.nom}`;
  $('fin-etage').textContent = etage + ' / ' + partie.jeu.bosses.length;
  $('fin-taux').textContent = Math.round(s.taux * 100) + ' %';
  $('fin-moyenne').textContent = s.moyenne == null ? '—' : (s.moyenne > 0 ? '+' : '') + Math.round(s.moyenne) + ' ms';
  $('fin-reliques').textContent = (r.reliques.length ? r.reliques.join(', ') : 'aucune') + (r.continues ? ` · ${r.continues} continue${r.continues > 1 ? 's' : ''}` : '');
  $('fin-lecture').textContent = lecture(s, partie);
  const p = partie; $('refaire').onclick = () => demarrerRun(p.jeu, p.parade);
  aller('fin');
}

// ---- historique --------------------------------------------------------------
function rendreHistorique() {
  const noms = { 'lab-er': 'Lab · Elden Ring', 'lab-ar': 'Lab · Arcade', 'lab-sf': 'Lab · SF6', 'run-er': 'Run · Elden Ring', 'run-ar': 'Run · Arcade', 'run-sf': 'Run · SF6' };
  $('hiscores').innerHTML = Object.keys(noms).map(k => `<li><span>${noms[k]}</span><b>${pad6(sauve.hi[k] || 0)}</b></li>`).join('');
  const ss = sauve.sessions.slice(-30);
  const svg = $('tendance');
  if (ss.length < 2) svg.innerHTML = `<text x="0" y="36" font-size="12" fill="#a9959f" font-family="Archivo">Deux sessions et la courbe apparaît.</text>`;
  else {
    const pts = ss.map((s, i) => `${(i / (ss.length - 1)) * 300},${58 - s.taux * 54}`).join(' ');
    svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/>`
      + ss.map((s, i) => `<circle cx="${(i / (ss.length - 1)) * 300}" cy="${58 - s.taux * 54}" r="2.5" fill="#F5E9E2"/>`).join('');
  }
  $('historique').innerHTML = sauve.sessions.slice(-8).reverse().map(s =>
    `<li><b>${JEUX[s.jeu].nom} · ${s.cible}</b><span>${s.moyenne == null ? '—' : (s.moyenne > 0 ? '+' : '') + Math.round(s.moyenne) + ' ms'}</span><span class="taux">${Math.round(s.taux * 100)} %</span></li>`).join('')
    || '<li><span>Aucune session encore.</span></li>';
  const meilleures = Object.values(JEUX).map(j => {
    const rs = sauve.runs.filter(r => r.jeu === j.id); if (!rs.length) return null;
    return `${j.nom} : étage ${Math.max(...rs.map(r => r.etage))} / ${j.bosses.length}`;
  }).filter(Boolean);
  $('meilleure-run').textContent = meilleures.length ? 'Meilleures runs — ' + meilleures.join(' · ') : '';
}

// ---- réglages ----------------------------------------------------------------
for (const id of ['decalageClavier', 'decalageManette']) {
  $(id).value = sauve.reglages[id];
  $(id).addEventListener('change', () => { sauve.reglages[id] = +$(id).value || 0; persister(); });
}
$('volume').value = sauve.reglages.volume ?? 70; $('volume-val').textContent = $('volume').value;
$('volume').addEventListener('input', () => { sauve.reglages.volume = +$('volume').value; $('volume-val').textContent = $('volume').value; if (maitre) maitre.gain.value = sauve.reglages.volume / 100; persister(); });
for (const id of ['son', 'regle', 'replay']) {
  $(id).checked = sauve.reglages[id];
  $(id).addEventListener('change', () => { sauve.reglages[id] = $(id).checked; persister(); });
}

// ---- aide : une bulle sous l'élément survolé ou focalisé, un tutoriel au premier lancement
const bulle = $('bulle');
function montrerBulle(el) {
  const r = el.getBoundingClientRect(); bulle.textContent = el.dataset.aide; bulle.hidden = false;
  const w = Math.min(300, window.innerWidth - 32);
  bulle.style.left = Math.max(16, Math.min(window.innerWidth - w - 16, r.left)) + 'px';
  bulle.style.top = (r.bottom + 8 + bulle.offsetHeight > window.innerHeight ? r.top - bulle.offsetHeight - 8 : r.bottom + 8) + 'px';
}
for (const ev of ['mouseenter', 'focus']) document.addEventListener(ev, e => { const el = e.target.closest && e.target.closest('[data-aide]'); if (el) montrerBulle(el); }, true);
for (const ev of ['mouseleave', 'blur']) document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('[data-aide]')) bulle.hidden = true; }, true);

let etapeTuto = 1;
function montrerEtape(n) {
  etapeTuto = n;
  document.querySelectorAll('.tuto-etape').forEach(e => { e.hidden = +e.dataset.etape !== n; });
  $('tuto-points').textContent = Array.from({ length: 5 }, (_, i) => i + 1 === n ? '■' : '□').join('');
  $('tuto-suivant').textContent = n === 5 ? 'Jouer' : 'Suivant';
}
function ouvrirTuto() { $('tuto').hidden = false; montrerEtape(1); $('tuto-suivant').focus(); }
function fermerTuto() { $('tuto').hidden = true; sauve.tutoVu = true; persister(); }
$('tuto-suivant').addEventListener('click', () => etapeTuto < 5 ? montrerEtape(etapeTuto + 1) : fermerTuto());
$('tuto-passer').addEventListener('click', fermerTuto);
$('ouvrir-tuto').addEventListener('click', ouvrirTuto);
if (!sauve.tutoVu) ouvrirTuto();


// Captures pour la revue design (Chrome headless) : ?capture=accueil|config|jeu|resultats|relique|continue|fin|tuto|bulle|focus[&jeu=sf]
{ const q = new URLSearchParams(location.search), c = q.get('capture');
  if (c) {
    sauve.tutoVu = true; $('tuto').hidden = true;
    const jeu = JEUX[q.get('jeu') || 'er'], parade = PARADES[jeu.id][0];
    const run = () => { demarrerRun(jeu, parade); annuler(); attaque = { phase: 'fin' }; };
    const faux = () => { partie.jugements = [0, 12, -30, 80, 300, 5, -8, 25, 15, -50, 10, 4].map(e => ({ coup: 'Taille', resultat: Math.abs(e) < 90 ? 'parry' : e > 0 ? 'tard' : 'tot', ecart: e })); };
    ({ accueil: () => aller('accueil'), config: () => { document.querySelector('[data-mode]') && document.querySelector('[data-mode]').click(); aller('config'); },
      jeu: () => { demarrerLab(jeu, parade, null, 20, true, false); annuler(); nouvelleAttaque(performance.now() + 100, jeu.bosses[0].coups[0], 1400); },
      resultats: () => { demarrerLab(jeu, parade, null, 12, true, false); annuler(); faux(); finLab(); },
      relique: () => { run(); bossVaincu(); }, continue: () => { run(); partie.run.vies = 0; proposerContinue(); },
      fin: () => { run(); faux(); partie.score = 12300; finRun(true); },
      tuto: () => { aller('accueil'); ouvrirTuto(); }, bulle: () => { aller('accueil'); montrerBulle(document.querySelector('[data-aide]')); },
      focus: () => { aller('config'); document.querySelector('.pastille').focus(); } })[c]();
    if (!q.has('vivant')) setTimeout(() => { annuler(); window.__fige = true; }, 2500); // fige la boucle pour que le temps virtuel de Chrome headless se termine
  } }
window.Parry = { etat: () => ({ partie, attaque }), yaaa }; // pour le débogage
rendreHistorique();
requestAnimationFrame(boucle);
