# Parry

Borne d'arcade d'entraînement à la parade. Les yeux sur l'arme de l'adversaire.

- **Elden Ring** : parade au bouclier (standard, buckler, dorée). Le préavis
  des boss est estimé, la fenêtre vient des frames de la parade.
- **Street Fighter 6** : Perfect Parry, 2 frames. Le Drive Impact (26f) se
  réagit ; le reste se pare sur un read, donc trois tics annoncent le coup.
- **Lab** : une session mesurée. Score, taux, biais tôt/tard, dispersion,
  histogramme, courbe de progression dans le relevé.
- **Run** : les boss dans l'ordre, trois vies, une relique par étage,
  « Continue ? » avec compte à rebours (trois pièces max), hi-score par mode.

Mode **Aveugle** : le boss en silhouette, seule son arme éclaire. **Replay** :
après un coup pris, les 750 ms autour de l'impact rejouées à ¼ avec la fenêtre
allumée sur l'arme (une touche pour passer, désactivable). **Riposte** : après
un parry parfait, un second appui dans les 300 ms inflige un critique
(+500 × combo, 1 PV de boss en run).

Score arcade : 100 par parade, 300 si parfaite (moins d'une frame d'écart),
multiplié par le combo jusqu'à x8.

Modèle : une parade a `startup` frames puis `actifs` frames. Elle réussit si
l'impact tombe pendant les frames actives. Tout est dans `moteur.js`, vérifié
par `node verif.js`. Le contenu (boss, coups, reliques) vit dans `data.js`,
avec `approx: true` sur ce qui n'est pas une donnée officielle.

Scène : `scene3d.js`, three.js 0.170 épinglé depuis jsDelivr. Deux stickmen
procéduraux (poses interpolées, pas de fichier de modèle), caméra par-dessus
l'épaule du joueur pointée sur l'arme, traînée et lueur sur la lame, hit-stop
et recul au parry. L'aide, c'est l'arme qui chauffe à blanc pendant la fenêtre.
L'écran reste propre : pas de filtre CRT, mais un bloom (UnrealBloomPass), un
tone mapping ACES et un environnement PMREM pour les reflets du métal. Autour :
arène de pierre à huit piliers et braseros qui vacillent, braises qui montent,
poussière, ciel dégradé, étoiles, lune. Le boss porte une cape, un cimier et
deux yeux qui s'allument avec la charge. Parry : hit-stop, onde de choc au sol,
éclat lumineux, pluie d'étincelles, coup de zoom. K.O. : le boss s'effondre et
la caméra orbite. Intro de round : la caméra vient se placer depuis le boss. La borne est dans le DOM autour
du canvas (fronton à lampes, bezel vissé, pupitre à deux boutons en forme de bouclier
qui parent vraiment, fente à pièces).

Armes procédurales : épée, katana, dague, canne, hache, hallebarde, marteau,
faux, AK-47. Animations : taille, estoc, balayage, écrasement, faux, tir
(éclair au canon + traçante), coup de bouclier, et les quatre de SF6. Un coup
peut être une **feinte** (le boss arme, retient, puis frappe court ; appuyer
pendant la feinte = Baited, ça compte comme un coup pris) ou un
**enchaînement** (coups suivants sans pause). Trois rosters : Elden Ring,
Arcade (hallebardier, géant au marteau, faucheur, braqueur, le Duel qui change
d'arme à chaque coup), Street Fighter 6.

Entrées : clavier (`e.timeStamp`), manette XInput via la Gamepad API
(`gp.timestamp`), tap sur la borne. Deux décalages réglables en ms pour
compenser le matériel. La règle de timing sous l'écran se masque dans les
réglages. Données en `localStorage`, clé `parry.v1`.

Sons : synthèse WebAudio par défaut ; des fichiers déposés dans `sfx/`
(voir `sfx/LISEZ-MOI.txt`) la remplacent.

Lancer : config `parry`, port 8547 (`python -m http.server 8547 --directory Parry`).
Débogage : `Parry.etat()` dans la console renvoie la partie et l'attaque en cours.

## Sources des frames

- Parades Elden Ring (startup + actives, 60 i/s) : guide Steam « Parry Frame
  Data 1.17.1 » (https://steamcommunity.com/sharedfiles/filedetails/?id=3360984277).
  Parade 8+12, buckler 6+12, dorée 8+6 (raccourcie au patch 1.12).
- Street Fighter 6 : startups relevés sur https://ultimateframedata.com/sf6/<perso>
  (Ryu, Ken, Luke, JP, Marisa) : 18 à 21 coups par perso, normaux, command
  normals, spéciaux par force, target combos en enchaînements. Drive Impact 26f et Perfect Parry 2f : données
  officielles Capcom, largement documentées.
- Tout ce qui porte `approx: true` dans data.js est inventé pour le gameplay :
  préavis des boss ER, feintes, target combo, roster Arcade.

## Tutoriel

Guide en cinq étapes au premier lancement (`tutoVu` dans le stockage), bouton
« ? Comment jouer » dans le fronton, et une bulle `data-aide` sur chaque
commande (survol ou focus clavier).

## Habillage de la borne (art/)

Trois visuels générés le 22/09/2026 via l'API Higgsfield, modèle `recraft/v4.1/pro/text-to-image`
(0,21 $ l'image, requêtes et registre dans `work/higgsfield/`, PNG 2K d'origine dans `outputs/`) :
`art/marquee.webp` (le duel, derrière le titre), `art/flanc.webp` (le chevalier au bouclier, sur les
panneaux latéraux visibles à partir de 1300 px de large, miroir à droite), `art/pupitre.webp`
(chromes, sous un voile sombre pour laisser lire les boutons). Palette imposée : or, rose, violet, noir.

## Début de manche

`lancerManche(étiquette)` : un PARRY plein écran (15 % de la largeur de l'écran, or, gong),
le marquee clignote trois fois, puis l'étiquette (Ready ? / Round N / Continue) à 1,1 s,
puis Fight ! à 2,5 s et le premier coup 500 ms après. La cinématique d'intro dure 2,4 s pour coller.
Le calque d'annonce s'appelle `#annonce-ecran` : `#annonce` est la case « trois tics » de la config.

## Décor : la prairie (23/09/2026)

Le décor nocturne à piliers est remplacé par une prairie sous un ciel peint, d'après un tableau qu'il a envoyé
(bois mort noir tordu dans une plaine d'herbe, cumulus). Ciel : `art/panorama.webp` (Recraft via Higgsfield,
0,21 $) plaqué sur un cylindre en `MirroredRepeatWrapping` ×2, donc sans couture ; horizon de l'image (12 % du bas)
au niveau des yeux. Sol : plan herbeux texturé (canvas procédural) + 9 000 brins instanciés qui ondulent (shader
injecté par `onBeforeCompile`, uniforme `uTemps`). Dalle de pierre au centre, anneaux d'accent. La sculpture :
`sculpture(graine)` = tronc + 9 branches + épines en tubes Catmull-Rom à rayon décroissant, matériau noir satiné ;
une grande derrière le boss, une petite au loin. Le boss est du même noir. Lumière : soleil + hémisphère,
brume claire, bloom seuil .92. Aveugle : tout s'éteint, ciel et herbe assombris.

## Lisibilité du coup

Un anneau (`cible`, sprite sans test de profondeur) se referme sur la pointe de l'arme pendant tout le préavis,
doré puis blanc dans la fenêtre avec l'aide, et s'ouvre en flash au parry. Masqué en Aveugle. Le nom du coup est
en 15 px. Le replay est reconnaissable : image délavée (`.verre.en-replay canvas`), cadre jaune qui bat,
bandeau « ◀◀ Replay ¼ · appuie pour passer ».

## Pupitre

Plus de joystick. Les deux boutons prennent la forme du bouclier choisi (`:root[data-parade]`) : Parade = disque
acier à umbo doré, buckler = plus petit, dorée = or, Perfect Parry SF6 = deux boutons rose/bleu étiquetés MP et MK.
Étiquettes Parer / Riposte sinon.

## YAAA

`sfx/yaaa.wav` extrait de son clip (ffmpeg, silences coupés, normalisé). Joué au K.O. et aussi sur chaque Perfect
(aigu) et chaque coup pris (grave), après la première écoute au naturel ; le pitch passe par `playbackRate`.

## Voix, volume, bouclier, présentation (23/09/2026)

- Voix : `sfx/yaaa.wav` + deux banques `sfx/sigma.wav` et `sfx/sigma2.wav` (extraites de ses clips, loudnorm -16 LUFS).
  `yaaa(gagne)` joue le YAAA la première fois, puis 40 % YAAA / 60 % une tranche de 0,9 à 1,6 s tirée au hasard dans
  une banque, avec fondus de 30 ms, pitchée par `playbackRate` (aigu si gagné, grave si perdu). Une seule voix à la
  fois (`voixJusqua`) : jamais de superposition, un multi-parry garde son clang.
- Volume : curseur « Volume des sons » dans les réglages (`reglages.volume`, 70 par défaut), un GainNode maître
  devant `destination` que tout traverse (bips, bruits, fichiers, voix).
- Bouclier qui s'abîme : chaque coup encaissé pose une bosse sombre sur le disque (`abimer`, 14 max), réparé à
  chaque intro de round (`reparer`).
- Présentation du boss : à chaque manche avec un boss, son nom s'écrit lettre à lettre (45 ms) en bas de l'écran,
  puis sa `replique` (data.js, une par boss) apparaît en italique. Masqué au Fight.

## Rendu, deuxième passe (23/09/2026)

Chaîne de post-traitement (addons three.js 0.170 via l'importmap) : RenderPass → **GTAOPass** (occlusion ambiante,
rayon .35) → **BokehPass** (profondeur de champ, la focale suit la pointe de l'arme, ouverture .0009) → UnrealBloom →
ShaderPass maison (vignette .38 + aberration chromatique .0022) → OutputPass → **SMAAPass**. Les objets d'effet
(traînée, cible, sprites, particules, nuages, soleil, orbe) sont cachés pendant le rendu de substitution du GTAO,
sinon ils sortent en quads noirs (`horsAO`). Soleil hors champ avec **Lensflare** (textures canvas, teintes de la
rampe). Ombres de nuages : plan en MultiplyBlending à 0,5 m dont la texture glisse. Le panorama sert aussi de carte
d'environnement (PMREM équirectangulaire) : le ciel se reflète sur le métal. Matériaux **MeshPhysicalMaterial** avec
clearcoat pour le boss, la sculpture et le joueur (laque). Le boss porte un casque, des pauldrons et des grèves.

## Freerun, barre de temps, publication (23/09/2026)

- **Freerun** (option de Run) : neuf vies au lieu de trois, `run.freerun`. Le reste de la run est identique.
- **Barre de temps du coup** (option Lab et Run, `partie.chrono`) : sous l'écran, elle se remplit du départ du coup à
  l'impact, la fenêtre de parade marquée en accent, le curseur blanc ; en feinte la fenêtre est estompée. C'est le
  retour de la jauge du premier prototype, en horizontal.
- Accueil : affiche illustrée (le marquee), « Press start » qui clignote, rangs sur les hi-scores, halo en tête de page.
- Publié sur GitHub Pages : dépôt public `TidianeTone/parry`, site https://tidianetone.github.io/parry/ (branche main,
  racine). `outputs/`, `work/` et `.impeccable/review/` sont ignorés. Tout est statique, chemins relatifs, three.js
  depuis jsDelivr : rien à construire, `git push` publie.

## Refonte graphique (24/09/2026) : le tableau, des vrais personnages

Remplace « Décor : la prairie » et l'anneau de « Lisibilité du coup » (retiré : il masquait l'arme).
Références : les six images qu'il a envoyées (`work/refs/`), un tableau d'Anato Finnstark pour le décor, cinq
concepts de personnages. Revue par un critique « directeur artistique AAA » à chaque itération (captures dans
`outputs/revue/`) : 3,9 → 5,3 → 5,6 → 5,6 → 5,9 → 6,3 → 6,4 → 6,5 → 6,6 → 6,5 → 6,7 → 6,4 → …

- **Personnages** (`modeles/*.glb`, riggés) : concept A-pose de face, de dos et de profil par Grok Imagine 2.0
  (API Higgsfield, avec ses images en référence), maillage par TRELLIS (joueur, texturé) ou Hunyuan3D 2.1 (forme
  seule) sur les Spaces Hugging Face, texture projetée face/dos/profil et cuite dans Blender (`work/blender/texturer.py`),
  squelette nommé comme les articulations du stickman et poids par proximité (`work/blender/rigger.py`).
  `monterRig` (scene3d.js) traduit les poses du jeu en rotations d'os ; les stickmen restent en secours.
  Boss par modèle : `MODELE_BOSS` ; disponibles aujourd'hui : conquerant, ombre (masque, dore, sorcier attendent le quota).
  Capes qui ondulent et liseré de lumière chaude en shader (`habillerMateriau`).
- **Armes** (`modeles/armes.glb`) : neuf concepts peints (Grok), silhouette détourée puis « gonflée » (l'épaisseur
  suit la distance au bord : hampes rondes, tranchants fins, `work/gonfler.py`), texture projetée.
- **Le télégraphe** (la règle « les yeux sur l'arme ») : dès l'armé, le corps de l'arme devient noir mat et une
  ligne de silhouette fermée, de largeur constante à l'écran, l'entoure dans un liseré noir (masque de l'arme rendu
  seul sur le calque 1, gonflé d'1 px, puis dilaté par la passe `silhouette` après le bloom). La ligne monte par
  paliers : braise, orange, or presque blanc ; avec l'aide elle passe au rose et pulse. Estocs et tirs : un éclat à
  la pointe, et l'arme vise la poitrine pendant l'armé ; à l'impact, la lame se couche sur le bouclier.
- **Décor** (`modeles/volumes.glb`, `art/decor/`) : statues colossales (125 m, à 200 m, enfouies dans l'éboulis),
  falaise, arbres, rochers, fleurs, tous gonflés de la même façon ; ciel peint rendu raccordable sur un dôme
  (zénith fondu) ; terrain de 800 m avec vallée ; carte peinte au sol (chemin ocre) ; bouclier peint.
- **Caméra** : plus latérale et plus haute (cadrage Souls, silhouette du joueur en bas à gauche) ; les armes
  longues reculent la caméra et ouvrent le champ (réglé par arme, sans pompage pendant l'attaque). Garde de repos
  lame levée, le boss respire.
- **Lumière** : soleil bas derrière le boss (contre-jour), flaque chaude sur l'arène, ombre de nuage sur le plan
  moyen, brume lavande sur les statues ; bas de l'image assombri. Le bouclier montre sa face peinte de trois quarts.
- **Arène** : clairière de dalles irrégulières et sceau soleil-croissant au centre (les couronnes des deux statues),
  bord rongé par l'herbe, ombres de contact sous les personnages.
- **Coups** : parry = hit-stop 90 ms, étincelles en traits qui retombent dans le sens de la lame, éclat doré bref,
  soleil du bouclier qui s'allume, boss renvoyé ; trop tard = la lame va au corps, vignette cramoisie ; trop tôt =
  garde brisée (bouclier projeté), vignette indigo, gerbe gris-bleu, le boss s'emporte dans le vide.
- **Banc d'essai** : `banc.html?t=…&boss=…&anim=…&arme=…&vue=…|cam=…&fov=…` (scène seule, attaque figée) ;
  captures GPU par `python work/capturer.py <dossier> nom="requête" …` (Chrome headless + CDP).
- Serveur de dev sans cache : `python work/serveur.py 8547` (config `parry`).
- Coût Higgsfield de la journée : ≈ 4 $ (≈ 45 images Grok à 0,09 $). 3D : quota GPU gratuit Hugging Face,
  environ 2 à 3 générations par jour sans jeton.
