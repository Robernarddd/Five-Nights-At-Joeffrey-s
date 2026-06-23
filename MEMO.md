# MÉMO — Five Nights at Joeffrey's

Mémo de passation à coller en début de nouvelle conversation. Récapitule l'état
du projet, ce qui est fait, comment lancer, et ce qui reste.
(Un fichier `CLAUDE.md` plus technique, en anglais, est aussi chargé
automatiquement par Claude Code.)

---

## Le jeu
Fangame de **Five Nights at Freddy's 1** jouable dans le navigateur, en
**HTML / CSS / JavaScript vanilla** (aucun framework, aucun build).
Titre : **Five Nights at Joeffrey's**. Ambiance sérieuse, potes du créateur en
guise d'animatroniques.

## Casting (FNAF → potes)
- **Whizip** (ex-Bonnie) — porte **gauche**, agressif
- **Nolan** (ex-Chica) — porte **droite**, régulier
- **Sidané** (ex-Foxy) — **Pirate Cove (cam 1C)**, système à 4 états, fonce vers la porte gauche
- **Joeffrey** (ex-Freddy) — porte **droite**, lent, **se fige quand on le regarde à la caméra**
- Joueur : **Vincent**
- Côtés : GAUCHE = Whizip + Sidané · DROITE = Nolan + Joeffrey

## Lancer le jeu
```
cd "FNAF 1 Perso"
python3 -m http.server
```
Puis ouvrir **http://localhost:8000** (bien mettre le `:8000`).
⚠️ **Cache** : pour voir les modifs, faire **Cmd+Shift+R**, ou activer
« Disable cache » dans les DevTools. On utilise aussi un anti-cache `?v=N` sur
les liens CSS/JS dans `index.html` (actuellement **v=47**) — penser à
**incrémenter N** à chaque modif de CSS/JS.

---

## CE QUI EST FAIT (jeu complet et jouable)
- **Bureau panoramique** : vraie image `office.png` (2560×1080), défile à la souris.
- **Portes** : vraie image `FNAF_door.png` (miroir à gauche), calées sur les ouvertures, animation de fermeture, surcoût d'énergie.
- **Lumières** (maintien du bouton) : halo **masqué par la forme de la porte** (n'éclaire que l'ouverture), éteint quand la porte est fermée.
- **Fenêtres latérales** : révèlent les potes des couloirs **2A (gauche)/4A (droite)** quand on allume la lumière ; forme en perspective (clip-path).
- **Énergie** : drain selon caméras/portes/lumières ; à 0 % → panne.
- **Caméras** : carte fidèle à FNAF, **bascule au survol** d'une barre en bas, filtre VHS sur les caméras, **brouillage 1 s** des 2 caméras quand un pote change de salle.
- **IA des 4 potes** (chemins, niveaux par nuit, Foxy spécial, Freddy se fige).
- **Jumpscares** : surgissent **sur fond bureau** ; image de Whizip fournie ; détourage auto d'un fond opaque ; pas de nom affiché.
- **Séquence de panne** : portes se relèvent, **filtre noir** (bureau visible derrière), **Joeffrey apparaît dans l'embrasure** + musique, puis jumpscare (filtre conservé pour Joeffrey uniquement).
- **Audio** : tout est **synthétisé en Web Audio** (bureau, caméras, portes, lumières, course/rire, musique de panne, victoire, cri). Aucun fichier requis.
- **Menu** style FNAF/VHS, **Sélection de nuit**, **Crédits**, **sauvegarde** (localStorage).
- **Menu pause (Échap)** : son, volume, filtre VHS, retour menu principal ; met le jeu en pause.
- **Custom Night** : débloqué après la Nuit 5 ; curseur 0-20 par pote.
- **Équilibrage** des 5 nuits + délai de grâce 7 s + « toc-toc » sonore quand un pote arrive au corner.
- **Easter eggs** (module `EasterEggs`, sans asset requis) :
  - **Code Konami** sur le menu (↑↑↓↓←→←→ B A) → débloque la **Custom Night** + petit bandeau.
  - **Flashs subliminaux « C'EST MOI »** : apparition ultra-brève et rare **quand on baisse le moniteur** (`SUBLIM_CHANCE` 0.008, anti-spam 6 s) — ambiance, sans danger.
  - **Joeffrey Doré** (clin d'œil au *Golden Freddy*) : **uniquement sur la CAM 5** (`EasterEggs.GOLDEN_CAM`) et **très rarement** (`GOLDEN_CHANCE` 0.0025), une **affiche dorée** flashe ; si on **rebaisse alors le moniteur**, Joeffrey Doré est assis dans le bureau → **relever le moniteur** le chasse, sinon il attaque. Une seule fois par nuit. Image de jumpscare optionnelle : `jumpscares/joeffrey_dore.png`.
  - Test console : `EasterEggs.forceSubliminal()` / `EasterEggs.forceGoldenPoster()`.
- **Lore — appels téléphoniques** (module `PhoneCalls`, façon *Phone Guy*) : au début de chaque nuit (1→5), un message d'un **autre cousin** s'écrit **lettre par lettre** en bas à gauche, avec sonnerie + grésillement de ligne synthétisés. Ne bloque pas le jeu ; bouton **« passer »** (1er clic = tout révéler, 2e = fermer). Les 5 textes sont dans **`data/calls.js`** — c'est là qu'on écrit/réécrit le lore (la dernière nuit a un appel « corrompu » via `glitch:true`). Pas d'appel en Custom Night.
  - **Histoire** : on incarne **Vincent**, cousin de Joeffrey, venu passer 5 nuits chez lui en vacances. Joeffrey & sa bande (Whizip/Nolan/Sidané) veulent le **faire dégager** : se faire attraper = viré (= défaite). Tenir jusqu'à **6h** = les parents se réveillent = tranquille (= victoire).

---

## STRUCTURE & FICHIERS
- `index.html` · `style.css` · `script.js` (tout le moteur, modules par objet)
- `data/nights.js` — niveaux d'IA par nuit (équilibrage)
- `data/cameras.js` — liste des 11 caméras + plan de surveillance
- `data/animatronics.js` — les potes (id, nom, porte, chemin, comportement)
- `data/calls.js` — textes des appels téléphoniques (le **lore**, éditable)
- `assets/images/office/office.png` (bureau) · `FNAF_door.png` (porte)
- `assets/images/animatronics/joeffrey.png` (image de **base** d'un pote)
- `assets/images/jumpscares/whizip.png` (image de **jumpscare**)

**Modules JS** (chacun `init()` dans `Game.init`) : `Save`, `Sound`, `Sprites`,
`VHS`, `Screens`, `GameState`, `Clock`, `Power`, `Pan`, `Doors`, `Lights`,
`Cameras`, `AI`, `Jumpscare`, `Pause`, `Menu`, `PhoneCalls`, `EasterEggs`,
`NightIntro`, `Keys`, `Game`.

**Nuit : intro + 6 AM** — `Game.startNight` montre un carton **« Nuit X »** (module
`NightIntro`, ~3 s) puis appelle `Game.beginNight` qui démarre réellement la nuit.
La victoire 6h joue les **cloches** (`Sound.play("sixAM")`) + animation de l'écran 6 AM.

**Contrôles clavier** (module `Keys`, en plus souris/tactile) : **A/←** porte gauche,
**D/→** porte droite, **Q/E** (maintien) lumières, **Espace** caméras (actifs en partie ;
portes/lumières moniteur baissé). **Tactile** : défilement du bureau au doigt (`Pan` →
`touchmove`), zoom double-tap désactivé (meta viewport + `touch-action`).

**Partage** — favicon `assets/favicon.svg` (yeux dans le noir) + métadonnées Open Graph
dans `<head>` (vignette `screenshots/menu.png` quand on partage le lien Pages).

**Succès / trophées** (module `Achievements`, écran « Succès » du menu) : 14 succès
définis dans **`data/achievements.js`** (3 secrets), persistés dans
`Save.data.achievements`. `Achievements.unlock("<id>")` est appelé aux événements
(victoire/défaite/panne/golden/konami/mini-jeu) ; bandeau + son `sfx_achievement`.
Le « Reset progression » les efface aussi.

**Mini-jeu caché** (module `MiniGame`, façon FNAF 4) : déclencheur SECRET = un
**rituel d'actions** dans l'ordre (`MiniGame.SEQUENCE` + `MiniGame.feed`). Jetons
émis par : `Doors.toggle` (`Lc/Lo/Rc/Ro`), `Lights.set` à l'allumage (`Ll/Rl`),
`Cameras.raise/lower` (`Co/Cx`). Par défaut : `["Ll","Lc","Rl","Rc","Co","Cx"]`
(lumière+porte gauche, puis droite, puis lever/baisser les caméras). Toute erreur
ou délai > `SEQ_WINDOW` (4 s) réinitialise → impossible par hasard. Combo réussie →
`#secret-spot` pulse → clic = *tape-taupe* (15 pts / 30 s). Nuit **gelée**
(`GameState.minigame`, gate dans `Game.loop`/`Keys`/Échap). Gagner = succès `arcade`.
Réglages en tête du module (`SEQUENCE`, `SEQ_WINDOW`, `TARGET`, `DURATION`, `MOLE_MS`).

---

## DEUX TYPES D'IMAGES PAR POTE (optionnelles, drop-in)
Déposer au bon chemin = remplace le placeholder, **sans toucher au code**.
- **Base / perso** : `assets/images/animatronics/<id>.png` — affiché quand il *apparaît* (caméras, portes, fenêtres, panne).
- **Jumpscare** : `assets/images/jumpscares/<id>.png` — l'écran d'attaque.
- ids : `whizip`, `nolan`, `sidane`, `joeffrey` (minuscules).
- Idéalement **PNG détourés** (fond transparent). Un fond opaque (damier) est détouré automatiquement, mais le transparent est mieux.

## RESTE À FAIRE / À FOURNIR
- Images de **base** manquantes : `animatronics/{whizip,nolan,sidane}.png`
- **Jumpscares** manquants : `jumpscares/{nolan,sidane,joeffrey}.png`
- Images de **salles de caméra** : `assets/images/cameras/cam_<id>.png`
  (ids : `1A 1B 1C 2A 2B 3 4A 4B 5 6 7`) — sinon placeholder étiqueté.
- (Optionnel) overlays porte fermée / panne, polish écran 6 AM, etc.

---

## RÉGLAGES (où tuner)
- **Difficulté énergie** : `CONFIG.power.drainScale` (0.11) dans `script.js`.
- **Durée d'une nuit** : `CONFIG.nightRealSeconds` (400 s).
- **Heures** : `CONFIG.startHour` (23) → `CONFIG.endHour` (6).
- **Niveaux d'IA par nuit** : `data/nights.js`.
- **Vitesse/chemins des potes** : `data/animatronics.js` (`moveInterval`, `path`, et pour Sidané `stageInterval`/`runTime`/`blockPower`).
- **Durée du brouillage caméra** : `Cameras.scramble` (1000 ms).
- **Délai de grâce début de nuit** : `AI.GRACE_MS` (7000 ms).
- **Position des portes/fenêtres** sur l'image : `.doorway`, `#door-left/right`, `.window`, `#window-left/right` dans `style.css` (les fenêtres sont calées sur l'image actuelle ; à refaire si on change `office.png`).

## NOTES DEV
- Pour tester vite : monter un niveau d'IA en Nuit 1 (`data/nights.js`), ou
  `CONFIG.power.drainScale` à 2 pour déclencher la panne, puis remettre.
- Débloquer la Custom Night en test : console → `Save.unlockCustom()`.
- Git : on commit régulièrement ; `.claude/` est gitignoré.
- Le filtre VHS est **global** (`#vhs-overlay`) mais masqué sur le bureau (visible sur menus + caméras).
