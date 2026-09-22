// Parry — contenu. Frames à 60 i/s. `approx: true` = valeur communautaire ou
// estimée, pas une donnée officielle ; à ajuster ici si tu as mieux.
//
// Un coup : { nom, preavis (ms), variance, anim, arme?, feinte?, suite?, enchaine? }
//   anim      : taille | estoc | balayage | ecrasement | faux | tir | bouclier | poing | pied | di | hado
//   arme      : epee | dague | hache | hallebarde | marteau | faux | ak47 | canne | katana | aucune (sinon l'arme du boss)
//   feinte    : le boss arme le coup puis le retient ; appuyer pendant la feinte = « baited ».
//   suite     : préavis (ms) du vrai coup qui part juste après la feinte.
//   enchaine  : préavis (ms) des coups suivants, enchaînés sans pause.
(function (racine) {
  const F = 1000 / 60;

  const PARADES_BOUCLIER = [
    // Source : guide Steam « Parry Frame Data 1.17.1 » (60 i/s). La Parade dorée a été raccourcie au patch 1.12.
    { id: 'standard', nom: 'Parade', startup: 8, actifs: 12, approx: false, note: 'bouclier moyen, v1.17.1' },
    { id: 'buckler', nom: 'Parade au buckler', startup: 6, actifs: 12, approx: false, note: 'petit bouclier, v1.17.1' },
    { id: 'doree', nom: 'Parade dorée', startup: 8, actifs: 6, approx: false, note: 'cendre de guerre, raccourcie en 1.12' },
  ];
  const PARADES = {
    er: PARADES_BOUCLIER,
    ar: PARADES_BOUCLIER,
    sf: [
      { id: 'parfaite', nom: 'Perfect Parry', startup: 0, actifs: 2, approx: false, note: '2 premières frames du Drive Parry' },
    ],
  };

  // Elden Ring : le préavis est le temps entre le début de l'animation et
  // l'impact. Pas de frame data publique fiable pour les boss : estimations
  // de rythme, avec une variance pour les coups « retardés ».
  const ER = {
    id: 'er', nom: 'Elden Ring', accent: 'or',
    bosses: [
      { id: 'soldat', replique: 'Un Sans-Éclat ? Ici ?', nom: 'Soldat de Godrick', titre: 'Limgrave', pv: 4, arme: 'epee', coups: [
        { nom: 'Taille', preavis: 650, variance: 60, anim: 'taille' },
        { nom: 'Estoc', preavis: 500, variance: 40, anim: 'estoc' },
        { nom: 'Coup lourd', preavis: 900, variance: 80, anim: 'ecrasement' },
      ]},
      { id: 'margit', replique: 'Sois humble, Sans-Éclat.', nom: 'Margit, l’Augure Déchu', titre: 'Château de Voilorage', pv: 5, arme: 'canne', coups: [
        { nom: 'Taille lente', preavis: 1150, variance: 120, anim: 'taille' },
        { nom: 'Frappe retardée', preavis: 1500, variance: 260, anim: 'ecrasement', arme: 'marteau' },
        { nom: 'Coup de canne', preavis: 700, variance: 70, anim: 'balayage' },
        { nom: 'Feinte à la dague', preavis: 800, variance: 100, anim: 'estoc', arme: 'dague', feinte: true, suite: 420 },
      ]},
      { id: 'crucible', replique: 'Le Creuset ne pardonne pas.', nom: 'Chevalier du Creuset', titre: 'Fort Vif-Argent', pv: 6, arme: 'epee', coups: [
        { nom: 'Taille montante', preavis: 800, variance: 90, anim: 'faux' },
        { nom: 'Coup d’épée retardé', preavis: 1300, variance: 300, anim: 'taille' },
        { nom: 'Coup de bouclier', preavis: 550, variance: 50, anim: 'bouclier' },
        { nom: 'Estoc puis taille', preavis: 600, variance: 60, anim: 'estoc', enchaine: [520] },
      ]},
      { id: 'godrick', replique: 'Je suis un seigneur ! Un seigneur !', nom: 'Godrick le Greffé', titre: 'Seigneur de Voilorage', pv: 6, arme: 'hache', coups: [
        { nom: 'Hache tournoyante', preavis: 1000, variance: 150, anim: 'balayage' },
        { nom: 'Frappe au sol', preavis: 1400, variance: 200, anim: 'ecrasement' },
        { nom: 'Coup de hache rapide', preavis: 600, variance: 60, anim: 'taille' },
        { nom: 'Double hache', preavis: 900, variance: 100, anim: 'balayage', enchaine: [480] },
      ]},
      { id: 'assassin', replique: 'Tu ne me verras pas venir.', nom: 'Assassin à la Lame Noire', titre: 'Catacombes', pv: 5, arme: 'dague', coups: [
        { nom: 'Coup de dague', preavis: 380, variance: 40, anim: 'estoc' },
        { nom: 'Feinte', preavis: 700, variance: 150, anim: 'taille', feinte: true, suite: 380 },
        { nom: 'Taille double', preavis: 520, variance: 50, anim: 'taille', enchaine: [300] },
      ]},
      { id: 'malenia', replique: 'Je n’ai jamais connu la défaite.', nom: 'Malenia, Lame de Miquella', titre: 'Haligtree', pv: 8, arme: 'katana', coups: [
        { nom: 'Taille', preavis: 560, variance: 60, anim: 'taille' },
        { nom: 'Ruée', preavis: 800, variance: 120, anim: 'estoc' },
        { nom: 'Coup retardé', preavis: 1200, variance: 300, anim: 'balayage' },
        { nom: 'Estoc', preavis: 430, variance: 40, anim: 'estoc' },
        { nom: 'Feinte prothèse', preavis: 650, variance: 80, anim: 'balayage', feinte: true, suite: 400 },
        { nom: 'Triple taille', preavis: 700, variance: 60, anim: 'taille', enchaine: [420, 360] },
      ]},
    ],
  };

  // Arcade : le roster maison, une arme par boss, tout ce qui n'existe pas
  // dans les deux autres. Préavis inventés, donc tout est ≈.
  const AR = {
    id: 'ar', nom: 'Arcade', accent: 'rose',
    bosses: [
      { id: 'hallebardier', replique: 'Deux mètres d’acier. Compte-les.', nom: 'Hallebardier', titre: 'Étage 1 · allonge', pv: 5, arme: 'hallebarde', coups: [
        { nom: 'Pique', preavis: 620, variance: 60, anim: 'estoc' },
        { nom: 'Fauchage', preavis: 900, variance: 100, anim: 'balayage' },
        { nom: 'Abattée', preavis: 1100, variance: 150, anim: 'taille' },
        { nom: 'Fausse pique', preavis: 700, variance: 80, anim: 'estoc', feinte: true, suite: 380 },
      ]},
      { id: 'marteau', replique: 'Un seul coup suffit.', nom: 'Géant au Marteau', titre: 'Étage 2 · lourdeur', pv: 6, arme: 'marteau', coups: [
        { nom: 'Écrasement', preavis: 1300, variance: 200, anim: 'ecrasement' },
        { nom: 'Balayage', preavis: 1000, variance: 120, anim: 'balayage' },
        { nom: 'Écrasement retenu', preavis: 1500, variance: 300, anim: 'ecrasement', feinte: true, suite: 500 },
        { nom: 'Double écrasement', preavis: 1200, variance: 150, anim: 'ecrasement', enchaine: [650] },
      ]},
      { id: 'faucheur', replique: 'La lame revient toujours.', nom: 'Faucheur', titre: 'Étage 3 · arc', pv: 6, arme: 'faux', coups: [
        { nom: 'Moisson', preavis: 850, variance: 100, anim: 'faux' },
        { nom: 'Fauchage bas', preavis: 700, variance: 80, anim: 'balayage' },
        { nom: 'Feinte de moisson', preavis: 800, variance: 100, anim: 'faux', feinte: true, suite: 420 },
        { nom: 'Moisson double', preavis: 900, variance: 100, anim: 'faux', enchaine: [450] },
      ]},
      { id: 'braqueur', replique: 'Trente balles. Aucune ne ment.', nom: 'Le Braqueur', titre: 'Étage 4 · AK-47', pv: 6, arme: 'ak47', coups: [
        { nom: 'Tir', preavis: 700, variance: 80, anim: 'tir' },
        { nom: 'Rafale', preavis: 800, variance: 80, anim: 'tir', enchaine: [180, 180] },
        { nom: 'Mise en joue', preavis: 900, variance: 150, anim: 'tir', feinte: true, suite: 300 },
        { nom: 'Coup de crosse', preavis: 550, variance: 60, anim: 'balayage' },
      ]},
      { id: 'duel', replique: 'Toutes les armes. Une seule règle.', nom: 'Le Duel', titre: 'Étage 5 · toutes les armes', pv: 8, arme: 'epee', coups: [
        { nom: 'Épée', preavis: 650, variance: 70, anim: 'taille', arme: 'epee' },
        { nom: 'Hallebarde', preavis: 800, variance: 90, anim: 'estoc', arme: 'hallebarde' },
        { nom: 'Marteau', preavis: 1200, variance: 200, anim: 'ecrasement', arme: 'marteau' },
        { nom: 'Faux', preavis: 850, variance: 100, anim: 'faux', arme: 'faux' },
        { nom: 'AK-47', preavis: 700, variance: 80, anim: 'tir', arme: 'ak47' },
        { nom: 'Feinte à la hache', preavis: 750, variance: 100, anim: 'balayage', arme: 'hache', feinte: true, suite: 400 },
        { nom: 'Dague ×3', preavis: 500, variance: 50, anim: 'estoc', arme: 'dague', enchaine: [280, 280] },
      ]},
    ],
  };

  // Street Fighter 6 : l'impact est la frame de startup. Le Drive Impact (26f)
  // est la seule chose vraiment réactable ; le reste se pare sur un read.
  // Startups relevés sur ultimateframedata.com/sf6 (approx: false) ; les feintes
  // et le target combo restent des inventions de gameplay (≈).
  const SF = {
    id: 'sf', nom: 'Street Fighter 6', accent: 'rose',
    bosses: [
      { id: 'ryu', replique: 'Le combat, c’est tout ce qui compte.', nom: 'Ryu', titre: 'Le fondamental', pv: 6, arme: 'aucune', coups: [
        { nom: 'Drive Impact', frames: 26, approx: false, anim: 'di' },
        { nom: '5MP', frames: 6, approx: false, anim: 'poing' },
        { nom: '5HP', frames: 10, approx: false, anim: 'poing' },
        { nom: '5MK', frames: 9, approx: false, anim: 'pied' },
        { nom: '5HK', frames: 12, approx: false, anim: 'pied' },
        { nom: '2MK', frames: 8, approx: false, anim: 'pied' },
        { nom: '2HP', frames: 9, approx: false, anim: 'poing' },
        { nom: '2HK (balayage)', frames: 9, approx: false, anim: 'pied' },
        { nom: '6HP (overhead)', frames: 20, approx: false, anim: 'poing' },
        { nom: '6HK', frames: 16, approx: false, anim: 'pied' },
        { nom: 'Hadoken LP', frames: 16, approx: false, anim: 'hado', projectile: true },
        { nom: 'Hadoken HP', frames: 12, approx: false, anim: 'hado', projectile: true },
        { nom: 'Shoryuken HP', frames: 7, approx: false, anim: 'poing' },
        { nom: 'Tatsumaki MK', frames: 14, approx: false, anim: 'pied' },
        { nom: 'Hashogeki MP', frames: 19, approx: false, anim: 'poing' },
        { nom: 'High Blade Kick HK', frames: 27, approx: false, anim: 'pied' },
        { nom: 'HP > HK (target)', frames: 10, approx: false, anim: 'poing', enchaine: [12 * F] },
        { nom: 'MP > LK > HK (target)', frames: 6, approx: false, anim: 'poing', enchaine: [5 * F, 12 * F] },
        { nom: 'Feinte de Drive Impact', frames: 14, anim: 'di', feinte: true, suite: 9 * F },
      ]},
      { id: 'ken', replique: 'Allez, on chauffe !', nom: 'Ken', titre: 'Rushdown', pv: 6, arme: 'aucune', coups: [
        { nom: 'Drive Impact', frames: 26, approx: false, anim: 'di' },
        { nom: '5MP', frames: 5, approx: false, anim: 'poing' },
        { nom: '5HP', frames: 10, approx: false, anim: 'poing' },
        { nom: '5MK', frames: 8, approx: false, anim: 'pied' },
        { nom: '5HK', frames: 12, approx: false, anim: 'pied' },
        { nom: '2MK', frames: 7, approx: false, anim: 'pied' },
        { nom: '2HP', frames: 8, approx: false, anim: 'poing' },
        { nom: 'Hadoken MP', frames: 14, approx: false, anim: 'hado', projectile: true },
        { nom: 'Shoryuken HP', frames: 7, approx: false, anim: 'poing' },
        { nom: 'Tatsumaki MK', frames: 14, approx: false, anim: 'pied' },
        { nom: 'Dragonlash LK', frames: 18, approx: false, anim: 'pied' },
        { nom: 'Dragonlash HK', frames: 28, approx: false, anim: 'pied' },
        { nom: 'Jinrai LK', frames: 12, approx: false, anim: 'pied' },
        { nom: 'Jinrai > Gorai Axe', frames: 12, approx: false, anim: 'pied', enchaine: [18 * F] },
        { nom: 'Thunder Kick (dash)', frames: 28, approx: false, anim: 'pied' },
        { nom: 'MP > HP (target)', frames: 5, approx: false, anim: 'poing', enchaine: [10 * F] },
        { nom: 'MK > MK > HK (target)', frames: 8, approx: false, anim: 'pied', enchaine: [8 * F, 12 * F] },
        { nom: 'Feinte de dash', frames: 11, anim: 'poing', feinte: true, suite: 8 * F },
      ]},
      { id: 'luke', replique: 'Let’s go, on se fait ça vite.', nom: 'Luke', titre: 'Le protagoniste', pv: 6, arme: 'aucune', coups: [
        { nom: 'Drive Impact', frames: 26, approx: false, anim: 'di' },
        { nom: '5MP', frames: 9, approx: false, anim: 'poing' },
        { nom: '5HP', frames: 10, approx: false, anim: 'poing' },
        { nom: '5MK', frames: 8, approx: false, anim: 'pied' },
        { nom: '5HK', frames: 10, approx: false, anim: 'pied' },
        { nom: '2MP', frames: 6, approx: false, anim: 'poing' },
        { nom: '2HP', frames: 7, approx: false, anim: 'poing' },
        { nom: '2HK', frames: 10, approx: false, anim: 'pied' },
        { nom: '6MP (overhead)', frames: 21, approx: false, anim: 'poing' },
        { nom: '4HP', frames: 16, approx: false, anim: 'poing' },
        { nom: 'Sand Blast LP', frames: 14, approx: false, anim: 'hado', projectile: true },
        { nom: 'Sand Blast HP', frames: 20, approx: false, anim: 'hado', projectile: true },
        { nom: 'Flash Knuckle LP', frames: 13, approx: false, anim: 'poing' },
        { nom: 'Flash Knuckle HP', frames: 22, approx: false, anim: 'poing' },
        { nom: 'Rising Uppercut HP', frames: 9, approx: false, anim: 'poing' },
        { nom: 'Avenger > Impaler', frames: 12, approx: false, anim: 'poing', enchaine: [12 * F] },
        { nom: 'Triple Impact (target)', frames: 7, approx: false, anim: 'poing', enchaine: [8 * F, 10 * F] },
        { nom: 'Nose Breaker (target)', frames: 8, approx: false, anim: 'poing', enchaine: [9 * F] },
        { nom: 'Snapback Combo (target)', frames: 9, approx: false, anim: 'poing', enchaine: [12 * F, 11 * F, 11 * F] },
      ]},
      { id: 'jp', replique: 'Vous êtes déjà en retard.', nom: 'JP', titre: 'Zoneur', pv: 6, arme: 'canne', coups: [
        { nom: 'Drive Impact', frames: 26, approx: false, anim: 'di' },
        { nom: '5MP', frames: 12, approx: false, anim: 'estoc' },
        { nom: '5HP', frames: 12, approx: false, anim: 'balayage' },
        { nom: '5MK', frames: 8, approx: false, anim: 'pied' },
        { nom: '5HK', frames: 12, approx: false, anim: 'pied' },
        { nom: '2MP', frames: 7, approx: false, anim: 'estoc' },
        { nom: '2HP', frames: 9, approx: false, anim: 'taille' },
        { nom: '4MP', frames: 8, approx: false, anim: 'estoc' },
        { nom: 'Guillotinna (6MK)', frames: 22, approx: false, anim: 'pied' },
        { nom: 'Malice (3HP)', frames: 16, approx: false, anim: 'taille' },
        { nom: 'Bylina (6HK)', frames: 11, approx: false, anim: 'pied' },
        { nom: 'Triglav', frames: 22, approx: false, anim: 'hado', projectile: true },
        { nom: 'Stribog LP', frames: 16, approx: false, anim: 'hado', projectile: true },
        { nom: 'Stribog HP', frames: 28, approx: false, anim: 'hado', projectile: true },
        { nom: 'Torbalan LK', frames: 22, approx: false, anim: 'hado', projectile: true },
        { nom: 'Embrace', frames: 26, approx: false, anim: 'estoc' },
        { nom: 'Grom Strelka (target)', frames: 8, approx: false, anim: 'estoc', enchaine: [8 * F] },
        { nom: 'Zilant (target)', frames: 12, approx: false, anim: 'pied', enchaine: [12 * F, 12 * F] },
        { nom: 'Amnesia (feinte)', frames: 18, anim: 'estoc', feinte: true, suite: 8 * F },
      ]},
      { id: 'marisa', replique: 'Montre-moi de la beauté.', nom: 'Marisa', titre: 'Gladiatrice', pv: 7, arme: 'aucune', coups: [
        { nom: 'Drive Impact', frames: 26, approx: false, anim: 'di' },
        { nom: '5MP', frames: 7, approx: false, anim: 'poing' },
        { nom: '5HP', frames: 12, approx: false, anim: 'poing' },
        { nom: '5MK', frames: 11, approx: false, anim: 'pied' },
        { nom: '5HK', frames: 15, approx: false, anim: 'pied' },
        { nom: '2MP', frames: 8, approx: false, anim: 'poing' },
        { nom: '2HP', frames: 9, approx: false, anim: 'poing' },
        { nom: '2HK', frames: 11, approx: false, anim: 'pied' },
        { nom: '6MP', frames: 9, approx: false, anim: 'poing' },
        { nom: 'Malleus Breaker', frames: 21, approx: false, anim: 'poing' },
        { nom: 'Falx Crusher Kick', frames: 14, approx: false, anim: 'pied' },
        { nom: 'Gladius LP', frames: 17, approx: false, anim: 'poing' },
        { nom: 'Gladius HP', frames: 22, approx: false, anim: 'poing' },
        { nom: 'Dimachaerus LP', frames: 12, approx: false, anim: 'poing' },
        { nom: 'Phalanx MP', frames: 28, approx: false, anim: 'poing' },
        { nom: 'Quadriga MK', frames: 24, approx: false, anim: 'pied' },
        { nom: 'Scutum > Tonitrus', frames: 9, approx: false, anim: 'poing' },
        { nom: 'Heavy Two Hitter (target)', frames: 12, approx: false, anim: 'poing', enchaine: [24 * F] },
        { nom: '6MP > HP (target)', frames: 9, approx: false, anim: 'poing', enchaine: [11 * F] },
        { nom: 'Malleus Breaker ×2', frames: 21, approx: false, anim: 'poing', enchaine: [18 * F] },
        { nom: 'Scutum (feinte)', frames: 16, anim: 'poing', feinte: true, suite: 9 * F },
      ]},
    ],
  };
  for (const b of SF.bosses) for (const c of b.coups) { c.preavis = c.frames * F; c.variance = 0; }
  for (const j of [ER, AR, SF]) for (const b of j.bosses) for (const c of b.coups) { if (c.approx == null) c.approx = true; if (!c.arme) c.arme = b.arme; }

  // Reliques du mode run. `appliquer` modifie l'état de la run en place.
  const RELIQUES = [
    { id: 'fiole', nom: 'Fiole', texte: '+1 vie', appliquer: r => { r.vies++; } },
    { id: 'talisman', nom: 'Talisman de la fenêtre', texte: '+2 frames de parade', appliquer: r => { r.bonusFrames += 2; } },
    { id: 'oeil', nom: 'Œil', texte: 'l’arme chauffe à blanc pendant la fenêtre', appliquer: r => { r.aide = true; } },
    { id: 'poids', nom: 'Poids mort', texte: 'le boss frappe 15 % plus lentement', appliquer: r => { r.preavisMult *= 1.15; } },
    { id: 'estoc', nom: 'Estoc', texte: 'chaque boss commence avec 1 PV de moins', appliquer: r => { r.estoc++; } },
    { id: 'metronome', nom: 'Métronome', texte: 'trois tics annoncent chaque coup', appliquer: r => { r.annonce = true; } },
  ];

  const api = { PARADES, JEUX: { er: ER, ar: AR, sf: SF }, RELIQUES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Data = api;
})(typeof window !== 'undefined' ? window : globalThis);
