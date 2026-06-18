/* =========================================================
   FNAF ENTRE POTES — Configuration des nuits
   Niveaux d'IA par personnage et par nuit (source : cahier des charges).
   Plus le niveau est élevé, plus le personnage se déplace souvent.
   Ce fichier est volontairement séparé pour rester facile à équilibrer.
   ========================================================= */

// Les clés correspondent aux id dans data/animatronics.js :
//   whizip (ex-Bonnie), nolan (ex-Chica), sidane (ex-Foxy), joeffrey (ex-Freddy).
// sidane/joeffrey seront actifs une fois ces persos ajoutés (Phases 8-9).
const NIGHTS = [
  // Night 1
  { id: 1, ai: { whizip: 2,  nolan: 1,  joeffrey: 0,  sidane: 0  } },
  // Night 2
  { id: 2, ai: { whizip: 4,  nolan: 3,  joeffrey: 1,  sidane: 1  } },
  // Night 3
  { id: 3, ai: { whizip: 6,  nolan: 5,  joeffrey: 2,  sidane: 3  } },
  // Night 4
  { id: 4, ai: { whizip: 8,  nolan: 8,  joeffrey: 5,  sidane: 5  } },
  // Night 5
  { id: 5, ai: { whizip: 12, nolan: 12, joeffrey: 10, sidane: 10 } },
];

// Récupère la config d'une nuit par son numéro (1 à 5).
function getNightConfig(nightId) {
  return NIGHTS.find((n) => n.id === nightId) || NIGHTS[0];
}
