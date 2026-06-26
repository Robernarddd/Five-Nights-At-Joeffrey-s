/* =========================================================
   FNAF ENTRE POTES — Appels téléphoniques (le « Phone Guy »)
   Le lore se raconte ici, au début de chaque nuit, comme dans FNAF.

   HISTOIRE : tu incarnes VINCENT, le cousin de Joeffrey, venu passer 5 nuits
   chez lui pendant les vacances. Sauf que Joeffrey et sa bande (Adam, Nolan,
   Célian) ne veulent pas de toi ici : la nuit, ils essaient de te FAIRE DÉGAGER
   de la maison. S'ils t'attrapent dans ta chambre, c'est la valise → dehors
   (= partie perdue). Tiens jusqu'à 6h : les parents se réveillent, tout le monde
   refait le gentil, et tu es tranquille (= nuit gagnée).

   Celui qui t'appelle est un autre cousin, déjà passé par là, qui te file des
   conseils... tant qu'il est encore dans la maison.

   Pour ÉCRIRE TON propre lore : modifie simplement les textes ci-dessous.
   C'est l'endroit idéal pour glisser les vraies blagues / l'histoire entre potes.

   Champs par nuit :
     from   : qui appelle (affiché en en-tête de l'appel)
     text   : le message (le « \n » fait un retour à la ligne)
     glitch : true => l'appel grésille/tremble (ambiance, ex. dernière nuit)

   La clé est le numéro de nuit (1 à 5). Pas d'entrée = pas d'appel
   (la Custom Night, par exemple, n'a pas d'appel).
   ========================================================= */

const PHONE_CALLS = {
  // -------- Nuit 1 : accueil + règles du jeu, ton léger mais ça sent le piège --------
  1: {
    from: "Un cousin — Nuit 1",
    text:
      "Allô ? Ah, Vincent ! C'est ton cousin. Bienvenue chez Joeffrey pour les " +
      "vacances... bon courage, surtout.\n" +
      "Je t'explique vite fait : Joeffrey et sa bande ne supportent pas qu'on " +
      "débarque chez lui. La nuit, ils essaient de te faire dégager de la maison. " +
      "S'ils te coincent dans ta chambre, c'est réglé : valise, et dehors.\n" +
      "Pour tenir : ferme les portes de ta chambre (gauche et droite), allume le " +
      "couloir pour voir qui rôde, et surveille les caméras des parents sur la " +
      "tablette. Mais attention au compteur : ce vieux truc saute si tu abuses " +
      "des portes, des lumières et des caméras. Plus de courant = plus de " +
      "protection.\n" +
      "Tiens jusqu'à 6h : les parents se réveillent, tout le monde refait le " +
      "gentil, et tu es tranquille. Allez, bonne première nuit !",
  },

  // -------- Nuit 2 : conseils (qui vient d'où) + Célian --------
  2: {
    from: "Un cousin — Nuit 2",
    text:
      "Re, c'est encore moi. Tu as tenu la première nuit, pas mal !\n" +
      "Deux-trois conseils. Adam arrive surtout par la gauche, Nolan par la " +
      "droite. Garde un œil sur eux aux caméras : tant que tu les regardes, ils " +
      "osent moins avancer.\n" +
      "Et méfie-toi de Célian — il poireaute dans son coin (le « Pirate Cove », " +
      "qu'il appelle ça, l'idiot). Si tu l'oublies trop longtemps, il pique un " +
      "sprint vers ta porte gauche. Là, faut fermer vite.\n" +
      "Économise le compteur, hein. Bonne nuit.",
  },

  // -------- Nuit 3 : pourquoi ils te détestent (les cousins d'avant) --------
  3: {
    from: "Un cousin — Nuit 3",
    text:
      "Salut. T'es coriace, dis donc.\n" +
      "Bon, je vais être honnête : t'es pas le premier cousin qu'ils essaient de " +
      "virer. On était plusieurs à venir passer les vacances ici... et disons que " +
      "la plupart sont repartis bien plus tôt que prévu.\n" +
      "Joeffrey déteste partager sa maison. Lui et ses potes ont décidé que t'es " +
      "de trop. C'est rien de personnel — enfin, si. Un peu.\n" +
      "Garde les portes, surveille le compteur, et ne baisse jamais ta garde. " +
      "Fais gaffe à toi cette nuit.",
  },

  // -------- Nuit 4 : l'appel coupé (le cousin se fait dégager) --------
  4: {
    from: "Un cousin — Nuit 4",
    text:
      "Hé, c'est moi... écoute, je peux pas parler longtemps là.\n" +
      "Je voulais juste te dire que tu te débrouilles super bien. Sérieux.\n" +
      "[ des pas dans le couloir ]\n" +
      "Attends... ils sont là. Ils sont devant MA porte. J'avais oublié de la " +
      "ferm—\n" +
      "Non non non, pas la valise— lâchez-moi—\n" +
      "[ grésillement ] ...si tu reçois ce message, c'est que je me suis fait " +
      "dégager. Tiens bon, toi. Va jusqu'au bout.",
  },

  // -------- Nuit 5 : plus personne pour t'aider, Joeffrey te nargue --------
  5: {
    from: "??? — Nuit 5",
    glitch: true,
    text:
      "[ grésillement ] ...████... y'a plus personne pour t'aider, cousin.\n" +
      "...████... Joeffrey sait que t'es encore là. Ils le savent tous.\n" +
      "...████... Dernière nuit. Tiens jusqu'à 6h et t'as gagné tes vacances.\n" +
      "...████... Sinon... la valise t'attend. Bonne chance, Vincent.",
  },
};

// Renvoie l'appel d'une nuit (ou null s'il n'y en a pas).
function getPhoneCall(night) {
  return PHONE_CALLS[night] || null;
}
