# 🏎️ Turbo Dactylo

Un jeu de course de dactylographie multijoueur pour la classe — un clone de
TypeRacer **100 % gratuit, sans pub et sans inscription**.

Chaque élève a une voiture vue du dessus. Un mot apparaît à l'écran : il faut
le taper correctement au clavier pour faire avancer sa voiture. Quand le mot
est validé, le suivant apparaît. Le premier à taper tous les mots franchit la
ligne d'arrivée !

## ✨ Fonctionnalités

- **Salons privés** : le professeur crée un salon et obtient un code à
  5 caractères que les élèves saisissent pour rejoindre (jusqu'à 40 joueurs).
  Le créateur du salon **organise la course sans y participer** : il donne le
  départ, suit les voitures et peut terminer la course — ce qui empêche
  aussi un joueur de créer des salons pour gonfler ses propres scores.
- **Même liste de mots pour tous** : à chaque course, la liste est tirée au
  hasard dans une banque de 1 100 mots courants de la langue française et
  envoyée à tous les joueurs — la course est équitable.
- **Nombre de mots réglable** : de 10 à 40 mots par course.
- **Mode échauffement** : taper n'importe quels caractères le plus vite
  possible (100 à 400 frappes) — parfait pour délier les doigts en début de
  séance.
- **Modération** : l'hôte peut renvoyer un joueur du salon (pseudo
  inapproprié, etc.) d'un clic sur la croix à côté de son nom.
- **🏆 Classements persistants, sans comptes** : chaque course terminée est
  enregistrée (pseudo, MPM, erreurs, date, classe). La page « Classements »
  affiche les plus rapides et les plus assidus, filtrables par mode, par
  période (semaine / mois / toujours) et par classe, plus les statistiques
  détaillées de chaque joueur. Le champ « Classe » est saisi (optionnellement)
  à la création du salon. Les élèves doivent **toujours utiliser le même
  pseudo** pour retrouver leurs statistiques (le navigateur le mémorise).
- **Course en temps réel** : les voitures avancent en direct sur la piste,
  lettre par lettre, avec compte à rebours 3-2-1.
- **Statistiques** : vitesse en MPM (mots par minute), temps, erreurs,
  classement avec podium.
- **Rejouer en un clic** : l'hôte relance une course avec une nouvelle liste
  de mots. Les retardataires deviennent spectateurs et participent à la
  course suivante.

## 🚀 Démarrer

Il faut [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
npm start
```

Le jeu est alors disponible sur [http://localhost:3000](http://localhost:3000).

### En classe (réseau local)

1. Lancez le serveur sur votre ordinateur (`npm start`).
2. Trouvez l'adresse IP de votre machine sur le réseau de l'école
   (`ip addr` sous Linux, `ipconfig` sous Windows).
3. Les élèves ouvrent `http://VOTRE_IP:3000` dans leur navigateur.
4. Créez un salon, affichez le code au tableau, et c'est parti !

### Sur Internet (hébergement gratuit)

Le serveur fonctionne sur n'importe quel hébergeur Node.js gratuit
(par exemple [Render](https://render.com), [Railway](https://railway.app),
[Glitch](https://glitch.com)) :

- **Commande de build** : `npm install`
- **Commande de démarrage** : `npm start`
- Le serveur écoute sur le port fourni par la variable d'environnement
  `PORT` (3000 par défaut).

Un fichier `render.yaml` est fourni pour un déploiement en un clic sur Render.

## 🎮 Déroulement d'une partie

1. Le professeur entre son pseudo et clique sur **Créer un salon**.
2. Les élèves entrent leur pseudo et le **code du salon**.
3. L'hôte choisit le nombre de mots, puis clique sur **Lancer la course**.
4. Compte à rebours, puis chacun tape les mots affichés — la voiture avance
   à chaque lettre correcte, les lettres fausses s'affichent en rouge et il
   faut les corriger pour continuer.
5. À la fin, le podium et le tableau des scores s'affichent ; l'hôte peut
   relancer une course immédiatement.

## 🛡️ Modération des classements

Pour retirer une entrée du classement (pseudo inapproprié…) : page
« Classements » → lien **Modération** en bas → saisir le PIN → une croix
apparaît à côté de chaque entrée. Le PIN par défaut est `turbo` ;
**changez-le** en définissant la variable d'environnement `TURBO_PIN` au
lancement du serveur (`TURBO_PIN=monsecret npm start`).

## 🛠️ Technique

- Serveur : Node.js + [`ws`](https://github.com/websockets/ws) (WebSockets),
  aucune autre dépendance.
- Client : HTML/CSS/JavaScript sans framework.
- Les mots sont validés côté serveur : la progression des voitures est
  calculée sur le serveur pour éviter la triche.
- La banque de mots se modifie facilement dans [`words.js`](words.js)
  (mots de dictée de la semaine, vocabulaire d'un thème…).
- Les résultats des courses sont stockés dans `data/resultats.ndjson`
  (emplacement modifiable via `TURBO_DATA_DIR`). **Sauvegardez ce fichier**
  régulièrement si les classements comptent pour vous — c'est la seule
  donnée persistante du jeu.
