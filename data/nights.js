/* =========================================================
   FNAF ENTRE POTES — Configuration des nuits
   Niveaux d'IA par personnage et par nuit (source : cahier des charges).
   Plus le niveau est élevé, plus le personnage se déplace souvent.
   Ce fichier est volontairement séparé pour rester facile à équilibrer.
   ========================================================= */

// Niveaux d'IA (0 = inactif, 20 = max) par nuit, équilibrés pour une montée
// progressive. Clés = id dans data/animatronics.js :
//   whizip (gauche, agressif) · nolan (droite, régulier)
//   celian (Pirate Cove -> gauche, par états) · joeffrey (droite, lent/sournois)
// Rappel des côtés : GAUCHE = whizip + celian, DROITE = nolan + joeffrey.
const NIGHTS = [
  // N1 — Tutoriel : seuls deux marcheurs lents (un par côté). Célian et Joeffrey
  // dorment. Largement survivable, le temps d'apprendre portes/caméras/énergie.
  { id: 1, ai: { whizip: 3,  nolan: 2,  joeffrey: 0,  celian: 0  } },
  // N2 — Célian se réveille (apprentissage de Pirate Cove) ; Joeffrey s'amorce.
  { id: 2, ai: { whizip: 5,  nolan: 4,  joeffrey: 1,  celian: 2  } },
  // N3 — Les quatre sont actifs et modérés : la vraie partie commence.
  { id: 3, ai: { whizip: 7,  nolan: 6,  joeffrey: 3,  celian: 4  } },
  // N4 — Dur : forte pression des deux côtés, Célian exigeant, Joeffrey menaçant.
  { id: 4, ai: { whizip: 10, nolan: 8,  joeffrey: 6,  celian: 7  } },
  // N5 — Brutal mais jouable : il faut gérer énergie + 2 menaces par porte.
  { id: 5, ai: { whizip: 13, nolan: 11, joeffrey: 8,  celian: 10 } },
];

// Récupère la config d'une nuit par son numéro (1 à 5).
function getNightConfig(nightId) {
  return NIGHTS.find((n) => n.id === nightId) || NIGHTS[0];
}
