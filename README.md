# Five Nights at Joeffrey's

### ▶️ [Jouer en ligne](https://robernarddd.github.io/Five-Nights-At-Joeffrey-s/)

Un fangame de **Five Nights at Freddy's 1** jouable directement dans le
navigateur, où les animatroniques sont remplacés par les potes du créateur.
Gameplay d'horreur joué au sérieux, **100 % HTML / CSS / JavaScript vanilla** :
aucun framework, aucune étape de build, aucune dépendance.

> Tu incarnes **Vincent**, le cousin de Joeffrey, venu passer cinq nuits chez lui
> pour les vacances. Sauf que Joeffrey et sa bande ne veulent pas de toi ici…
> et la nuit, ils comptent bien te faire **dégager** de la maison. Tiens jusqu'à
> **6h** : les parents se réveillent, et tu es tranquille.

## 🎮 Jouer

Le jeu a besoin d'être servi par un petit serveur HTTP (pour charger
correctement les fichiers et l'audio) :

```bash
cd "FNAF 1 Perso"
python3 -m http.server
```

Puis ouvre **http://localhost:8000** dans ton navigateur.

> 💡 Après une mise à jour, fais **Cmd/Ctrl + Shift + R** pour vider le cache.

## 🕹️ Commandes

| Action | Souris / tactile | Clavier |
| --- | --- | --- |
| Regarder autour (bureau panoramique) | Bouge la **souris** / glisse le **doigt** | — |
| Lever / baisser les caméras | **Survole** (ou tape) la barre en bas | **Espace** |
| Changer de caméra | **Clic** sur une caméra de la carte | — |
| Fermer une porte | **Clic** sur le bouton `PORTE` | **A** (gauche) · **D** (droite) |
| Allumer une lumière | **Maintiens** le bouton `LUMIÈRE` | **Q** (gauche) · **E** (droite) — maintenu |
| Pause & réglages | — | **Échap** |

> Jouable au **clavier**, à la **souris** ou au **tactile** (mobile / tablette).

⚡ **Tout consomme de l'énergie** (caméras, portes fermées, lumières). À 0 %,
plus de protection : panne, et tu te fais avoir. Gère ta consommation !

## 👥 Le casting

| Pote | Rôle (FNAF) | Particularité |
| --- | --- | --- |
| **Whizip** | ex-Bonnie | Arrive par la **porte gauche**, agressif |
| **Nolan** | ex-Chica | Arrive par la **porte droite**, régulier |
| **Sidané** | ex-Foxy | Planqué à *Pirate Cove* (CAM 1C), **fonce** vers la porte gauche si on l'oublie |
| **Joeffrey** | ex-Freddy | Porte droite, lent, **se fige quand on le regarde** à la caméra |
| **Vincent** | le joueur | C'est toi, le cousin de trop |

## ✨ Fonctionnalités

- **Bureau panoramique** qui défile à la souris, **caméras** fidèles à la carte FNAF
- **Portes**, **lumières** et **système d'énergie** comme dans l'original
- **IA** des 4 personnages (chemins, niveaux croissants par nuit, Foxy spécial)
- **Jumpscares**, séquence de **panne de courant** immersive
- **Audio entièrement synthétisé** (Web Audio) — aucun fichier son requis
- **5 nuits** équilibrées + **Custom Night** déblocable
- **Succès / trophées** à débloquer (dont quelques-uns secrets)
- **Menu** style FNAF/VHS, **sauvegarde** de progression (localStorage)
- **Lore** distillé par des **appels téléphoniques** au début de chaque nuit
- Quelques **secrets** bien cachés à découvrir… 👀

<details>
<summary>⚠️ Spoilers — easter eggs</summary>

- **Code Konami** (`↑ ↑ ↓ ↓ ← → ← → B A`) sur le menu → débloque la Custom Night.
- **Joeffrey Doré** : très rarement, une affiche dorée apparaît sur la **CAM 5**.
  Si tu rebaisses alors le moniteur, il est assis dans le bureau — **relève vite
  le moniteur** pour le chasser, sinon c'est fini.
- **Flashs subliminaux « C'EST MOI »** : surgissent une fraction de seconde quand
  tu refermes le moniteur.
- **Mini-jeu caché** : pendant une nuit, réalise le **rituel secret** dans
  l'ordre, sans te tromper → **lumière gauche → porte gauche → lumière droite →
  porte droite → lève les caméras → baisse-les**. Un point doré pulse alors dans
  le bureau ; clique-le pour lancer un *tape-taupe* (15 points en 30 s = succès
  secret). La moindre erreur réinitialise la combinaison.

</details>

## 🛠️ Technique

- `index.html` · `style.css` · `script.js` — tout le moteur, en modules par objet
- `data/` — données tunables : niveaux d'IA par nuit, caméras, personnages, et
  textes des appels téléphoniques (le lore est éditable dans `data/calls.js`)
- `assets/` — images (bureau, caméras, personnages, jumpscares) ; des
  placeholders s'affichent tant qu'une vraie image n'est pas déposée

Le code est pensé **modulaire, commenté et facilement modifiable** (commentaires
et textes en français).

## 📝 Crédits

Fangame inspiré de **Five Nights at Freddy's** de Scott Cawthon.
Projet entre potes — *Five Nights at Joeffrey's*.

Les images de salles de caméra sont des **placeholders temporaires** issus de
[Pexels](https://www.pexels.com/) (libres d'utilisation, sans attribution
requise) — à remplacer par les vraies images quand elles seront prêtes.
