// Parry — logique pure du timing. Tout en ms relatif au début du préavis (t = 0).
// Chargé tel quel par le navigateur (global `Moteur`) et par `node verif.js`.
(function (racine) {
  const F = 1000 / 60; // une frame à 60 i/s

  // Une parade a `startup` frames avant d'être active, puis `actifs` frames actives.
  // Elle réussit si l'impact tombe pendant la période active, donc l'appui doit
  // se faire entre impact-(startup+actifs)F et impact-startup*F.
  function fenetre(impact, parade, bonusFrames) {
    const s = parade.startup * F, a = (parade.actifs + (bonusFrames || 0)) * F;
    return { ouvre: impact - s - a, ferme: impact - s, centre: impact - s - a / 2, largeur: a };
  }

  // tInput : instant de l'appui, ou null si rien n'a été pressé.
  function juger(tInput, impact, parade, bonusFrames) {
    const f = fenetre(impact, parade, bonusFrames);
    if (tInput == null) return { resultat: 'touche', ecart: null };
    const ecart = tInput - f.centre;
    if (tInput < f.ouvre) return { resultat: 'tot', ecart };
    if (tInput > f.ferme) return { resultat: 'tard', ecart };
    return { resultat: 'parry', ecart };
  }

  function stats(jugements) {
    const n = jugements.length;
    const parades = jugements.filter(j => j.resultat === 'parry').length;
    const ecarts = jugements.map(j => j.ecart).filter(e => e != null);
    const moyenne = ecarts.length ? ecarts.reduce((a, b) => a + b, 0) / ecarts.length : null;
    const sigma = ecarts.length > 1
      ? Math.sqrt(ecarts.reduce((a, e) => a + (e - moyenne) ** 2, 0) / (ecarts.length - 1)) : null;
    const reussis = jugements.filter(j => j.resultat === 'parry').map(j => Math.abs(j.ecart));
    const meilleur = reussis.length ? Math.min(...reussis) : null;
    let biais = 'centre';
    if (moyenne != null && Math.abs(moyenne) > 15) biais = moyenne < 0 ? 'tot' : 'tard';
    return { n, parades, taux: n ? parades / n : 0, moyenne, sigma, biais, meilleur };
  }

  // Histogramme des écarts par paquets de `pas` ms, borné à ±borne.
  function histogramme(ecarts, pas, borne) {
    const nb = Math.round(2 * borne / pas);
    const paquets = new Array(nb).fill(0);
    for (const e of ecarts) {
      if (e == null) continue;
      const i = Math.min(nb - 1, Math.max(0, Math.floor((e + borne) / pas)));
      paquets[i]++;
    }
    return paquets;
  }

  // Tirage d'un préavis réel : la valeur nominale, plus un aléa uniforme ±variance.
  function tirerPreavis(coup, mult, alea) {
    const v = coup.variance || 0;
    return (coup.preavis + (2 * (alea == null ? Math.random() : alea) - 1) * v) * (mult || 1);
  }

  const api = { F, fenetre, juger, stats, histogramme, tirerPreavis };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Moteur = api;
})(typeof window !== 'undefined' ? window : globalThis);
