// node verif.js — casse si le jugement, les stats ou le contenu dérivent.
const assert = require('assert');
const { F, fenetre, juger, stats, histogramme, tirerPreavis } = require('./moteur.js');
const { PARADES, JEUX, RELIQUES } = require('./data.js');

// 1. Perfect Parry SF6 : 2 frames actives dès la frame 1, donc l'appui doit
//    tomber dans les 33 ms qui précèdent l'impact.
const pp = PARADES.sf[0];
const di = 26 * F;
const f = fenetre(di, pp);
assert.ok(Math.abs(f.ferme - di) < 1e-9, 'la fenêtre parfaite se ferme à l\'impact');
assert.ok(Math.abs(f.largeur - 2 * F) < 1e-9, 'la fenêtre parfaite fait 2 frames');
assert.strictEqual(juger(di - 10, di, pp).resultat, 'parry');
assert.strictEqual(juger(di - 40, di, pp).resultat, 'tot');
assert.strictEqual(juger(di + 1, di, pp).resultat, 'tard');
assert.strictEqual(juger(null, di, pp).resultat, 'touche');

// 2. Elden Ring : le startup décale la fenêtre avant l'impact ; un appui pile
//    à l'impact est en retard.
const buckler = PARADES.er.find(p => p.id === 'buckler');
const fb = fenetre(1000, buckler);
assert.ok(fb.ouvre < fb.ferme && fb.ferme < 1000, 'fenêtre buckler avant l\'impact');
assert.strictEqual(juger(1000, 1000, buckler).resultat, 'tard');
assert.strictEqual(juger(fb.centre, 1000, buckler).resultat, 'parry');
assert.strictEqual(juger(fb.centre, 1000, buckler).ecart, 0);

// 3. Le bonus de frames élargit vers l'avant sans bouger la fermeture.
const fb2 = fenetre(1000, buckler, 2);
assert.ok(fb2.ouvre < fb.ouvre && fb2.ferme === fb.ferme);

// 4. Stats : taux, biais, meilleur.
const js = [
  juger(fb.centre - 5, 1000, buckler), juger(fb.centre + 30, 1000, buckler),
  juger(fb.ouvre - 100, 1000, buckler), juger(null, 1000, buckler),
];
const s = stats(js);
assert.strictEqual(s.n, 4);
assert.strictEqual(s.parades, 2);
assert.strictEqual(s.taux, 0.5);
assert.strictEqual(s.biais, 'tot');
assert.strictEqual(s.meilleur, 5);
assert.deepStrictEqual(stats([]).taux, 0);

// 4b. Une feinte mordue compte comme un coup raté, sans écart.
const sf = stats([{ resultat: 'feinte', ecart: null }, juger(fb.centre, 1000, buckler)]);
assert.strictEqual(sf.n, 2); assert.strictEqual(sf.taux, .5); assert.strictEqual(sf.moyenne, 0);

// 5. Histogramme : bornes respectées, tout est compté.
const h = histogramme([-500, -10, 0, 12, 900, null], 20, 300);
assert.strictEqual(h.length, 30);
assert.strictEqual(h.reduce((a, b) => a + b, 0), 5);
assert.strictEqual(h[0], 1, 'très tôt tombe dans le premier paquet');
assert.strictEqual(h[29], 1, 'très tard tombe dans le dernier');

// 6. Préavis : la variance reste bornée et le multiplicateur s'applique.
const coup = { preavis: 1000, variance: 100 };
assert.strictEqual(tirerPreavis(coup, 1, 0), 900);
assert.strictEqual(tirerPreavis(coup, 1, 1), 1100);
assert.strictEqual(tirerPreavis(coup, 1.15, 0.5), 1150);

// 7. Contenu cohérent : chaque coup a un préavis positif, chaque boss des PV.
for (const j of Object.values(JEUX)) for (const b of j.bosses) {
  assert.ok(b.pv > 0 && b.coups.length >= 3, `${b.nom} incomplet`);
  for (const c of b.coups) assert.ok(c.preavis > 0 && c.variance >= 0, `${b.nom} / ${c.nom}`);
  for (const c of b.coups) assert.ok(c.variance < c.preavis, `${b.nom} / ${c.nom} : variance absurde`);
  for (const c of b.coups) {
    assert.ok(['taille', 'estoc', 'balayage', 'ecrasement', 'faux', 'tir', 'bouclier', 'poing', 'pied', 'di', 'hado'].includes(c.anim), `${b.nom} / ${c.nom} : anim inconnue`);
    assert.ok(c.arme, `${b.nom} / ${c.nom} : pas d'arme`);
    if (c.feinte) assert.ok(c.suite > 0 && c.suite < c.preavis, `${b.nom} / ${c.nom} : feinte sans suite courte`);
    if (c.enchaine) assert.ok(c.enchaine.every(ms => ms > 60), `${b.nom} / ${c.nom} : enchaînement trop serré`);
  }
}
assert.ok(JEUX.ar.bosses.some(b => b.arme === 'ak47') && JEUX.ar.bosses.some(b => b.arme === 'faux'), 'le roster Arcade doit porter les nouvelles armes');
assert.ok(RELIQUES.length >= 5);
const r = { vies: 3, bonusFrames: 0, aide: false, preavisMult: 1, estoc: 0, annonce: false };
for (const q of RELIQUES) q.appliquer(r);
assert.deepStrictEqual(r, { vies: 4, bonusFrames: 2, aide: true, preavisMult: 1.15, estoc: 1, annonce: true });

console.log('verif ok — fenêtre parfaite :', f.largeur.toFixed(1), 'ms ; buckler :', fb.largeur.toFixed(1), 'ms');
