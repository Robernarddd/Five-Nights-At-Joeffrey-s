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
    // 0.11 => au repos (poids 1) on perd ~44% sur une nuit de 400 s : la batterie
    // dure plus longtemps, mais tout laisser allumé vide quand même la jauge.
    // À régler pour ajuster la difficulté (plus bas = batterie plus lente).
    drainScale: 0.11,
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
  data: { unlocked: 1, customUnlocked: false, achievements: {} },

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

  // Débloque la Custom Night (après avoir fini la dernière nuit).
  unlockCustom() {
    if (!this.data.customUnlocked) {
      this.data.customUnlocked = true;
      this.persist();
    }
  },

  // Réinitialise TOUTE la progression (nuits, Custom Night, succès),
  // comme une nouvelle installation du jeu.
  reset() {
    this.data = { unlocked: 1, customUnlocked: false, achievements: {} };
    this.persist();
  },
};

/* =========================================================
   Sound — audio du jeu, entièrement synthétisé (Web Audio).
   Aucun fichier requis. Un fichier réel (assets/sounds/...) pourra plus tard
   remplacer un effet, mais par défaut tout est généré ici.
   - sons ponctuels : Sound.play("nom")
   - boucles        : Sound.startLoop("nom") / stopLoop("nom")
   - mute + volume persistants (localStorage), réglés via le menu pause
   ========================================================= */
const Sound = {
  ctx: null,
  master: null,
  muted: false,
  volume: 0.6,
  loops: {},
  KEY: "fnaf_joeffrey_muted",
  VOLKEY: "fnaf_joeffrey_volume",

  init() {
    try {
      this.muted = localStorage.getItem(this.KEY) === "1";
      const v = parseFloat(localStorage.getItem(this.VOLKEY));
      if (!isNaN(v)) this.volume = Math.min(1, Math.max(0, v));
    } catch (e) {}
    // Le navigateur exige une interaction avant de jouer du son : on relance
    // le contexte au premier geste — SAUF en pause (sinon cliquer dans le menu
    // pause réveillerait l'audio qu'on vient justement de suspendre).
    const resume = () => { if (!GameState.paused) this.resume(); };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  },

  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  },
  resume() {
    const c = this.ensure();
    if (c && c.state === "suspended") c.resume();
  },
  suspend() {
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
  },

  setMute(m) {
    this.muted = m;
    try { localStorage.setItem(this.KEY, m ? "1" : "0"); } catch (e) {}
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  },
  toggleMute() { this.setMute(!this.muted); },
  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem(this.VOLKEY, String(this.volume)); } catch (e) {}
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  },

  // Effet ponctuel.
  play(name) {
    if (this.muted) return;
    const c = this.ensure();
    if (!c) return;
    this.resume();
    const gen = this["sfx_" + name];
    if (gen) gen.call(this, c, this.master);
  },

  // Boucles (démarrées même en sourdine : le master à 0 les rend muettes).
  startLoop(name) {
    if (this.loops[name]) return;
    const c = this.ensure();
    if (!c) return;
    this.resume();
    const gen = this["loop_" + name];
    if (gen) this.loops[name] = gen.call(this, c, this.master);
  },
  stopLoop(name) {
    const h = this.loops[name];
    if (!h) return;
    try { h.stop(); } catch (e) {}
    delete this.loops[name];
  },
  stopAllLoops() {
    Object.keys(this.loops).forEach((n) => this.stopLoop(n));
  },

  /* ---- Helpers ---- */
  _noise(c, dur, loop) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (loop) src.loop = true;
    return src;
  },
  _melody(c, out, notes, timbre) {
    const t0 = c.currentTime;
    let t = t0;
    notes.forEach(([freq, dur]) => {
      if (freq) {
        const o = c.createOscillator();
        o.type = timbre || "triangle";
        o.frequency.value = freq;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.92);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + dur);
      }
      t += dur;
    });
  },

  /* ---- Effets ponctuels ---- */
  sfx_camSwitch(c, out) {
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = 760;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.09);
  },
  _kachunk(c, out, hi) {
    const t = c.currentTime;
    const n = this._noise(c, 0.12);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(lp); lp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.12);
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(hi ? 220 : 160, t);
    o.frequency.exponentialRampToValueAtTime(hi ? 120 : 80, t + 0.1);
    const og = c.createGain();
    og.gain.setValueAtTime(0.14, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
  },
  sfx_camOpen(c, out) { this._kachunk(c, out, true); },
  sfx_camClose(c, out) { this._kachunk(c, out, false); },

  _door(c, out, thudFrom, thudTo) {
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(thudFrom, t);
    o.frequency.exponentialRampToValueAtTime(thudTo, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.26);
    const n = this._noise(c, 0.16);
    const hp = c.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 1600;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.16);
  },
  sfx_doorClose(c, out) { this._door(c, out, 150, 48); },
  sfx_doorOpen(c, out) { this._door(c, out, 90, 130); },

  // Coups sourds : un pote vient d'arriver au bout du couloir (au corner).
  sfx_knock(c, out) {
    const t0 = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.18;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
    }
  },

  // Flash subliminal « C'EST MOI » : petit éclat de bruit filtré (glitch).
  sfx_subliminal(c, out) {
    const t = c.currentTime;
    const n = this._noise(c, 0.14);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.14);
  },

  // Sonnerie de téléphone (deux « dring ») avant un appel (lore).
  sfx_phoneRing(c, out) {
    const t0 = c.currentTime;
    for (let r = 0; r < 2; r++) {
      const rt = t0 + r * 1.0;              // deux sonneries espacées
      [440, 480].forEach((f) => {
        const o = c.createOscillator();
        o.type = "sine"; o.frequency.value = f;
        const g = c.createGain();
        // Pulsé ~20 Hz pendant 0,5 s pour l'effet « dring ».
        g.gain.setValueAtTime(0.0001, rt);
        for (let k = 0; k < 10; k++) {
          const kt = rt + k * 0.05;
          g.gain.setValueAtTime(0.09, kt);
          g.gain.setValueAtTime(0.0001, kt + 0.025);
        }
        o.connect(g); g.connect(out); o.start(rt); o.stop(rt + 0.55);
      });
    }
  },

  // Petit « bip » discret à chaque caractère tapé d'un appel.
  sfx_phoneBlip(c, out) {
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "square"; o.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.035);
  },

  // Grésillement de ligne téléphonique (boucle pendant l'écoute d'un appel).
  loop_phone(c, out) {
    const src = this._noise(c, 1, true);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = 0.025;
    src.connect(bp); bp.connect(g); g.connect(out); src.start();
    return { stop() { try { src.stop(); } catch (e) {} } };
  },

  // Cloches de 6h du matin (victoire) : 4 « dong » qui résonnent.
  sfx_sixAM(c, out) {
    const t0 = c.currentTime;
    [0, 0.5, 1.0, 1.5].forEach((dt) => {
      const t = t0 + dt;
      [294, 588, 880].forEach((f, i) => {     // fondamentale + harmoniques
        const o = c.createOscillator();
        o.type = "sine"; o.frequency.value = f;
        const g = c.createGain();
        const amp = i === 0 ? 0.22 : i === 1 ? 0.1 : 0.05;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.95);
      });
    });
  },

  // Petit jingle de succès débloqué (deux notes montantes brillantes).
  sfx_achievement(c, out) {
    const t0 = c.currentTime;
    [[784, 0], [1175, 0.11]].forEach(([f, dt]) => {   // sol -> ré (octave +)
      const t = t0 + dt;
      const o = c.createOscillator();
      o.type = "triangle"; o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.24);
    });
  },

  // Coup sec « tape-taupe » : petit pop quand on tape un pote.
  sfx_whack(c, out) {
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.11);
  },

  // Bourdon grave et dissonant : présence de Joeffrey Doré dans le bureau.
  sfx_goldenHum(c, out) {
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(58, t + 1.6);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 320;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.2);
    g.gain.setValueAtTime(0.3, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 1.75);
    // Deuxième oscillateur légèrement désaccordé -> battement angoissant.
    const o2 = c.createOscillator();
    o2.type = "sine"; o2.frequency.value = 73;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.12, t + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o2.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + 1.75);
  },

  sfx_foxyRun(c, out) {
    const t0 = c.currentTime;
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * 0.085;
      const n = this._noise(c, 0.06);
      const hp = c.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 1100;
      const g = c.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.06);
    }
  },

  sfx_freddyLaugh(c, out) {
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(210, t0);
    o.frequency.linearRampToValueAtTime(150, t0 + 1.0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < 5; i++) {
      const t = t0 + i * 0.18;             // "ha ha ha..."
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    }
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 1.0);
  },

  // Mélodie de panne (boîte à musique inquiétante, type Toreador, domaine public).
  sfx_powerOutMusic(c, out) {
    const N = { A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880 };
    this._melody(c, out, [
      [N.A4, 0.3], [N.E5, 0.3], [N.D5, 0.3], [N.C5, 0.3],
      [N.B4, 0.45], [0, 0.15], [N.A4, 0.3], [N.C5, 0.3],
      [N.E5, 0.3], [N.A5, 0.6],
    ], "triangle");
  },

  // Carillon de victoire (6 AM).
  sfx_victory(c, out) {
    this._melody(c, out, [
      [523, 0.16], [659, 0.16], [784, 0.16], [1047, 0.5],
    ], "sine");
  },

  // Cri du jumpscare.
  sfx_scream(c, out) {
    const dur = 0.9;
    const t0 = c.currentTime;
    const n = this._noise(c, dur);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 0.6;
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.setValueAtTime(240, t0);
    o1.frequency.exponentialRampToValueAtTime(70, t0 + dur);
    const o2 = c.createOscillator();
    o2.type = "square";
    o2.frequency.setValueAtTime(360, t0);
    o2.frequency.exponentialRampToValueAtTime(110, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.8, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(bp); bp.connect(g); o1.connect(g); o2.connect(g); g.connect(out);
    n.start(t0); o1.start(t0); o2.start(t0);
    n.stop(t0 + dur); o1.stop(t0 + dur); o2.stop(t0 + dur);
  },

  /* ---- Boucles ---- */
  loop_hum(c, out) {
    const src = this._noise(c, 1, true);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 220;
    const g = c.createGain(); g.gain.value = 0.06;
    const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 60;
    const og = c.createGain(); og.gain.value = 0.04;
    src.connect(lp); lp.connect(g); g.connect(out);
    o.connect(og); og.connect(out);
    src.start(); o.start();
    return { stop() { try { src.stop(); } catch (e) {} try { o.stop(); } catch (e) {} } };
  },
  loop_static(c, out) {
    const src = this._noise(c, 1, true);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 0.5;
    const g = c.createGain(); g.gain.value = 0.035;
    src.connect(bp); bp.connect(g); g.connect(out); src.start();
    return { stop() { try { src.stop(); } catch (e) {} } };
  },
  loop_lightBuzz(c, out) {
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 120;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0.05;
    o.connect(lp); lp.connect(g); g.connect(out); o.start();
    return { stop() { try { o.stop(); } catch (e) {} } };
  },
};

/* =========================================================
   Sprites — images de personnage des potes (caméras / portes / fenêtres).
   Charge assets/images/animatronics/<id>.png si présent ; sinon on garde la
   silhouette par défaut. (Le jumpscare utilise un autre dossier.)
   ========================================================= */
const Sprites = {
  base: {},   // id -> url (uniquement ceux qui existent)

  init() {
    ANIMATRONICS.forEach((a) => {
      const url = `assets/images/animatronics/${a.id}.png`;
      const img = new Image();
      img.onload = () => { this.base[a.id] = url; };
      img.src = url;
    });
  },

  // Applique la photo du pote `id` sur un élément silhouette, si elle existe.
  apply(el, id) {
    if (!el) return;
    if (this.base[id]) {
      el.classList.add("has-photo");
      el.style.backgroundImage = `url("${this.base[id]}")`;
    } else {
      el.classList.remove("has-photo");
      el.style.backgroundImage = "";
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
  userEnabled: true,             // préférence joueur (réglages pause)
  KEY: "fnaf_joeffrey_vhs",

  init() {
    this.el = document.getElementById("vhs-overlay");
    try { this.userEnabled = localStorage.getItem(this.KEY) !== "0"; } catch (e) {}
    this.update();
  },

  update() {
    if (!this.el) return;
    const officeActive = document
      .getElementById("office-screen")
      .classList.contains("active");
    // Affiché si la préférence est ON, et (hors bureau OU moniteur levé).
    const show = this.userEnabled && (!officeActive || GameState.cameraOpen);
    this.el.classList.toggle("off", !show);
  },

  setEnabled(on) {
    this.userEnabled = on;
    try { localStorage.setItem(this.KEY, on ? "1" : "0"); } catch (e) {}
    this.update();
  },
};

/* =========================================================
   GameState — état courant de la partie
   ========================================================= */
const GameState = {
  night: 1,          // nuit en cours
  customAI: null,    // IA personnalisée (Custom Night) ou null
  running: false,    // la nuit est-elle active ?
  paused: false,     // menu pause ouvert (Échap) ?
  elapsed: 0,        // temps réel écoulé dans la nuit (secondes)
  power: CONFIG.power.start,

  // État des commandes du joueur (câblé en Phase 3/4).
  doors:  { left: false, right: false }, // true = porte fermée
  lights: { left: false, right: false }, // true = lumière allumée
  cameraOpen: false,
  anyLightUsed: false,   // une lumière a-t-elle été allumée cette nuit ? (succès)
  anyCameraUsed: false,  // le moniteur caméras a-t-il été levé cette nuit ? (succès)
  minigame: false,       // le mini-jeu caché est-il ouvert ? (gèle la nuit)

  reset(night) {
    this.night = night;
    this.customAI = null;
    this.running = false;
    this.paused = false;
    this.elapsed = 0;
    this.power = CONFIG.power.start;
    this.doors  = { left: false, right: false };
    this.lights = { left: false, right: false };
    this.cameraOpen = false;
    this.anyLightUsed = false;
    this.anyCameraUsed = false;
    this.minigame = false;
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
    // Tactile (mobile) : on suit le doigt pour « tourner la tête ».
    this.viewEl.addEventListener(
      "touchmove",
      (e) => { if (e.touches[0]) this.onMove(e.touches[0]); },
      { passive: true }
    );
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
    // Combinaison secrète du mini-jeu : jeton "Lc/Lo/Rc/Ro" selon le côté+état.
    MiniGame.feed((side === "left" ? "L" : "R") + (GameState.doors[side] ? "c" : "o"));
    this.render(side);
    Power.update();                        // la conso change immédiatement
    Sound.play(GameState.doors[side] ? "doorClose" : "doorOpen");
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
    if (next) {
      GameState.anyLightUsed = true;                       // pour le succès « À l'aveugle »
      MiniGame.feed(side === "left" ? "Ll" : "Rl");        // combinaison secrète
    }
    this.render(side);
    Power.update();                  // la conso change immédiatement
    // Buzz fluorescent tant qu'au moins une lumière est allumée.
    if (GameState.lights.left || GameState.lights.right) Sound.startLoop("lightBuzz");
    else Sound.stopLoop("lightBuzz");
  },

  render(side) {
    const on = GameState.lights[side];
    document
      .querySelector(`.light-btn[data-side="${side}"]`)
      .classList.toggle("active", on);
    document.getElementById(`door-${side}`).classList.toggle("lit", on);
    // La même lumière éclaire aussi la petite fenêtre du couloir de ce côté.
    document.getElementById(`window-${side}`).classList.toggle("lit", on);
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
  scrambledUntil: {},   // id de caméra -> timestamp de fin de brouillage

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
      btn.addEventListener("click", () => {
        Sound.play("camSwitch");
        this.select(cam.id);
      });
      container.appendChild(btn);
    });
  },

  toggle() {
    if (GameState.cameraOpen) {
      this.lower();
      // Baisser le moniteur peut faire surgir Joeffrey Doré (easter egg).
      EasterEggs.onMonitorLowered();
    } else {
      this.raise();
    }
  },

  raise() {
    // Relever le moniteur chasse Joeffrey Doré s'il est dans le bureau.
    EasterEggs.onMonitorRaised();
    if (!GameState.running) return;
    MiniGame.feed("Co");             // combinaison secrète : moniteur levé
    GameState.anyCameraUsed = true;  // pour le succès « À l'instinct »
    GameState.cameraOpen = true;
    Pan.enabled = false;             // on ne tourne plus la tête dans le bureau
    this.monitorEl.classList.remove("hidden");
    this.flipEl.classList.add("up"); // flèches vers le bas + label "FERMER"
    this.flipLabelEl.textContent = "FERMER";
    this.select(this.current);       // (ré)affiche la dernière caméra vue
    Power.update();                  // la conso caméra apparaît tout de suite
    VHS.update();                    // effet VHS visible sur les caméras
    Sound.play("camOpen");
    Sound.startLoop("static");       // souffle vidéo pendant la surveillance
  },

  lower() {
    MiniGame.feed("Cx");             // combinaison secrète : moniteur baissé
    GameState.cameraOpen = false;
    Pan.enabled = true;
    this.monitorEl.classList.add("hidden");
    this.flipEl.classList.remove("up");
    this.flipLabelEl.textContent = "CAMÉRAS";
    Power.update();
    VHS.update();                    // retour au bureau : pas de VHS
    Sound.stopLoop("static");
    Sound.play("camClose");
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
    this.applyScramble();    // une caméra peut être brouillée au moment où on l'ouvre
    EasterEggs.onCameraSelect(id);  // flashs subliminaux / affiche dorée (rares)
  },

  // Brouille les caméras `roomIds` pendant 1 s (pote en déplacement) : si on en
  // regarde une, on ne voit plus rien le temps qu'il "change de salle".
  scramble(roomIds) {
    const until = performance.now() + 1000;
    roomIds.filter(Boolean).forEach((id) => {
      if (CAMERAS.some((c) => c.id === id)) this.scrambledUntil[id] = until;
    });
    this.applyScramble();
    setTimeout(() => this.applyScramble(), 1050);  // ré-évalue à la fin
  },

  // Active/désactive l'affichage brouillé selon la caméra visionnée.
  applyScramble() {
    if (!this.feedEl) return;
    const on =
      GameState.cameraOpen &&
      (this.scrambledUntil[this.current] || 0) > performance.now();
    this.feedEl.classList.toggle("scrambled", on);
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
      Sprites.apply(el.querySelector(".occ-figure"), def.id);
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
    document.getElementById("btn-custom").addEventListener("click", () => {
      this.showCustom();
    });
    document.getElementById("btn-credits").addEventListener("click", () => {
      Screens.show("credits-screen");
    });

    // Reset progression : remet le jeu à zéro (nuit 1, Custom Night reverrouillée),
    // avec confirmation pour éviter un effacement accidentel.
    document.getElementById("btn-reset").addEventListener("click", () => {
      const ok = window.confirm(
        "Réinitialiser toute la progression ?\n" +
        "Tu repartiras de la Nuit 1 et la Custom Night sera reverrouillée."
      );
      if (!ok) return;
      Save.reset();
      this.show();                       // rafraîchit l'état des boutons du menu
      EasterEggs.toast("Progression réinitialisée — retour à la Nuit 1.");
    });

    // Custom Night : lance la nuit avec les niveaux d'IA réglés aux curseurs.
    document.getElementById("custom-start").addEventListener("click", () => {
      const ai = {};
      document.querySelectorAll(".custom-slider").forEach((s) => {
        ai[s.dataset.id] = parseInt(s.value, 10) || 0;
      });
      Game.startNight(NIGHTS.length + 1, ai);
    });

    // Tous les boutons "Retour" / "Menu" ramènent au menu principal.
    document.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => this.show());
    });
  },

  // Affiche le menu principal et rafraîchit l'état des boutons.
  show() {
    Screens.show("menu-screen");
    // "Continue" n'a de sens que si on a dépassé la nuit 1.
    document.getElementById("btn-continue").disabled = Save.data.unlocked <= 1;
    // "Custom Night" est CACHÉE tant qu'elle n'est pas débloquée (fin de Nuit 5
    // ou Code Konami) : elle n'apparaît dans le menu qu'une fois débloquée.
    document.getElementById("btn-custom").classList.toggle("hidden", !Save.data.customUnlocked);
  },

  // Construit la grille de réglage de la Custom Night (un curseur par pote).
  showCustom() {
    const list = document.getElementById("custom-list");
    list.innerHTML = "";
    ANIMATRONICS.forEach((a) => {
      const row = document.createElement("div");
      row.className = "custom-row";
      row.innerHTML = `
        <span class="custom-name">${a.name}</span>
        <input class="custom-slider" type="range" min="0" max="20" value="0" data-id="${a.id}" />
        <span class="custom-val">0</span>`;
      const slider = row.querySelector(".custom-slider");
      const val = row.querySelector(".custom-val");
      slider.addEventListener("input", () => { val.textContent = slider.value; });
      list.appendChild(row);
    });
    Screens.show("custom-screen");
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

  // Délai de grâce en début de nuit : personne ne bouge pendant ~7 s, le temps
  // de prendre ses marques (comme dans FNAF).
  GRACE_MS: 7000,

  // Prépare les animatroniques selon la nuit (aiLevel > 0 = actif).
  // customAI (Custom Night) remplace les niveaux de la nuit s'il est fourni.
  init(night, customAI) {
    const cfg = customAI ? { ai: customAI } : getNightConfig(night);
    this.actors = ANIMATRONICS.filter((a) => (cfg.ai[a.id] || 0) > 0).map(
      (def) => {
        const base = { def, level: cfg.ai[def.id] };
        if (def.type === "foxy") {
          // État machine spéciale : 0 caché, 1 observe, 2 prépare, 3 course.
          return { ...base, stage: 0, running: false, runTimer: 0, timer: def.stageInterval + this.GRACE_MS };
        }
        // Marcheur classique : position le long du chemin.
        return { ...base, index: 0, timer: def.moveInterval + this.GRACE_MS };
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
    const fromRoom = this.roomOf(act);        // salle quittée (avant le déplacement)
    if (act.index < lastIndex) {
      act.index++;                            // avance d'une salle
      Cameras.scramble([fromRoom, this.roomOf(act)]);  // brouille les 2 caméras
      this.onMoved(act);
      // Arrivé au corner (juste à côté de la porte) : coups sourds d'alerte.
      if (act.index === lastIndex) Sound.play("knock");
    } else {
      // Au corner : tentative d'entrée dans le bureau.
      if (GameState.doors[act.def.door]) {
        act.index = 0;                        // porte fermée -> il repart
        Cameras.scramble([fromRoom, this.roomOf(act)]);
        this.onMoved(act);
      } else {
        Game.caught(act.def);                 // porte ouverte -> attaque
      }
    }
  },

  /* ---- Foxy (Célian) : états + course ---- */
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
          console.log("[IA] Célian bloqué à la porte — il repart se cacher.");
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
        Sound.play("foxyRun");
        console.log("[IA] Célian FONCE vers la porte gauche !");
      } else {
        console.log(`[IA] Célian passe en état ${act.stage}.`);
      }
      this.onMoved(act);
    }
  },

  onMoved(act) {
    const room = this.roomOf(act);
    if (act.def.type !== "foxy") console.log(`[IA] ${act.def.name} -> ${room}`);
    // Joeffrey (Freddy) ricane quand il bouge.
    if (act.def.id === "joeffrey") Sound.play("freddyLaugh");
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
        Sprites.apply(occEl.querySelector(".silhouette"), here[0].def.id);
      }
    });
    // Petites fenêtres : un pote dans le couloir (2A à gauche, 4A à droite) y
    // apparaît, visible quand la lumière de ce côté est allumée.
    const hallRoom = { left: "2A", right: "4A" };
    ["left", "right"].forEach((side) => {
      const winOcc = document.querySelector(`#window-${side} .win-occupant`);
      if (!winOcc) return;
      const here = this.actors.filter((a) => this.roomOf(a) === hallRoom[side]);
      winOcc.classList.toggle("present", here.length > 0);
      if (here.length) {
        winOcc.querySelector(".occ-name").textContent = here
          .map((a) => a.def.name)
          .join(" · ");
        Sprites.apply(winOcc.querySelector(".silhouette"), here[0].def.id);
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
  faceEl: null,
  nameEl: null,

  // Cache des visages, préparés DÈS l'init pour éviter tout flash au moment du
  // jumpscare : id -> dataURL traité (image prête), ou null si absente.
  // (undefined = pas encore résolu.)
  faces: {},

  init() {
    this.el = document.getElementById("jumpscare");
    this.imgEl = document.getElementById("jumpscare-img");
    this.faceEl = document.getElementById("jumpscare-face");
    this.nameEl = document.getElementById("jumpscare-name");
    this.preload();
  },

  // Précharge + pré-traite toutes les images de jumpscare connues, pour qu'elles
  // s'affichent instantanément (plus de placeholder visible au démarrage).
  preload() {
    const ids = ANIMATRONICS.map((a) => a.id);
    ids.push("joeffrey_dore");   // Joeffrey Doré (easter egg)
    ids.forEach((id) => this.cacheFace(id));
  },

  cacheFace(id) {
    const src = `assets/images/jumpscares/${id}.png`;
    const img = new Image();
    img.onerror = () => { this.faces[id] = null; };      // pas d'image fournie
    img.onload = () => { this.faces[id] = this.processFace(img, src); };
    img.src = src;
  },

  // Détoure auto un fond opaque (damier "cuit" / fond plein) -> transparent, pour
  // que le pote apparaisse sur le noir du jumpscare. Renvoie un dataURL (ou src).
  processFace(img, src) {
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      // Si le coin haut-gauche est opaque, le fond est "cuit" -> on détoure.
      if (d[3] > 250) {
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          // Gris clair / blanc (lumineux + peu saturé) = damier -> transparent.
          if (max > 140 && max - min < 28) d[i + 3] = 0;
        }
        ctx.putImageData(data, 0, 0);
        return c.toDataURL();
      }
    } catch (e) {
      /* canvas indisponible : on garde l'image brute */
    }
    return src;
  },

  // Joue le jumpscare de `def`, puis appelle onDone (~1,1 s).
  play(def, onDone) {
    // Vraie image du pote si dispo (préchargée) ; sinon le visage placeholder CSS.
    this.imgEl.classList.add("hidden");
    this.faceEl.classList.add("hidden");

    const cached = this.faces[def.id];
    if (cached) {
      // Image prête : affichage immédiat, aucun flash de placeholder.
      this.imgEl.src = cached;
      this.imgEl.classList.remove("hidden");
    } else if (cached === null) {
      // Image absente : on montre le visage placeholder CSS.
      this.faceEl.classList.remove("hidden");
    } else {
      // Pas encore préchargée (cas rare) : on la charge sans flasher le
      // placeholder ; il n'apparaîtra qu'en cas d'échec.
      this.cacheFace(def.id);
      const src = `assets/images/jumpscares/${def.id}.png`;
      const img = new Image();
      img.onerror = () => this.faceEl.classList.remove("hidden");
      img.onload = () => {
        this.imgEl.src = this.processFace(img, src);
        this.imgEl.classList.remove("hidden");
        this.faceEl.classList.add("hidden");
      };
      img.src = src;
    }

    this.el.classList.remove("hidden");
    this.el.classList.add("active");
    this.playSound(def);

    setTimeout(() => {
      this.el.classList.remove("active");
      this.el.classList.add("hidden");
      if (onDone) onDone();
    }, 1100);
  },

  // Son : tente le fichier du pote, sinon cri synthétisé (via Sound, qui
  // respecte le mute global).
  playSound(def) {
    let handled = false;
    const fallback = () => {
      if (handled) return;
      handled = true;
      Sound.play("scream");
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
};

/* =========================================================
   Pause — menu pause (Échap) : reprendre, réglages, retour menu
   Met le jeu en pause (temps, IA, énergie via GameState.paused ; audio suspendu).
   ========================================================= */
const Pause = {
  el: null,

  init() {
    this.el = document.getElementById("pause");

    document.getElementById("pause-resume").addEventListener("click", () => this.close());
    document.getElementById("pause-menu").addEventListener("click", () => Game.quitToMenu());

    // Son (mute)
    document.getElementById("pause-mute").addEventListener("click", () => {
      Sound.toggleMute();
      this.refresh();
    });
    // Volume
    document.getElementById("pause-volume").addEventListener("input", (e) => {
      Sound.setVolume(e.target.value / 100);
    });
    // Filtre VHS
    document.getElementById("pause-vhs").addEventListener("click", () => {
      VHS.setEnabled(!VHS.userEnabled);
      this.refresh();
    });

    // Échap : ferme le mini-jeu s'il est ouvert, sinon ouvre/ferme la pause.
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (GameState.minigame) { MiniGame.close(); return; }
      this.toggle();
    });
  },

  toggle() {
    if (GameState.paused) this.close();
    else this.open();
  },

  open() {
    if (!GameState.running || GameState.paused) return;
    GameState.paused = true;
    Sound.suspend();                 // fige l'audio (bourdonnement, etc.)
    this.refresh();
    this.el.classList.remove("hidden");
  },

  close() {
    if (!GameState.paused) return;
    GameState.paused = false;
    this.el.classList.add("hidden");
    Sound.resume();                  // reprend l'audio
  },

  // Met l'UI des réglages en accord avec l'état courant.
  refresh() {
    const mute = document.getElementById("pause-mute");
    mute.textContent = Sound.muted ? "Coupé" : "Activé";
    mute.classList.toggle("on", !Sound.muted);
    mute.classList.toggle("off", Sound.muted);

    document.getElementById("pause-volume").value = Math.round(Sound.volume * 100);

    const vhs = document.getElementById("pause-vhs");
    vhs.textContent = VHS.userEnabled ? "Activé" : "Désactivé";
    vhs.classList.toggle("on", VHS.userEnabled);
    vhs.classList.toggle("off", !VHS.userEnabled);
  },
};

/* =========================================================
   PhoneCalls — appels du début de nuit (le lore, façon « Phone Guy »)
   Affiche le message de la nuit (data/calls.js) en bas à gauche, écrit lettre
   par lettre, avec sonnerie puis grésillement de ligne synthétisés. Ne bloque
   jamais le jeu (on peut agir pendant l'écoute) ; le bouton « passer » révèle
   le texte d'un coup, puis le ferme.
   ========================================================= */
const PhoneCalls = {
  // === Interrupteur du lore =================================================
  // Mets à `true` pour réactiver les appels téléphoniques du début de nuit.
  // Tout le code et les textes (data/calls.js) restent en place : il suffit
  // de rebasculer ce drapeau pour remettre le lore. (Désactivé pour l'instant.)
  ENABLED: false,
  // =========================================================================
  el: null, fromEl: null, textEl: null, skipEl: null,
  state: "off",         // off | ringing | typing | done
  call: null,           // appel en cours (objet de PHONE_CALLS)
  full: "",             // texte complet à taper
  pos: 0,               // nombre de caractères déjà affichés
  timer: null,          // minuterie de frappe / fermeture auto
  ringTimer: null,      // minuterie « fin de sonnerie »

  CHAR_MS: 32,          // vitesse de frappe (ms par caractère)
  RING_MS: 2200,        // durée de la sonnerie avant la voix
  AUTOHIDE_MS: 6000,    // délai avant fermeture auto une fois le texte fini

  init() {
    this.el = document.getElementById("phone-call");
    this.fromEl = document.getElementById("phone-from");
    this.textEl = document.getElementById("phone-text");
    this.skipEl = document.getElementById("phone-skip");
    this.skipEl.addEventListener("click", () => this.skip());
  },

  // Lance l'appel de la nuit (rien si la nuit n'a pas d'entrée dans calls.js).
  startForNight(night) {
    this.stop();
    if (!this.ENABLED) return; // lore désactivé : aucun appel
    const call = (typeof getPhoneCall === "function") ? getPhoneCall(night) : null;
    if (!call) return;
    this.call = call;
    this.full = call.text || "";
    this.pos = 0;
    this.fromEl.textContent = call.from || "Appel entrant…";
    this.textEl.textContent = "";
    this.el.classList.remove("typing");
    this.el.classList.toggle("glitch", !!call.glitch);
    this.el.classList.add("ringing");
    this.el.classList.remove("hidden");
    this.state = "ringing";
    Sound.play("phoneRing");
    // Après la sonnerie, la « voix » commence à s'écrire.
    this.ringTimer = setTimeout(() => this.beginTyping(), this.RING_MS);
  },

  beginTyping() {
    if (this.state === "off" || !GameState.running) { this.stop(); return; }
    this.state = "typing";
    this.el.classList.remove("ringing");
    this.el.classList.add("typing");
    Sound.startLoop("phone");
    this.tick();
  },

  // Tape un caractère, puis se replanifie (en respectant la pause).
  tick() {
    this.timer = setTimeout(() => {
      if (this.state !== "typing" || !GameState.running) { this.stop(); return; }
      if (GameState.paused) { this.tick(); return; }   // gelé pendant la pause
      this.pos++;
      this.textEl.textContent = this.full.slice(0, this.pos);
      if (this.pos % 2 === 0) Sound.play("phoneBlip");
      if (this.pos >= this.full.length) { this.finish(); return; }
      this.tick();
    }, this.CHAR_MS);
  },

  // Texte entièrement affiché : on coupe la ligne et on programme la fermeture.
  finish() {
    this.state = "done";
    this.el.classList.remove("typing");
    Sound.stopLoop("phone");
    this.timer = setTimeout(() => this.hide(), this.AUTOHIDE_MS);
  },

  // Bouton « passer » : 1er appui = tout révéler ; 2e = fermer.
  skip() {
    if (this.state === "ringing" || this.state === "typing") {
      clearTimeout(this.ringTimer); clearTimeout(this.timer);
      this.el.classList.remove("ringing");
      this.textEl.textContent = this.full;
      this.pos = this.full.length;
      this.finish();
    } else if (this.state === "done") {
      this.hide();
    }
  },

  hide() {
    clearTimeout(this.timer);
    this.el.classList.add("hidden");
    this.state = "off";
  },

  // Arrêt complet (fin/abandon de nuit) : coupe tout proprement.
  stop() {
    clearTimeout(this.timer); clearTimeout(this.ringTimer);
    this.timer = this.ringTimer = null;
    Sound.stopLoop("phone");
    this.state = "off";
    this.call = null;
    if (this.el) {
      this.el.classList.add("hidden");
      this.el.classList.remove("ringing", "typing", "glitch");
    }
  },
};

/* =========================================================
   EasterEggs — clins d'œil cachés façon FNAF
   Trois secrets, tous optionnels et SANS asset requis :
     1. Code Konami sur le menu -> débloque la Custom Night + petit bandeau.
     2. Flashs subliminaux « C'EST MOI » -> apparitions ultra-brèves et rares
        en changeant de caméra (ambiance, sans danger).
     3. Joeffrey Doré (clin d'œil au « Golden Freddy ») -> rarement, une affiche
        dorée flashe sur une caméra ; si on rebaisse alors le moniteur, Joeffrey
        Doré est assis dans le bureau. Relever le moniteur le chasse ; sinon il
        attaque (jumpscare). Une seule fois par nuit.
   Pour tester en console : EasterEggs.forceSubliminal() / forceGoldenPoster().
   ========================================================= */
const EasterEggs = {
  goldenEl: null,
  sublimEl: null,
  toastEl: null,

  // État du secret Joeffrey Doré (une seule occurrence par nuit).
  goldenUsed: false,    // déjà déclenché cette nuit ?
  goldenArmed: false,   // affiche vue : en attente que l'on baisse le moniteur
  goldenActive: false,  // figure présente dans le bureau
  goldenTimer: null,    // délai avant l'attaque si on ne réagit pas

  lastFlash: 0,         // anti-spam des flashs subliminaux (timestamp)

  // Faux "pote" doré pour le jumpscare (image dédiée optionnelle :
  // assets/images/jumpscares/joeffrey_dore.png ; sinon visage placeholder).
  GOLDEN_DEF: { id: "joeffrey_dore", name: "Joeffrey Doré" },

  // Probabilités (par changement de caméra).
  GOLDEN_CAM: "5",        // Joeffrey Doré ne peut s'amorcer QUE sur cette caméra
  GOLDEN_CHANCE: 0.0025,  // très très rare (uniquement en regardant la CAM 5)
  SUBLIM_CHANCE: 0.008,   // rare (par fermeture du moniteur)
  SUBLIM_COOLDOWN: 6000,  // délai mini (ms) entre deux flashs
  GOLDEN_GRACE: 5000,     // délai (ms) pour relever le moniteur avant l'attaque

  // Suite du Code Konami (↑↑↓↓←→←→ B A).
  KONAMI: ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"],
  konamiPos: 0,

  init() {
    this.goldenEl = document.getElementById("golden");
    this.sublimEl = document.getElementById("subliminal");
    this.toastEl = document.getElementById("egg-toast");
    window.addEventListener("keydown", (e) => this.onKonamiKey(e));
  },

  /* ---- Cycle de nuit ---- */
  startNight() {
    this.goldenUsed = false;
    this.goldenArmed = false;
    this.clear();
  },
  // Nettoie overlays + minuterie (début de nuit, panne, défaite, victoire, abandon).
  clear() {
    this.goldenActive = false;
    if (this.goldenTimer) { clearTimeout(this.goldenTimer); this.goldenTimer = null; }
    if (this.goldenEl) this.goldenEl.classList.add("hidden");
    if (this.sublimEl) this.sublimEl.classList.remove("show", "golden-flash");
  },

  /* ---- 3) amorçage de Joeffrey Doré (sur la CAM dédiée) ---- */
  // Appelé à chaque sélection de caméra : seul Joeffrey Doré s'amorce ici.
  onCameraSelect(id) {
    if (!GameState.running || GameState.paused) return;
    // Joeffrey Doré : très rare, une seule fois par nuit, et UNIQUEMENT en
    // regardant la caméra dédiée (GOLDEN_CAM).
    if (id === this.GOLDEN_CAM
        && !this.goldenUsed && !this.goldenArmed && !this.goldenActive
        && Math.random() < this.GOLDEN_CHANCE) {
      this.armGolden();
    }
  },

  flashSubliminal() {
    if (!this.sublimEl) return;
    this.lastFlash = performance.now();
    Sprites.apply(this.sublimEl.querySelector(".sub-face"), "joeffrey");
    this.sublimEl.classList.add("show");
    Sound.play("subliminal");
    setTimeout(() => this.sublimEl.classList.remove("show"), 130);
  },

  // L'affiche dorée flashe sur la caméra : on « arme » le secret.
  armGolden() {
    this.goldenUsed = true;
    this.goldenArmed = true;
    if (this.sublimEl) {
      Sprites.apply(this.sublimEl.querySelector(".sub-face"), "joeffrey");
      this.sublimEl.classList.add("show", "golden-flash");
      Sound.play("subliminal");
      setTimeout(() => this.sublimEl.classList.remove("show", "golden-flash"), 240);
    }
  },

  // Appelé quand le joueur BAISSE le moniteur.
  //  - si Joeffrey Doré est armé -> il surgit dans le bureau ;
  //  - sinon, petite chance d'un flash subliminal « C'EST MOI ».
  onMonitorLowered() {
    if (!GameState.running) return;
    // Joeffrey Doré surgit (prioritaire sur le flash).
    if (this.goldenArmed && !this.goldenActive) {
      this.goldenArmed = false;
      this.goldenActive = true;
      Sprites.apply(this.goldenEl.querySelector(".golden-figure"), "joeffrey");
      this.goldenEl.classList.remove("hidden");
      Sound.play("goldenHum");
      // S'il reste sans qu'on relève le moniteur à temps -> attaque.
      this.goldenTimer = setTimeout(() => this.goldenKill(), this.GOLDEN_GRACE);
      return;
    }
    // Flash subliminal « C'EST MOI » : rare, avec un délai anti-spam.
    const now = performance.now();
    if (now - this.lastFlash > this.SUBLIM_COOLDOWN && Math.random() < this.SUBLIM_CHANCE) {
      this.flashSubliminal();
    }
  },

  // Le joueur relève le moniteur : Joeffrey Doré disparaît (sauvé).
  onMonitorRaised() {
    if (!this.goldenActive) return;
    this.clear();
    Achievements.unlock("golden");   // succès secret : avoir échappé à Joeffrey Doré
  },

  goldenKill() {
    if (!this.goldenActive) return;
    this.goldenActive = false;
    if (this.goldenEl) this.goldenEl.classList.add("hidden");
    Game.caught(this.GOLDEN_DEF);
  },

  /* ---- 1) Code Konami (menu) ---- */
  onKonamiKey(e) {
    const menuActive = document.getElementById("menu-screen").classList.contains("active");
    if (!menuActive) { this.konamiPos = 0; return; }
    const key = (e.key || "").toLowerCase();
    if (key === this.KONAMI[this.konamiPos]) {
      this.konamiPos++;
      if (this.konamiPos === this.KONAMI.length) {
        this.konamiPos = 0;
        this.konamiReward();
      }
    } else {
      // Recommence (ou repart à 1 si on retape la 1re touche de la suite).
      this.konamiPos = key === this.KONAMI[0] ? 1 : 0;
    }
  },

  konamiReward() {
    Save.unlockCustom();
    Menu.show();            // rafraîchit les boutons (Custom Night désormais active)
    Sound.play("victory");
    this.toast("★ Secret des potes trouvé — Custom Night débloquée !");
    Achievements.unlock("konami");   // succès secret
  },

  toast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("show");
    setTimeout(() => this.toastEl.classList.remove("show"), 3200);
  },

  /* ---- Aides de test (console) ---- */
  forceSubliminal() { this.flashSubliminal(); },
  forceGoldenPoster() { this.goldenUsed = false; this.armGolden(); },
};

/* =========================================================
   Achievements — succès / trophées (persistés dans Save.data.achievements)
   Définitions dans data/achievements.js. unlock(id) est appelé depuis les
   événements de jeu (victoire, défaite, panne, easter eggs…).
   ========================================================= */
const Achievements = {
  init() {
    if (!Save.data.achievements) Save.data.achievements = {};
    document
      .getElementById("btn-achievements")
      .addEventListener("click", () => this.showScreen());
  },

  has(id) {
    return !!(Save.data.achievements && Save.data.achievements[id]);
  },

  // Débloque un succès (une seule fois) + petit bandeau et son.
  unlock(id) {
    if (!Save.data.achievements) Save.data.achievements = {};
    if (this.has(id)) return;
    const def = getAchievement(id);
    if (!def) return;
    Save.data.achievements[id] = true;
    Save.persist();
    EasterEggs.toast("🏆 Succès : " + def.name);
    Sound.play("achievement");
    // Si on vient de débloquer un succès « normal », vérifie le 100 %.
    if (id !== "platinum") this.checkComplete();
  },

  // Débloque le succès « platine » quand TOUS les autres sont obtenus.
  checkComplete() {
    const others = ACHIEVEMENTS.filter((a) => a.id !== "platinum");
    if (others.every((a) => this.has(a.id))) this.unlock("platinum");
  },

  count() {
    return ACHIEVEMENTS.filter((a) => this.has(a.id)).length;
  },

  // Construit et affiche l'écran des succès (cartes verrouillées / obtenues).
  showScreen() {
    const list = document.getElementById("ach-list");
    list.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const got = this.has(a.id);
      const masked = a.secret && !got;   // succès secret encore caché
      const card = document.createElement("div");
      card.className = "ach-card" + (got ? " got" : "");
      const icon = got ? "🏆" : a.secret ? "❓" : "🔒";
      card.innerHTML =
        `<div class="ach-icon">${icon}</div>
         <div class="ach-text">
           <div class="ach-name">${masked ? "Succès secret" : a.name}</div>
           <div class="ach-desc">${masked ? "À découvrir…" : a.desc}</div>
         </div>`;
      list.appendChild(card);
    });
    document.getElementById("ach-count").textContent =
      this.count() + " / " + ACHIEVEMENTS.length;
    Screens.show("achievements-screen");
  },
};

/* =========================================================
   MiniGame — mini-jeu caché « tape-taupe » (façon FNAF 4)
   Déclencheur SECRET : allumer la lumière GAUCHE 5 fois en < 3 s pendant une
   nuit -> un point caché du bureau se met à pulser ; le cliquer ouvre le jeu.
   But : 15 points en 30 s (taper les visages des potes qui surgissent).
   La nuit est GELÉE pendant le jeu (GameState.minigame). Gagner -> succès secret.
   ========================================================= */
const MiniGame = {
  el: null, gridEl: null, scoreEl: null, timeEl: null, targetEl: null,
  resultEl: null, spotEl: null,

  HOLES: 9,
  TARGET: 15,
  DURATION: 30,        // secondes
  MOLE_MS: 850,        // durée d'apparition d'une taupe

  // Déclencheur SECRET : réaliser un « rituel » d'actions, dans l'ordre.
  // Jetons possibles (émis par Doors / Lights / Cameras) :
  //   "Lc"/"Lo" porte gauche fermée/ouverte · "Rc"/"Ro" porte droite
  //   "Ll"/"Rl" lumière gauche/droite allumée
  //   "Co"/"Cx" moniteur caméras levé/baissé
  // Par défaut : lumière+porte à gauche, puis à droite, puis lever+baisser
  // les caméras. Toute action qui ne suit pas l'ordre (ou un délai trop long)
  // RÉINITIALISE -> impossible par hasard. (Modifiable : change SEQUENCE.)
  SEQUENCE: ["Ll", "Lc", "Rl", "Rc", "Co", "Cx"],
  SEQ_WINDOW: 4000,    // délai max (ms) entre deux étapes, sinon ça repart à zéro
  seqPos: 0,
  lastStep: 0,
  active: false,
  score: 0, time: 0,
  spawnTimer: null, clockTimer: null, spotTimer: null, endTimer: null,
  moleTimers: [],

  init() {
    this.el = document.getElementById("minigame");
    this.gridEl = document.getElementById("mg-grid");
    this.scoreEl = document.getElementById("mg-score");
    this.timeEl = document.getElementById("mg-time");
    this.targetEl = document.getElementById("mg-target");
    this.resultEl = document.getElementById("mg-result");
    this.spotEl = document.getElementById("secret-spot");
    this.targetEl.textContent = this.TARGET;

    // Construit les trous (HOLES) une fois pour toutes.
    for (let i = 0; i < this.HOLES; i++) {
      const hole = document.createElement("div");
      hole.className = "mg-hole";
      hole.innerHTML = `<div class="mg-mole"></div>`;
      hole.addEventListener("click", () => this.hit(hole));
      this.gridEl.appendChild(hole);
    }
    document.getElementById("mg-close").addEventListener("click", () => this.close());
    this.spotEl.addEventListener("click", () => { this.hideSpot(); this.open(); });
  },

  /* ---- Déclencheur secret : la combinaison de portes (toc-toc) ---- */
  // Reçoit une action de porte et avance dans la combinaison ; toute erreur
  // (ou un délai trop long entre deux étapes) réinitialise.
  feed(token) {
    if (!GameState.running || this.active) return;
    const now = performance.now();
    if (now - this.lastStep > this.SEQ_WINDOW) this.seqPos = 0;  // trop lent -> reset
    this.lastStep = now;
    if (token === this.SEQUENCE[this.seqPos]) {
      this.seqPos++;
      if (this.seqPos >= this.SEQUENCE.length) {
        this.seqPos = 0;
        this.revealSpot();
      }
    } else {
      // mauvaise action : on repart (ou à 1 si elle matche la 1re étape).
      this.seqPos = token === this.SEQUENCE[0] ? 1 : 0;
    }
  },

  revealSpot() {
    if (this.active || !GameState.running) return;
    this.spotEl.classList.add("show");
    Sound.play("camSwitch");                 // petit bip de révélation
    clearTimeout(this.spotTimer);
    this.spotTimer = setTimeout(() => this.hideSpot(), 6000);  // fenêtre pour cliquer
  },
  hideSpot() {
    clearTimeout(this.spotTimer);
    this.spotEl.classList.remove("show");
  },

  /* ---- Le mini-jeu ---- */
  open() {
    if (this.active || !GameState.running) return;
    this.active = true;
    GameState.minigame = true;               // gèle la nuit
    this.score = 0;
    this.time = this.DURATION;
    this.scoreEl.textContent = "0";
    this.timeEl.textContent = this.time;
    this.resultEl.classList.add("hidden");
    this.gridEl.querySelectorAll(".mg-hole").forEach((h) => h.classList.remove("up"));
    this.el.classList.remove("hidden");
    this.spawnTimer = setInterval(() => this.spawn(), 750);
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.spawn();
  },

  spawn() {
    const holes = Array.from(this.gridEl.querySelectorAll(".mg-hole"));
    const free = holes.filter((h) => !h.classList.contains("up"));
    if (!free.length) return;
    const hole = free[Math.floor(Math.random() * free.length)];
    const id = ANIMATRONICS[Math.floor(Math.random() * ANIMATRONICS.length)].id;
    Sprites.apply(hole.querySelector(".mg-mole"), id);
    hole.classList.add("up");
    // Redescend toute seule si on ne la tape pas à temps.
    const t = setTimeout(() => hole.classList.remove("up"), this.MOLE_MS);
    this.moleTimers.push(t);
  },

  hit(hole) {
    if (!this.active || !hole.classList.contains("up")) return;
    hole.classList.remove("up");
    this.score++;
    this.scoreEl.textContent = this.score;
    Sound.play("whack");
    if (this.score >= this.TARGET) this.end(true);
  },

  tickClock() {
    this.time--;
    this.timeEl.textContent = this.time;
    if (this.time <= 0) this.end(this.score >= this.TARGET);
  },

  end(win) {
    this.stopLoops();
    this.gridEl.querySelectorAll(".mg-hole").forEach((h) => h.classList.remove("up"));
    this.resultEl.textContent = win
      ? "GAGNÉ ! Bien joué 🏆"
      : `Perdu… ${this.score}/${this.TARGET}. Réessaie !`;
    this.resultEl.classList.remove("hidden");
    if (win) Achievements.unlock("arcade");
    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => this.close(), 2200);  // fermeture auto
  },

  stopLoops() {
    clearInterval(this.spawnTimer); this.spawnTimer = null;
    clearInterval(this.clockTimer); this.clockTimer = null;
    this.moleTimers.forEach((t) => clearTimeout(t));
    this.moleTimers = [];
  },

  close() {
    this.stopLoops();
    clearTimeout(this.endTimer);
    this.el.classList.add("hidden");
    this.active = false;
    GameState.minigame = false;              // la nuit reprend
  },
};

/* =========================================================
   NightIntro — carton « Nuit X » affiché avant le début d'une nuit
   ========================================================= */
const NightIntro = {
  el: null, nightEl: null, hourEl: null, timer: null,

  init() {
    this.el = document.getElementById("night-intro");
    this.nightEl = this.el.querySelector(".ni-night");
    this.hourEl = this.el.querySelector(".ni-hour");
  },

  // Affiche « Nuit X » (~2,6 s) puis appelle onDone (début réel de la nuit).
  show(night, customAI, onDone) {
    this.hide();
    this.nightEl.textContent = customAI ? "Custom Night" : "Nuit " + night;
    this.hourEl.textContent = String(CONFIG.startHour).padStart(2, "0") + "h";
    this.el.classList.remove("hidden");
    void this.el.offsetWidth;            // reflow : rejoue le fondu + animations
    this.el.classList.add("show");
    Sound.resume();
    this.timer = setTimeout(() => {
      this.el.classList.remove("show");  // fondu de sortie (0,5 s)
      this.timer = setTimeout(() => {
        this.el.classList.add("hidden");
        if (onDone) onDone();
      }, 520);
    }, 2600);
  },

  hide() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.el) {
      this.el.classList.add("hidden");
      this.el.classList.remove("show");
    }
  },
};

/* =========================================================
   Keys — raccourcis clavier (en plus de la souris / du tactile)
     A / ←  : porte gauche      D / →  : porte droite
     Q (maintien) : lumière gauche    E (maintien) : lumière droite
     Espace : lever / baisser les caméras
   Portes & lumières ne répondent que moniteur baissé (comme à la souris).
   ========================================================= */
const Keys = {
  init() {
    window.addEventListener("keydown", (e) => this.onDown(e));
    window.addEventListener("keyup", (e) => this.onUp(e));
  },

  playing() { return GameState.running && !GameState.paused && !GameState.minigame; },

  onDown(e) {
    if (!this.playing()) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = (e.key || "").toLowerCase();

    // Caméras : Espace (empêche aussi le scroll + l'activation d'un bouton focus).
    if (e.code === "Space" || k === " " || k === "spacebar") {
      e.preventDefault();
      Cameras.flip();
      return;
    }
    // Le reste seulement quand le moniteur est baissé (portes injoignables sinon).
    if (GameState.cameraOpen) return;

    if (k === "a" || k === "arrowleft")       { if (!e.repeat) Doors.toggle("left"); }
    else if (k === "d" || k === "arrowright") { if (!e.repeat) Doors.toggle("right"); }
    else if (k === "q") { Lights.set("left", true); }
    else if (k === "e") { Lights.set("right", true); }
  },

  onUp(e) {
    const k = (e.key || "").toLowerCase();
    if (k === "q") Lights.set("left", false);
    else if (k === "e") Lights.set("right", false);
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
    Sound.init();
    Sprites.init();
    VHS.init();
    Clock.init();
    Power.init();
    Pan.init();
    Doors.init();
    Lights.init();
    Cameras.init();
    Jumpscare.init();
    Pause.init();
    Menu.init();
    EasterEggs.init();
    PhoneCalls.init();
    NightIntro.init();
    Keys.init();
    Achievements.init();
    MiniGame.init();

    // La boucle tourne en permanence ; tick() ne s'exécute que pendant une nuit.
    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));

    Menu.show();
  },

  startNight(night, customAI = null) {
    GameState.reset(night);
    GameState.customAI = customAI;    // Custom Night : IA réglée par le joueur
    GameState.running = false;        // la nuit ne démarre qu'après le carton d'intro
    Pan.enabled = false;
    Screens.show("office-screen");    // bureau prêt DERRIÈRE le carton d'intro
    Sound.stopAllLoops();
    Sound.resume();

    // Carton « Nuit X », puis démarrage réel de la nuit.
    NightIntro.show(night, customAI, () => this.beginNight(night, customAI));
  },

  // Démarre réellement la nuit (appelé à la fin du carton d'intro).
  beginNight(night, customAI) {
    GameState.running = true;
    Pan.enabled = true;              // ré-autorise le défilement
    Doors.refresh();
    Lights.refresh();
    AI.init(night, customAI);
    EasterEggs.startNight();         // réarme les secrets pour cette nuit
    PhoneCalls.startForNight(night); // appel de lore (rien en Custom Night)
    Clock.update();
    Power.update();

    // Ambiance : bourdonnement du bureau pendant toute la nuit.
    Sound.startLoop("hum");
  },

  // Boucle appelée à chaque frame ; dt = secondes depuis la frame précédente.
  // lastTime est mis à jour à CHAQUE frame (même au menu) pour éviter un dt
  // énorme au lancement d'une nuit après un passage par le menu.
  loop(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    if (GameState.running && !GameState.paused && !GameState.minigame) {
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
    EasterEggs.clear();
    PhoneCalls.stop();
    Sound.stopAllLoops();
    Sound.play("sixAM");      // les cloches de 6h
    Sound.play("victory");    // + petit jingle de réussite

    // Succès liés à toute victoire (économie d'énergie, sans portes).
    if (GameState.power >= 50) Achievements.unlock("thrifty");
    if (GameState.power < 5) Achievements.unlock("on_fumes");
    if (!GameState.anyLightUsed) Achievements.unlock("no_lights");
    if (!GameState.anyCameraUsed) Achievements.unlock("no_cams");

    // Custom Night : pas de déblocage de nuit, juste un message + succès dédiés.
    if (GameState.customAI) {
      Achievements.unlock("custom_win");
      if (ANIMATRONICS.every((a) => (GameState.customAI[a.id] || 0) === 20))
        Achievements.unlock("max_mode");
      document.getElementById("win-text").textContent =
        "Custom Night réussie — bravo !";
      Screens.show("win-screen");
      return;
    }

    // Déblocage de la nuit suivante + écran de victoire 6 AM.
    const n = GameState.night;
    Save.unlock(n + 1);
    if (n === 1) Achievements.unlock("first_night");
    const isLast = n >= NIGHTS.length;
    if (isLast) { Save.unlockCustom(); Achievements.unlock("survivor"); }
    document.getElementById("win-text").textContent = isLast
      ? `Nuit ${n} terminée — tu as survécu à toutes les nuits ! Custom Night débloquée.`
      : `Nuit ${n} terminée ! Nuit ${n + 1} débloquée.`;
    Screens.show("win-screen");
  },

  // Abandonne la nuit et revient au menu principal (depuis la pause).
  quitToMenu() {
    GameState.running = false;
    GameState.paused = false;
    document.getElementById("pause").classList.add("hidden");
    Cameras.lower();
    AI.reset();
    EasterEggs.clear();
    PhoneCalls.stop();
    Sound.stopAllLoops();
    Sound.resume();
    Menu.show();
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
    Achievements.unlock("blackout");   // succès : tomber en panne
    EasterEggs.clear();      // dissipe Joeffrey Doré s'il était présent
    PhoneCalls.stop();       // coupe un appel en cours

    // Coupure : les portes se rouvrent (volets remontés), lumières éteintes.
    GameState.doors.left = false;
    GameState.doors.right = false;
    GameState.lights.left = false;
    GameState.lights.right = false;
    Doors.refresh();
    Lights.refresh();

    // Séquence de panne : filtre noir + Joeffrey dans l'embrasure + musique,
    // puis jumpscare (avec le bureau en fond).
    Pan.enabled = false;                 // on fige la vue pendant la panne
    Sound.stopAllLoops();
    Sound.play("powerOutMusic");

    const killer = getAnimatronic("joeffrey") || { id: "joeffrey", name: "Joeffrey" };
    const blackout = document.getElementById("blackout");
    const boImg = document.getElementById("blackout-img");
    // Image de BASE de Joeffrey dans l'embrasure si elle existe, sinon silhouette.
    boImg.classList.add("hidden");
    const figure = document.getElementById("blackout-figure");
    const boSil = figure.querySelector(".bo-silhouette");
    // Quand la vraie image charge, on masque la silhouette placeholder derrière
    // (sinon on la voit à travers le PNG détouré de Joeffrey). Sinon on la garde.
    boImg.onload = () => { boImg.classList.remove("hidden"); boSil.classList.add("hidden"); };
    boImg.onerror = () => { boImg.classList.add("hidden"); boSil.classList.remove("hidden"); };
    boSil.classList.remove("hidden");    // placeholder par défaut tant que l'image n'a pas chargé
    boImg.src = `assets/images/animatronics/${killer.id}.png`;
    figure.classList.remove("hidden");
    blackout.classList.remove("hidden");

    setTimeout(() => {
      figure.classList.add("hidden");      // la silhouette d'embrasure disparaît
      // Le filtre noir RESTE pendant le jumpscare de Joeffrey (ambiance panne) ;
      // il n'est retiré qu'ensuite. Les autres jumpscares n'ont pas ce filtre.
      Jumpscare.play(killer, () => {
        blackout.classList.add("hidden");
        this.loseNight();
      });
    }, 4000);
  },

  loseNight() {
    GameState.running = false;
    Cameras.lower();
    AI.reset();
    EasterEggs.clear();
    PhoneCalls.stop();
    Achievements.unlock("first_death");   // succès : se faire dégager
    Sound.stopAllLoops();
    Screens.show("gameover-screen");
  },
};

/* =========================================================
   Démarrage
   ========================================================= */
window.addEventListener("DOMContentLoaded", () => {
  Game.init();
});
