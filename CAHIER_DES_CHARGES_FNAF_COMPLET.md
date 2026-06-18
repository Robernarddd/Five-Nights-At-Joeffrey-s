# CAHIER DES CHARGES COMPLET — FNAF ENTRE POTES

## VISION DU PROJET

Créer un fangame inspiré de FNAF 1 jouable dans un navigateur.
Le jeu doit sembler sérieux et professionnel malgré son aspect humoristique.
Les animatroniques sont remplacés par des PNG personnalisés représentant les amis du créateur.

---

# STACK TECHNIQUE

- HTML5
- CSS3
- JavaScript Vanilla
- Aucun framework obligatoire

---

# ARBORESCENCE

fnaf-web/
│
├── index.html
├── style.css
├── script.js
│
├── assets/
│   ├── images/
│   │   ├── office/
│   │   ├── cameras/
│   │   ├── animatronics/
│   │   ├── jumpscares/
│   │   └── ui/
│   │
│   └── sounds/
│       ├── ambience/
│       ├── effects/
│       └── jumpscares/
│
└── data/
    └── nights.js

---

# GAME LOOP

Début de nuit :
00:00

Fin :
06:00

Durée réelle :
6 à 8 minutes

Boucle :
- Vérification IA
- Consommation énergie
- Gestion des portes
- Gestion des lumières
- Gestion des caméras
- Vérification victoire/défaite

---

# SYSTEME D'ENERGIE

Valeur initiale :
100

Consommation de base :
1 unité/seconde

Consommations supplémentaires :

Caméras ouvertes :
+0.5

Porte gauche fermée :
+1

Porte droite fermée :
+1

Lumière gauche :
+0.5

Lumière droite :
+0.5

Lorsque l'énergie atteint 0 :
- Désactivation des commandes
- Coupure du bureau
- Séquence de défaite

---

# CAMERAS

Caméras prévues :

1A - Stage
1B - Dining Area
1C - Pirate Cove
2A - West Hall
2B - West Corner
3 - Supply Closet
4A - East Hall
4B - East Corner
5 - Backstage
6 - Kitchen
7 - Restrooms

Chaque caméra possède :
- image vide
- image avec Bonnie
- image avec Chica
- image avec Freddy
- variantes futures

---

# IA GENERALE

Chaque personnage possède :

name
position
aiLevel
moveCooldown
active

Toutes les quelques secondes :

1. Tirage aléatoire
2. Vérification IA
3. Tentative de déplacement

---

# BONNIE

Chemin :

Stage
Dining Area
Backstage
West Hall
West Corner
Left Door

Comportement :
- côté gauche
- agressif
- fréquents déplacements

Si porte ouverte :
Game Over

Si porte fermée :
retour au début du chemin

---

# CHICA

Chemin :

Stage
Dining Area
Restrooms
East Hall
East Corner
Right Door

Comportement :
- côté droit
- régulière

Si porte ouverte :
Game Over

Si porte fermée :
retour au début

---

# FREDDY

Progression lente.

Chemin :

Stage
Dining Area
Restrooms
East Hall
East Corner
Right Door

Particularités :
- plus difficile à repérer
- devient actif dans les nuits avancées

---

# FOXY

Etat 0 :
Rideau fermé

Etat 1 :
Observation

Etat 2 :
Préparation

Etat 3 :
Course

Si porte gauche fermée :
retour état 0

Si porte gauche ouverte :
Game Over

---

# NUITS

Night 1
Bonnie 2
Chica 1
Freddy 0
Foxy 0

Night 2
Bonnie 4
Chica 3
Freddy 1
Foxy 1

Night 3
Bonnie 6
Chica 5
Freddy 2
Foxy 3

Night 4
Bonnie 8
Chica 8
Freddy 5
Foxy 5

Night 5
Bonnie 12
Chica 12
Freddy 10
Foxy 10

---

# MENU PRINCIPAL

Boutons :
- Nouvelle Partie
- Continuer
- Sélection de Nuit
- Crédits

---

# GAME OVER

Afficher :
- jumpscare
- écran noir
- retour menu

---

# VICTOIRE

A 06:00 :
- écran 6 AM
- musique de victoire
- déblocage nuit suivante

---

# SAUVEGARDE

Stockage local navigateur :

- dernière nuit débloquée
- statistiques futures

Utiliser localStorage.

---

# PLAN DE DEVELOPPEMENT

PHASE 1
- Bureau
- Interface

PHASE 2
- Caméras

PHASE 3
- Portes

PHASE 4
- Lumières

PHASE 5
- Energie

PHASE 6
- Bonnie

PHASE 7
- Chica

PHASE 8
- Foxy

PHASE 9
- Freddy

PHASE 10
- Jumpscares

PHASE 11
- Nuit 1

PHASE 12
- Nuits 2 à 5

PHASE 13
- Menu

PHASE 14
- Polish final

IMPORTANT :
Toujours générer du code modulaire, commenté et facilement modifiable.
