/* =========================================================
   FNAF ENTRE POTES — Définition des caméras + plan de surveillance
   Le plan reproduit fidèlement la carte du moniteur de FNAF 1 :
   grand local central, scène en haut, couloirs Ouest/Est descendant
   vers le bureau (YOU) en bas, Pirate Cove à gauche, Toilettes/Cuisine
   à droite. Coordonnées relevées sur la map originale (en % du plan).

   Pour chaque caméra :
     id    : identifiant FNAF affiché sur le bouton
     name  : nom de la salle (provisoire, renommé plus tard)
     map   : centre du bouton sur le plan, en % ({ x, y })
     image : chemin de la VRAIE image (assets/images/cameras/cam_<id>.png).
             Un placeholder s'affiche tant que le fichier n'existe pas.
   ========================================================= */

const CAMERAS = [
  { id: "1A", name: "Show Stage",      map: { x: 39,   y: 8  }, image: "assets/images/cameras/cam_1A.png" },
  { id: "1B", name: "Dining Area",     map: { x: 33,   y: 23.5 }, image: "assets/images/cameras/cam_1B.png" },
  { id: "5",  name: "Backstage",       map: { x: 10,   y: 32 }, image: "assets/images/cameras/cam_5.png"  },
  { id: "7",  name: "Restrooms",       map: { x: 87,   y: 32 }, image: "assets/images/cameras/cam_7.png"  },
  { id: "1C", name: "Pirate Cove",     map: { x: 27.5, y: 46 }, image: "assets/images/cameras/cam_1C.png" },
  { id: "6",  name: "Kitchen",         map: { x: 85,   y: 68.5 }, image: "assets/images/cameras/cam_6.png"  },
  { id: "3",  name: "Supply Closet",   map: { x: 20,   y: 73 }, image: "assets/images/cameras/cam_3.png"  },
  { id: "2A", name: "West Hall",       map: { x: 38.5, y: 78 }, image: "assets/images/cameras/cam_2A.png" },
  { id: "4A", name: "East Hall",       map: { x: 62.5, y: 78 }, image: "assets/images/cameras/cam_4A.png" },
  { id: "2B", name: "W. Hall Corner",  map: { x: 38.5, y: 89 }, image: "assets/images/cameras/cam_2B.png" },
  { id: "4B", name: "E. Hall Corner",  map: { x: 62.5, y: 89 }, image: "assets/images/cameras/cam_4B.png" },
];

// Grand local central (Dining Area), en % du plan : { x1, y1, x2, y2 }.
const ROOM_RECT = { x1: 22, y1: 19, x2: 74, y2: 58 };

// Bureau du joueur ("YOU"), en bas au centre.
const OFFICE_POS = { x: 50, y: 89 };

/* Couloirs à tracer (polylignes orthogonales façon FNAF), points en %.
   side : "left" (vers porte gauche) / "right" (vers porte droite) / null.
   Le côté sert plus tard à l'IA ; à l'écran tout est tracé en blanc. */
const CORRIDORS = [
  // Salles du haut
  { points: [[44, 8], [58, 8], [58, 19]],                 side: null },  // 1A -> local
  { points: [[16, 32], [19, 32], [19, 20], [22, 20]],      side: null },  // 5  -> local
  { points: [[21, 46], [14, 46], [14, 56]],                side: null },  // 1C bras gauche
  { points: [[81, 32], [74, 32]],                          side: null },  // 7  -> local
  { points: [[50, 58], [50, 84]],                          side: null },  // local -> bureau (couloir central)
  // Couloir Ouest -> porte gauche
  { points: [[34, 58], [34, 72], [38.5, 72], [38.5, 74]],  side: "left" },  // local -> 2A
  { points: [[26, 73], [32.5, 73], [32.5, 78]],            side: "left" },  // 3 -> 2A
  { points: [[38.5, 82.5], [38.5, 84.5]],                  side: "left" },  // 2A -> 2B
  { points: [[44.5, 89], [50, 89]],                        side: "left" },  // 2B -> bureau
  // Couloir Est -> porte droite
  { points: [[62.5, 58], [62.5, 74]],                      side: "right" }, // local -> 4A
  { points: [[71, 58], [71, 61], [85, 61], [85, 64.5]],    side: "right" }, // local -> 6
  { points: [[68.5, 78], [75, 78], [75, 68.5], [79, 68.5]], side: "right" }, // 4A -> 6
  { points: [[62.5, 82.5], [62.5, 84.5]],                  side: "right" }, // 4A -> 4B
  { points: [[50, 89], [56.5, 89]],                        side: "right" }, // bureau -> 4B
];

// Petites pièces sans caméra (cabines des toilettes), pour coller à la map.
const DECO_BOXES = [
  { x: 92, y: 40, w: 8, h: 7 },
  { x: 92, y: 52, w: 9, h: 9 },
];

// Caméra affichée par défaut quand on lève le moniteur.
const DEFAULT_CAMERA = "1A";

// Récupère une caméra par son id.
function getCamera(id) {
  return CAMERAS.find((c) => c.id === id) || CAMERAS[0];
}
