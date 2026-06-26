/* =========================================================
   FNAF ENTRE POTES — Définition des animatroniques (les potes)
   Chaque animatronique suit un CHEMIN fixe de salles (ids de caméra) vers
   une porte du bureau. Au bout du chemin (le "corner"), il tente d'entrer :
     - porte fermée  -> il est bloqué et repart au début ;
     - porte ouverte -> il entre -> jumpscare / défaite.

   Champs :
     id           : identifiant interne (= clé des niveaux d'IA dans nights.js)
     name         : nom affiché
     door         : "left" ou "right" -> porte qu'il attaque
     moveInterval : délai (ms) entre deux tentatives de déplacement
     path         : suite d'ids de caméra, de la 1re salle au corner

   Whizip = ex-Bonnie : côté gauche, agressif.
   Chemin de Bonnie : Stage -> Dining Area -> Backstage -> West Hall -> West Corner.
   ========================================================= */

const ANIMATRONICS = [
  {
    id: "whizip",
    name: "Whizip",
    door: "left",
    moveInterval: 5000,
    path: ["1A", "1B", "5", "2A", "2B"],
  },
  {
    // Nolan (ex-Chica) : côté droit, déplacements réguliers.
    // Chemin de Chica : Stage -> Dining Area -> Restrooms -> East Hall -> East Corner.
    id: "nolan",
    name: "Nolan",
    door: "right",
    moveInterval: 5300,
    path: ["1A", "1B", "7", "4A", "4B"],
  },
  {
    // Joeffrey (ex-Freddy) : côté droit, progression LENTE, difficile à repérer.
    // Devient une vraie menace dans les dernières nuits (cf. niveaux dans nights.js).
    // Chemin de Freddy : Stage -> Dining Area -> Restrooms -> East Hall -> East Corner.
    // freezeWhenWatched : il se FIGE tant qu'on regarde sa caméra (trait de Freddy).
    id: "joeffrey",
    name: "Joeffrey",
    door: "right",
    moveInterval: 7000,
    freezeWhenWatched: true,
    path: ["1A", "1B", "7", "4A", "4B"],
  },
  {
    // Célian (ex-Foxy) : système SPÉCIAL à 4 états dans Pirate Cove (cam 1C).
    //   état 0 = caché, 1 = observe, 2 = prépare, 3 = course vers la porte gauche.
    // Le surveiller à la cam 1C le maintient en place. Quand il fonce, il faut
    // fermer la porte gauche à temps, sinon il entre.
    //   stageInterval : délai (ms) entre deux tentatives de progression d'état
    //   runTime       : délai (ms) entre la sortie du rideau et l'arrivée à la porte
    //   blockPower    : énergie perdue quand on le bloque (porte fermée)
    id: "celian",
    name: "Célian",
    type: "foxy",
    door: "left",
    cove: "1C",
    stageInterval: 5000,
    runTime: 3000,
    blockPower: 6,
  },
];

function getAnimatronic(id) {
  return ANIMATRONICS.find((a) => a.id === id);
}
