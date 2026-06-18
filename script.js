/* =========================================================
   FNAF ENTRE POTES — Script principal
   PHASE 1 : Bureau + Interface

   Organisation (modules ajoutés au fil des phases) :
     - CONFIG    : constantes de gameplay (issues du cahier des charges)
     - Screens   : gestion des écrans (bureau, menu, caméras, ...)
     - GameState : état courant de la partie
     - Clock     : progression du temps 00:00 -> 06:00
     - Power     : affichage de l'énergie (drain réel = Phase 5)
     - Game      : boucle principale + démarrage / fin de nuit

   Tout est volontairement commenté et modulaire pour rester facile à modifier.
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG — valeurs de gameplay (cf. cahier des charges)
   ========================================================= */
const CONFIG = {
  // Durée réelle d'une nuit, en secondes (le cahier vise 6 à 8 min => ~400 s).
  nightRealSeconds: 400,

  // La nuit démarre à 23h et se termine à 06h (passage par minuit) = 7 heures
  // de jeu. Seule l'heure est affichée (pas les minutes), façon FNAF.
  startHour: 23,
  endHour: 6,

  // --- Énergie ---
  power: {
    start: 100,        // énergie de départ
    baseDrain: 1,      // poids de base
    perCamera: 0.5,    // surcoût caméras ouvertes
    perDoor: 1,        // surcoût par porte fermée
    perLight: 0.5,     // surcoût par lumière allumée
    // Facteur global : convertit les "poids" ci-dessus en %/seconde réelle.
    // 0.16 => au repos (poids 1) on perd ~64% sur une nuit de 400 s : on tient
    // la nuit en gérant bien, mais tout laisser allumé vide la jauge. À régler
    // pour ajuster la difficulté.
    drainScale: 0.16,
    lowThreshold: 30,  // seuil "attention" (jaune)
    critThreshold: 10, // seuil "critique" (rouge)
  },
};

/* =========================================================
   Save — progression sauvegardée dans le navigateur (localStorage)
   On retient la nuit la plus haute débloquée (1 à 5).
   ========================================================= */
const Save = {
  KEY: "fnaf_entre_potes_save",
  data: { unlocked: 1 },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) {
      /* sauvegarde illisible : on garde les valeurs par défaut */
    }
  },

  persist() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {
      /* stockage indisponible : on ignore */
    }
  },

  // Débloque la nuit n si elle est plus avancée que la progression actuelle.
  unlock(n) {
    const max = NIGHTS.length;
    const target = Math.min(n, max);
    if (target > this.data.unlocked) {
      this.data.unlocked = target;
      this.persist();
    }
  },
};

/* =========================================================
   Screens — montre un écran, cache les autres
   ========================================================= */
const Screens = {
  show(id) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
    VHS.update();          // le filtre VHS dépend de l'écran affiché
  },
};

/* =========================================================
   VHS — pilote l'overlay VHS global.
   Pour l'instant : visible PARTOUT sauf sur le bureau ; mais réactivé
   quand on lève le moniteur caméras (les caméras gardent l'effet VHS).
   ========================================================= */
const VHS = {
  el: null,

  init() {
    this.el = document.getElementById("vhs-overlay");
    this.update();
  },

  update() {
    if (!this.el) return;
    const officeActive = document
      .getElementById("office-screen")
      .classList.contains("active");
    // Affiché si on n'est pas dans le bureau, OU si le moniteur est levé.
    const show = !officeActive || GameState.cameraOpen;
    this.el.classList.toggle("off", !show);
  },
};

/* =========================================================
   GameState — état courant de la partie
   ========================================================= */
const GameState = {
  night: 1,          // nuit en cours
  running: false,    // la nuit est-elle active ?
  elapsed: 0,        // temps réel écoulé dans la nuit (secondes)
  power: CONFIG.power.start,

  // État des commandes du joueur (câblé en Phase 3/4).
  doors:  { left: false, right: false }, // true = porte fermée
  lights: { left: false, right: false }, // true = lumière allumée
  cameraOpen: false,

  reset(night) {
    this.night = night;
    this.running = false;
    this.elapsed = 0;
    this.power = CONFIG.power.start;
    this.doors  = { left: false, right: false };
    this.lights = { left: false, right: false };
    this.cameraOpen = false;
  },
};

/* =========================================================
   Clock — convertit le temps réel écoulé en heure de jeu
   et met à jour l'affichage 00:00 -> 06:00.
   ========================================================= */
const Clock = {
  el: null,

  init() {
    this.el = document.getElementById("clock");
  },

  // Nombre d'heures de jeu sur la nuit (23h -> 06h = 7), passage par minuit géré.
  totalHours() {
    return ((CONFIG.endHour - CONFIG.startHour + 24) % 24) || 24;
  },

  // Avancement de la nuit, de 0 (début) à 1 (06h).
  progress() {
    return Math.min(1, GameState.elapsed / CONFIG.nightRealSeconds);
  },

  // Heure de jeu courante en valeur continue (peut dépasser 24 avant le modulo).
  currentHour() {
    return CONFIG.startHour + this.progress() * this.totalHours();
  },

  // Affiche uniquement l'heure (ex. "23h", "00h", ... "06h").
  update() {
    const h = Math.floor(this.currentHour()) % 24;
    if (this.el) this.el.textContent = String(h).padStart(2, "0") + "h";
  },
};

/* =========================================================
   Power — affichage de l'énergie.
   NB : en Phase 1 on n'applique pas encore le drain (Phase 5) ;
   ce module gère surtout le rendu du HUD et la consommation prévue.
   ========================================================= */
const Power = {
  hudEl: null,
  valueEl: null,
  usageEl: null,

  init() {
    this.hudEl = document.getElementById("hud-power");
    this.valueEl = document.getElementById("power-value");
    this.usageEl = document.getElementById("power-usage");
  },

  // Nombre de "barres" de consommation actives (1 de base + commandes).
  usageBars() {
    let bars = 1; // consommation de base
    if (GameState.cameraOpen) bars++;
    if (GameState.doors.left) bars++;
    if (GameState.doors.right) bars++;
    if (GameState.lights.left) bars++;
    if (GameState.lights.right) bars++;
    return bars;
  },

  // Vitesse de drain courante en %/seconde (poids du cahier x facteur global).
  drainRate() {
    const c = CONFIG.power;
    let weight = c.baseDrain;
    if (GameState.cameraOpen) weight += c.perCamera;
    if (GameState.doors.left) weight += c.perDoor;
    if (GameState.doors.right) weight += c.perDoor;
    if (GameState.lights.left) weight += c.perLight;
    if (GameState.lights.right) weight += c.perLight;
    return weight * c.drainScale;
  },

  // Applique le drain sur un pas de temps dt (en secondes). Borne à 0.
  applyDrain(dt) {
    GameState.power = Math.max(0, GameState.power - this.drainRate() * dt);
  },

  update() {
    const p = Math.max(0, Math.round(GameState.power));
    if (this.valueEl) this.valueEl.textContent = p;
    if (this.usageEl) this.usageEl.textContent = "▮".repeat(this.usageBars());

    // Couleur du HUD selon le niveau d'énergie.
    if (this.hudEl) {
      this.hudEl.classList.toggle("crit", p <= CONFIG.power.critThreshold);
      this.hudEl.classList.toggle(
        "low",
        p > CONFIG.power.critThreshold && p <= CONFIG.power.lowThreshold
      );
    }
  },
};

/* =========================================================
   Pan — défilement panoramique du bureau.
   Le bureau (#office-world) est plus large que l'écran (#office-view).
   On le translate horizontalement selon la position de la souris :
   souris à gauche -> on regarde la porte gauche, et inversement.
   Un léger lissage (lerp) rend le mouvement fluide façon FNAF.
   ========================================================= */
const Pan = {
  viewEl: null,
  worldEl: null,
  targetX: 0,    // décalage visé (px)
  currentX: 0,   // décalage courant lissé (px)
  enabled: true, // désactivé quand on regarde les caméras (Phase 2)

  init() {
    this.viewEl = document.getElementById("office-view");
    this.worldEl = document.getElementById("office-world");
    this.viewEl.addEventListener("mousemove", (e) => this.onMove(e));
    requestAnimationFrame(() => this.frame());
  },

  onMove(e) {
    if (!this.enabled) return;
    const viewW = this.viewEl.clientWidth;
    const worldW = this.worldEl.scrollWidth;
    const maxShift = Math.max(0, worldW - viewW); // marge de défilement dispo
    const ratio = Math.min(1, Math.max(0, e.clientX / viewW)); // 0 (gauche) -> 1 (droite)
    this.targetX = -ratio * maxShift;
  },

  // Boucle de rendu : rapproche doucement currentX de targetX.
  frame() {
    this.currentX += (this.targetX - this.currentX) * 0.12;
    if (this.worldEl) {
      this.worldEl.style.transform = `translateX(${this.currentX.toFixed(1)}px)`;
    }
    requestAnimationFrame(() => this.frame());
  },
};

/* =========================================================
   Doors — portes gauche/droite (Phase 3)
   Clic sur le bouton PORTE -> ferme/ouvre la porte : le volet descend,
   et la porte fermée consomme de l'énergie (via Power, +1 par porte).
   Une porte fermée bloquera les animatroniques de ce côté (Phases 6-9).
   ========================================================= */
const Doors = {
  init() {
    document.querySelectorAll(".door-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.toggle(btn.dataset.side));
    });
  },

  toggle(side) {
    if (!GameState.running) return;        // pas d'action hors partie
    GameState.doors[side] = !GameState.doors[side];
    this.render(side);
    Power.update();                        // la conso change immédiatement
  },

  // Met l'affichage (bouton + volet) en accord avec l'état du jeu.
  render(side) {
    const closed = GameState.doors[side];
    document
      .querySelector(`.door-btn[data-side="${side}"]`)
      .classList.toggle("active", closed);
    document.getElementById(`door-${side}`).classList.toggle("closed", closed);
  },

  // Réaligne les deux portes sur l'état courant (au début d'une nuit).
  refresh() {
    this.render("left");
    this.render("right");
  },
};

/* =========================================================
   Lights — lumières des couloirs (Phase 4)
   On MAINTIENT le bouton LUMIÈRE pour éclairer le couloir (et repérer un
   animatronique) : la lumière consomme de l'énergie tant qu'elle est allumée,
   ce qui incite à des coups d'œil brefs, comme dans FNAF.
   ========================================================= */
const Lights = {
  init() {
    document.querySelectorAll(".light-btn").forEach((btn) => {
      const side = btn.dataset.side;
      const on = (e) => { e.preventDefault(); this.set(side, true); };
      const off = () => this.set(side, false);
      // Souris : allumé pendant l'appui, éteint au relâchement / sortie.
      btn.addEventListener("mousedown", on);
      btn.addEventListener("mouseup", off);
      btn.addEventListener("mouseleave", off);
      // Tactile.
      btn.addEventListener("touchstart", on, { passive: false });
      btn.addEventListener("touchend", off);
    });
  },

  set(side, state) {
    // Hors partie : tout éteint.
    const next = GameState.running ? state : false;
    if (GameState.lights[side] === next) return;
    GameState.lights[side] = next;
    this.render(side);
    Power.update();                  // la conso change immédiatement
  },

  render(side) {
    const on = GameState.lights[side];
    document
      .querySelector(`.light-btn[data-side="${side}"]`)
      .classList.toggle("active", on);
    document.getElementById(`door-${side}`).classList.toggle("lit", on);
  },

  refresh() {
    this.render("left");
    this.render("right");
  },
};

/* =========================================================
   Cameras — moniteur de surveillance (Phase 2)
   Lève/baisse le moniteur, construit la carte, change de caméra,
   et affiche le flux (placeholder tant que la vraie image est absente).
   Lever le moniteur : coupe le défilement du bureau et fait consommer
   de l'énergie (GameState.cameraOpen, pris en compte par Power).
   ========================================================= */
const Cameras = {
  monitorEl: null,
  holderEl: null,
  labelEl: null,
  feedEl: null,
  flipEl: null,
  flipLabelEl: null,
  lastFlip: 0,
  current: DEFAULT_CAMERA,

  init() {
    this.monitorEl = document.getElementById("monitor");
    this.holderEl = document.getElementById("cam-image-holder");
    this.labelEl = document.getElementById("cam-label");
    this.feedEl = document.getElementById("cam-feed");
    this.flipEl = document.getElementById("cam-flip");
    this.flipLabelEl = document.getElementById("cam-flip-label");

    this.buildMap();

    // Survol de la barre = lever/baisser le moniteur (façon FNAF).
    // mouseenter ne se redéclenche pas tant qu'on reste dessus : il faut
    // ressortir puis revenir pour rebasculer (pas de clignotement).
    this.flipEl.addEventListener("mouseenter", () => this.flip());
    this.flipEl.addEventListener("click", () => this.flip()); // secours tactile
  },

  // Bascule anti-rebond (ignore deux déclenchements trop rapprochés).
  flip() {
    const now = performance.now();
    if (now - this.lastFlip < 250) return;
    this.lastFlip = now;
    this.toggle();
  },

  // Construit le plan, fidèle à la map FNAF :
  //   local central + couloirs (SVG) + cabines + repère YOU + boîtes CAM.
  buildMap() {
    const container = document.getElementById("cam-map-buttons");
    container.innerHTML = "";

    // --- 1) Calque SVG (local + couloirs). viewBox 0..100 + preserveAspectRatio
    //        "none" => mêmes coordonnées % que les boîtes, donc tout est aligné.
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("id", "cam-map-paths");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    // Le grand local central (Dining Area).
    const room = document.createElementNS(ns, "rect");
    room.setAttribute("x", ROOM_RECT.x1);
    room.setAttribute("y", ROOM_RECT.y1);
    room.setAttribute("width", ROOM_RECT.x2 - ROOM_RECT.x1);
    room.setAttribute("height", ROOM_RECT.y2 - ROOM_RECT.y1);
    room.setAttribute("class", "cam-room");
    svg.appendChild(room);

    // Les couloirs (polylignes orthogonales).
    CORRIDORS.forEach((c) => {
      const poly = document.createElementNS(ns, "polyline");
      poly.setAttribute("points", c.points.map((p) => p.join(",")).join(" "));
      poly.setAttribute("class", "cam-path");
      svg.appendChild(poly);
    });
    container.appendChild(svg);

    // --- 2) Petites pièces sans caméra (cabines des toilettes).
    DECO_BOXES.forEach((b) => {
      const box = document.createElement("div");
      box.className = "cam-deco";
      box.style.setProperty("--x", b.x + "%");
      box.style.setProperty("--y", b.y + "%");
      box.style.setProperty("--w", b.w + "%");
      box.style.setProperty("--h", b.h + "%");
      container.appendChild(box);
    });

    // --- 3) Repère du bureau ("YOU") avec son carré blanc.
    const office = document.createElement("div");
    office.id = "cam-map-office";
    office.style.setProperty("--x", OFFICE_POS.x + "%");
    office.style.setProperty("--y", OFFICE_POS.y + "%");
    office.innerHTML = `<span class="you-label">YOU</span><span class="you-square"></span>`;
    container.appendChild(office);

    // --- 4) Boîtes CAM (deux lignes : "CAM" + id), comme dans le jeu.
    CAMERAS.forEach((cam) => {
      const btn = document.createElement("button");
      btn.className = "cam-btn";
      btn.innerHTML = `<span class="cam-btn-top">CAM</span><span class="cam-btn-id">${cam.id}</span>`;
      btn.title = cam.name;
      btn.style.setProperty("--x", cam.map.x + "%");
      btn.style.setProperty("--y", cam.map.y + "%");
      btn.dataset.id = cam.id;
      btn.addEventListener("click", () => this.select(cam.id));
      container.appendChild(btn);
    });
  },

  toggle() {
    if (GameState.cameraOpen) this.lower();
    else this.raise();
  },

  raise() {
    if (!GameState.running) return;
    GameState.cameraOpen = true;
    Pan.enabled = false;             // on ne tourne plus la tête dans le bureau
    this.monitorEl.classList.remove("hidden");
    this.flipEl.classList.add("up"); // flèches vers le bas + label "FERMER"
    this.flipLabelEl.textContent = "FERMER";
    this.select(this.current);       // (ré)affiche la dernière caméra vue
    Power.update();                  // la conso caméra apparaît tout de suite
    VHS.update();                    // effet VHS visible sur les caméras
  },

  lower() {
    GameState.cameraOpen = false;
    Pan.enabled = true;
    this.monitorEl.classList.add("hidden");
    this.flipEl.classList.remove("up");
    this.flipLabelEl.textContent = "CAMÉRAS";
    Power.update();
    VHS.update();                    // retour au bureau : pas de VHS
  },

  // Sélectionne une caméra et affiche son flux.
  select(id) {
    this.current = id;
    const cam = getCamera(id);

    // Surligne le bouton actif sur la carte.
    document.querySelectorAll(".cam-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.id === id);
    });

    // Étiquette.
    this.labelEl.textContent = `CAM ${cam.id} — ${cam.name}`;

    // Petit flash de grésillement à chaque changement de caméra.
    // (on retire puis remet la classe, avec un reflow, pour rejouer l'anim)
    this.feedEl.classList.remove("switching");
    void this.feedEl.offsetWidth;
    this.feedEl.classList.add("switching");

    this.render(cam);
    this.updateOccupants();
  },

  // Affiche les animatroniques présents dans la caméra actuellement visionnée.
  // Séparé de render() pour pouvoir rafraîchir sans recharger l'image quand
  // un animatronique se déplace pendant qu'on regarde.
  updateOccupants() {
    const holder = document.getElementById("cam-occupants");
    holder.innerHTML = "";
    if (!GameState.cameraOpen) return;
    AI.actorsInRoom(this.current).forEach((act) => {
      const def = act.def;
      const el = document.createElement("div");
      el.className = "cam-occupant";
      // Foxy : on affiche son état courant (0 caché -> 2 prépare).
      const stage =
        def.type === "foxy" ? `<div class="occ-stage">état ${act.stage}/3</div>` : "";
      el.innerHTML =
        `<div class="occ-figure"></div><div class="occ-name">${def.name}</div>${stage}`;
      holder.appendChild(el);
    });
  },

  // Affiche le placeholder + tente de charger la vraie image par-dessus.
  // Si l'image n'existe pas (404), le <img> se retire et le placeholder reste.
  render(cam) {
    this.holderEl.innerHTML = `
      <div class="cam-placeholder">
        <span class="cam-ph-id">CAM ${cam.id}</span>
        <span class="cam-ph-name">${cam.name}</span>
        <span class="cam-ph-zone">zone perso</span>
      </div>`;

    const img = new Image();
    img.className = "cam-img";
    img.onload = () => this.holderEl.appendChild(img); // couvre le placeholder
    img.onerror = () => {};                            // garde le placeholder
    img.src = cam.image;
  },
};

/* =========================================================
   Menu — menu principal, sélection de nuit, crédits (Phase 13)
   ========================================================= */
const Menu = {
  init() {
    document.getElementById("btn-new").addEventListener("click", () => {
      Game.startNight(1);                       // Nouvelle partie -> Nuit 1
    });
    document.getElementById("btn-continue").addEventListener("click", () => {
      Game.startNight(Save.data.unlocked);      // Continuer -> dernière nuit débloquée
    });
    document.getElementById("btn-select").addEventListener("click", () => {
      this.showSelect();
    });
    document.getElementById("btn-credits").addEventListener("click", () => {
      Screens.show("credits-screen");
    });

    // Tous les boutons "Retour" / "Menu" ramènent au menu principal.
    document.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => this.show());
    });
  },

  // Affiche le menu principal et rafraîchit l'état du bouton "Continue".
  show() {
    Screens.show("menu-screen");
    // "Continue" n'a de sens que si on a dépassé la nuit 1.
    document.getElementById("btn-continue").disabled = Save.data.unlocked <= 1;
  },

  // Construit et affiche la grille de sélection de nuit.
  showSelect() {
    const list = document.getElementById("night-list");
    list.innerHTML = "";
    NIGHTS.forEach((night) => {
      const unlocked = night.id <= Save.data.unlocked;
      const btn = document.createElement("button");
      btn.className = "night-btn";
      btn.disabled = !unlocked;
      btn.innerHTML = `<span class="n-num">${night.id}</span>
        <span class="n-lock">${unlocked ? "Nuit" : "🔒"}</span>`;
      if (unlocked) btn.addEventListener("click", () => Game.startNight(night.id));
      list.appendChild(btn);
    });
    Screens.show("select-screen");
  },
};

/* =========================================================
   AI — intelligence des animatroniques (Phases 6-9)
   Modèle FNAF : toutes les moveInterval, chaque animatronique "actif" tire
   un dé (1-20). Si tirage <= aiLevel, il avance d'une salle vers sa porte.
   Arrivé au corner, à sa tentative suivante :
     - porte fermée  -> bloqué, il repart au début ;
     - porte ouverte -> il entre -> attaque (défaite).
   ========================================================= */
const AI = {
  actors: [],   // animatroniques actifs cette nuit

  // Prépare les animatroniques selon la nuit (aiLevel > 0 = actif).
  init(night) {
    const cfg = getNightConfig(night);
    this.actors = ANIMATRONICS.filter((a) => (cfg.ai[a.id] || 0) > 0).map(
      (def) => {
        const base = { def, level: cfg.ai[def.id] };
        if (def.type === "foxy") {
          // État machine spéciale : 0 caché, 1 observe, 2 prépare, 3 course.
          return { ...base, stage: 0, running: false, runTimer: 0, timer: def.stageInterval };
        }
        // Marcheur classique : position le long du chemin.
        return { ...base, index: 0, timer: def.moveInterval };
      }
    );
    this.renderAll();
  },

  reset() {
    this.actors = [];
    this.renderAll();
  },

  // Salle (id de caméra) où se trouve un animatronique (null = invisible).
  roomOf(act) {
    if (act.def.type === "foxy") {
      // Visible dans Pirate Cove tant qu'il n'a pas foncé.
      return act.running || act.stage >= 3 ? null : act.def.cove;
    }
    return act.def.path[act.index];
  },

  // Est-il posté au bout de son couloir (corner), prêt à entrer ?
  atCorner(act) {
    return act.def.type !== "foxy" && act.index === act.def.path.length - 1;
  },

  // Animatroniques (défs) présents dans une salle donnée.
  occupantsInRoom(id) {
    return this.actors.filter((a) => this.roomOf(a) === id).map((a) => a.def);
  },

  // Acteurs (état complet) présents dans une salle — pour l'affichage caméra.
  actorsInRoom(id) {
    return this.actors.filter((a) => this.roomOf(a) === id);
  },

  tick(dt) {
    if (!this.actors.length) return;
    const dtMs = dt * 1000;
    this.actors.forEach((act) => {
      if (act.def.type === "foxy") this.tickFoxy(act, dtMs);
      else this.tickStandard(act, dtMs);
    });
  },

  /* ---- Marcheur classique (Whizip, Nolan, Joeffrey) ---- */
  tickStandard(act, dtMs) {
    // Joeffrey (Freddy) : se fige tant qu'on regarde la caméra où il se trouve.
    if (
      act.def.freezeWhenWatched &&
      GameState.cameraOpen &&
      Cameras.current === this.roomOf(act)
    ) {
      act.timer = act.def.moveInterval;   // son compteur ne descend pas
      return;
    }
    act.timer -= dtMs;
    if (act.timer <= 0) {
      act.timer += act.def.moveInterval;
      this.attemptMove(act);
    }
  },

  attemptMove(act) {
    const roll = 1 + Math.floor(Math.random() * 20);
    if (roll > act.level) return;             // échec : il reste sur place

    const lastIndex = act.def.path.length - 1;
    if (act.index < lastIndex) {
      act.index++;                            // avance d'une salle
      this.onMoved(act);
    } else {
      // Au corner : tentative d'entrée dans le bureau.
      if (GameState.doors[act.def.door]) {
        act.index = 0;                        // porte fermée -> il repart
        this.onMoved(act);
      } else {
        Game.caught(act.def);                 // porte ouverte -> attaque
      }
    }
  },

  /* ---- Foxy (Sidané) : états + course ---- */
  tickFoxy(act, dtMs) {
    // Phase de course : il fonce vers la porte gauche.
    if (act.running) {
      act.runTimer -= dtMs;
      if (act.runTimer <= 0) {
        if (GameState.doors[act.def.door]) {
          // Porte fermée : il cogne, repart se cacher, et grignote l'énergie.
          act.running = false;
          act.stage = 0;
          act.timer = act.def.stageInterval;
          GameState.power = Math.max(0, GameState.power - act.def.blockPower);
          Power.update();
          console.log("[IA] Sidané bloqué à la porte — il repart se cacher.");
          this.onMoved(act);
        } else {
          Game.caught(act.def);               // porte ouverte -> attaque
        }
      }
      return;
    }

    // Le surveiller à la caméra de Pirate Cove le maintient en place.
    if (GameState.cameraOpen && Cameras.current === act.def.cove) {
      act.timer = act.def.stageInterval;
      return;
    }

    // Sinon, il progresse d'un état à chaque tentative réussie.
    act.timer -= dtMs;
    if (act.timer <= 0) {
      act.timer += act.def.stageInterval;
      const roll = 1 + Math.floor(Math.random() * 20);
      if (roll > act.level) return;
      act.stage++;
      if (act.stage >= 3) {
        act.running = true;                   // il sort du rideau et fonce
        act.runTimer = act.def.runTime;
        console.log("[IA] Sidané FONCE vers la porte gauche !");
      } else {
        console.log(`[IA] Sidané passe en état ${act.stage}.`);
      }
      this.onMoved(act);
    }
  },

  onMoved(act) {
    const room = this.roomOf(act);
    if (act.def.type !== "foxy") console.log(`[IA] ${act.def.name} -> ${room}`);
    this.renderAll();
  },

  // Met à jour les "révélateurs" : silhouettes au bureau + flux caméra.
  renderAll() {
    // Bureau : silhouette au corner, révélée par la lumière du bon côté.
    ["left", "right"].forEach((side) => {
      const occEl = document.querySelector(`#door-${side} .occupant`);
      if (!occEl) return;
      const here = this.actors.filter((a) => this.atCorner(a) && a.def.door === side);
      occEl.classList.toggle("present", here.length > 0);
      if (here.length) {
        occEl.querySelector(".occ-name").textContent = here
          .map((a) => a.def.name)
          .join(" · ");
      }
    });
    // Caméras : rafraîchit la salle visionnée si le moniteur est levé.
    if (GameState.cameraOpen) Cameras.updateOccupants();
  },
};

/* =========================================================
   Jumpscare — écran d'attaque + cri (Phase 10)
   Affiche l'image du pote (assets/images/jumpscares/<id>.png) si elle existe,
   sinon le visage placeholder CSS. Le son tente le fichier .mp3 du pote, et à
   défaut un cri synthétisé en Web Audio (aucun fichier requis).
   ========================================================= */
const Jumpscare = {
  el: null,
  imgEl: null,
  nameEl: null,

  init() {
    this.el = document.getElementById("jumpscare");
    this.imgEl = document.getElementById("jumpscare-img");
    this.nameEl = document.getElementById("jumpscare-name");
  },

  // Joue le jumpscare de `def`, puis appelle onDone (~1,1 s).
  play(def, onDone) {
    this.nameEl.textContent = def.name || "";

    // Vraie image si dispo ; sinon on garde le visage placeholder.
    this.imgEl.classList.add("hidden");
    this.imgEl.onload = () => this.imgEl.classList.remove("hidden");
    this.imgEl.onerror = () => this.imgEl.classList.add("hidden");
    this.imgEl.src = `assets/images/jumpscares/${def.id}.png`;

    this.el.classList.remove("hidden");
    this.el.classList.add("active");
    this.playSound(def);

    setTimeout(() => {
      this.el.classList.remove("active");
      this.el.classList.add("hidden");
      if (onDone) onDone();
    }, 1100);
  },

  // Son : tente le fichier du pote, sinon cri synthétisé.
  playSound(def) {
    let handled = false;
    const fallback = () => {
      if (handled) return;
      handled = true;
      this.screech();
    };
    try {
      const audio = new Audio(`assets/sounds/jumpscares/${def.id}.mp3`);
      audio.volume = 1;
      audio.onerror = fallback;
      const p = audio.play();
      if (p && p.catch) p.catch(fallback);
    } catch (e) {
      fallback();
    }
  },

  // Cri d'horreur généré (bruit filtré + oscillateurs descendants).
  screech() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const dur = 0.9;
      const t0 = ctx.currentTime;

      // Bruit blanc filtré.
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1100;
      bp.Q.value = 0.6;

      // Deux oscillateurs qui plongent dans les graves.
      const o1 = ctx.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(240, t0);
      o1.frequency.exponentialRampToValueAtTime(70, t0 + dur);
      const o2 = ctx.createOscillator();
      o2.type = "square";
      o2.frequency.setValueAtTime(360, t0);
      o2.frequency.exponentialRampToValueAtTime(110, t0 + dur);

      // Enveloppe : attaque sèche puis extinction.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      noise.connect(bp);
      bp.connect(g);
      o1.connect(g);
      o2.connect(g);
      g.connect(ctx.destination);

      noise.start(t0); o1.start(t0); o2.start(t0);
      noise.stop(t0 + dur); o1.stop(t0 + dur); o2.stop(t0 + dur);
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, (dur + 0.2) * 1000);
    } catch (e) {
      /* Web Audio indisponible : pas de son */
    }
  },
};

/* =========================================================
   Game — boucle principale et cycle de vie de la nuit
   ========================================================= */
const Game = {
  lastTime: 0,

  // Initialise les modules, démarre la boucle, et affiche le menu principal.
  init() {
    Save.load();
    VHS.init();
    Clock.init();
    Power.init();
    Pan.init();
    Doors.init();
    Lights.init();
    Cameras.init();
    Jumpscare.init();
    Menu.init();

    // La boucle tourne en permanence ; tick() ne s'exécute que pendant une nuit.
    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));

    Menu.show();
  },

  startNight(night) {
    GameState.reset(night);
    GameState.running = true;
    Screens.show("office-screen");
    Doors.refresh();
    Lights.refresh();
    AI.init(night);
    Clock.update();
    Power.update();
  },

  // Boucle appelée à chaque frame ; dt = secondes depuis la frame précédente.
  // lastTime est mis à jour à CHAQUE frame (même au menu) pour éviter un dt
  // énorme au lancement d'une nuit après un passage par le menu.
  loop(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    if (GameState.running) {
      this.tick(dt);
    }

    requestAnimationFrame((t) => this.loop(t));
  },

  // Un "tick" de jeu (dt en secondes).
  // L'ordre suit le cahier des charges :
  //   IA -> énergie -> portes/lumières/caméras -> victoire/défaite.
  // Les blocs IA et énergie seront remplis dans les phases suivantes.
  tick(dt) {
    // Avancement du temps de la nuit.
    GameState.elapsed += dt;

    // Mise à jour de l'IA des animatroniques.
    AI.tick(dt);

    // Drain de l'énergie selon les commandes actives.
    Power.applyDrain(dt);

    // Mise à jour de l'affichage.
    Clock.update();
    Power.update();

    // Défaite par panne : plus d'énergie.
    if (GameState.power <= 0) {
      this.powerOut();
      return;
    }

    // Victoire : on a atteint 06h (fin de la nuit).
    if (Clock.progress() >= 1) {
      this.winNight();
    }
  },

  winNight() {
    GameState.running = false;
    Cameras.lower();
    AI.reset();

    // Déblocage de la nuit suivante + écran de victoire 6 AM.
    const n = GameState.night;
    Save.unlock(n + 1);
    const isLast = n >= NIGHTS.length;
    document.getElementById("win-text").textContent = isLast
      ? `Nuit ${n} terminée — tu as survécu à toutes les nuits, bravo !`
      : `Nuit ${n} terminée ! Nuit ${n + 1} débloquée.`;
    Screens.show("win-screen");
  },

  // Un animatronique est entré dans le bureau : jumpscare puis Game Over.
  caught(def) {
    GameState.running = false;
    Cameras.lower();
    Jumpscare.play(def, () => this.loseNight());
  },

  // Panne de courant : tout se coupe, puis Joeffrey surgit dans le noir.
  powerOut() {
    GameState.running = false;
    Cameras.lower();

    // Coupure : les portes se rouvrent (volets remontés), lumières éteintes.
    GameState.doors.left = false;
    GameState.doors.right = false;
    GameState.lights.left = false;
    GameState.lights.right = false;
    Doors.refresh();
    Lights.refresh();

    // Séquence de panne : écran noir + yeux, puis jumpscare de Joeffrey.
    const blackout = document.getElementById("blackout");
    blackout.classList.remove("hidden");
    const killer = getAnimatronic("joeffrey") || { id: "joeffrey", name: "Joeffrey" };
    setTimeout(() => {
      Jumpscare.play(killer, () => {
        blackout.classList.add("hidden");
        this.loseNight();
      });
    }, 2200);
  },

  loseNight() {
    GameState.running = false;
    Cameras.lower();
    AI.reset();
    // (Phase 10) le jumpscare s'intercalera ici, avant l'écran Game Over.
    Screens.show("gameover-screen");
  },
};

/* =========================================================
   Démarrage
   ========================================================= */
window.addEventListener("DOMContentLoaded", () => {
  Game.init();
});
