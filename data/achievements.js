/* =========================================================
   FNAF ENTRE POTES — Succès / Trophées
   Liste des succès débloquables. Chaque succès est obtenu via un événement de
   jeu (cf. Achievements.unlock(id) appelé dans script.js) et reste sauvegardé
   dans le localStorage (Save.data.achievements).

   Champs :
     id     : identifiant interne (= clé de déblocage)
     name   : nom affiché
     desc   : description (comment l'obtenir)
     secret : true => caché (« Succès secret ») tant qu'il n'est pas obtenu

   Pour AJOUTER un succès : ajoute une entrée ici, puis appelle
   Achievements.unlock("<id>") au bon endroit dans script.js.
   ========================================================= */

const ACHIEVEMENTS = [
  { id: "first_night", name: "Bienvenue chez Joeffrey", desc: "Survivre à la première nuit." },
  { id: "survivor",    name: "Vacances survécues",      desc: "Battre les 5 nuits." },
  { id: "custom_win",  name: "Sur-mesure",              desc: "Gagner une Custom Night." },
  { id: "max_mode",    name: "20 / 20 / 20 / 20",       desc: "Gagner une Custom Night avec tous les potes à 20." },
  { id: "thrifty",     name: "Économe",                 desc: "Finir une nuit avec au moins 50 % d'énergie." },
  { id: "on_fumes",    name: "Au bout du fil",          desc: "Finir une nuit avec moins de 5 % d'énergie." },
  { id: "open_house",  name: "Maison ouverte",          desc: "Survivre une nuit sans jamais fermer de porte." },
  { id: "first_death", name: "Dehors !",                desc: "Se faire dégager pour la première fois." },
  { id: "blackout",    name: "Panne de courant",        desc: "Tomber complètement à court d'énergie." },
  { id: "golden",      name: "C'est toi ?",             desc: "Échapper à Joeffrey Doré.", secret: true },
  { id: "konami",      name: "Le code",          desc: "Entrer le code secret depuis le menu.", secret: true },
  { id: "arcade",      name: "Game dans le game",       desc: "Gagner le mini-jeu caché dans le bureau.", secret: true },
  // « Platine » : se débloque tout seul quand TOUS les autres succès sont obtenus.
  { id: "platinum",    name: "Légende de Joeffrey", desc: "Débloquer tous les autres succès." },
];

function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
