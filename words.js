// Banque de mots courants de la langue française.
// À chaque course, la liste est tirée au hasard dans cette banque.
// Pour personnaliser le jeu (mots de dictée, thème de la semaine…),
// il suffit de modifier ce tableau.

const WORD_BANK = [
  // Le corps
  'tête', 'bras', 'jambe', 'main', 'pied', 'doigt', 'épaule', 'genou', 'cheville', 'coude',
  'visage', 'front', 'joue', 'menton', 'oreille', 'bouche', 'langue', 'dent', 'gorge', 'cou',
  'dos', 'ventre', 'cœur', 'poumon', 'estomac', 'cerveau', 'muscle', 'squelette', 'peau', 'sang',
  'cheveux', 'sourcil', 'cil', 'ongle', 'poignet', 'hanche', 'cuisse', 'mollet', 'talon', 'orteil',
  // La famille
  'père', 'mère', 'frère', 'sœur', 'oncle', 'tante', 'cousin', 'cousine', 'neveu', 'nièce',
  'parents', 'enfant', 'bébé', 'jumeau', 'famille', 'mariage', 'naissance', 'prénom', 'surnom', 'ancêtre',
  // La maison
  'maison', 'appartement', 'immeuble', 'étage', 'escalier', 'ascenseur', 'couloir', 'chambre', 'salon', 'cuisine',
  'fenêtre', 'porte', 'mur', 'plafond', 'plancher', 'toit', 'cheminée', 'balcon', 'terrasse', 'jardin',
  'meuble', 'table', 'chaise', 'fauteuil', 'canapé', 'armoire', 'étagère', 'bureau', 'tiroir', 'miroir',
  'lampe', 'ampoule', 'rideau', 'tapis', 'coussin', 'couverture', 'oreiller', 'matelas', 'drap', 'réveil',
  'assiette', 'verre', 'tasse', 'bol', 'fourchette', 'couteau', 'cuillère', 'casserole', 'poêle', 'four',
  'frigo', 'congélateur', 'évier', 'robinet', 'éponge', 'serviette', 'nappe', 'plateau', 'bouteille', 'carafe',
  // L'école
  'école', 'classe', 'élève', 'maître', 'maîtresse', 'professeur', 'directeur', 'cour', 'récréation', 'cantine',
  'cahier', 'crayon', 'stylo', 'gomme', 'règle', 'ciseaux', 'colle', 'trousse', 'cartable', 'classeur',
  'tableau', 'craie', 'feutre', 'feuille', 'papier', 'livre', 'page', 'image', 'dessin', 'peinture',
  'leçon', 'contrôle', 'exercice', 'question', 'réponse', 'erreur', 'correction', 'note', 'bulletin', 'diplôme',
  'lecture', 'écriture', 'dictée', 'grammaire', 'conjugaison', 'vocabulaire', 'orthographe', 'calcul', 'géométrie', 'histoire',
  'géographie', 'sciences', 'anglais', 'poésie', 'théâtre', 'bibliothèque', 'dictionnaire', 'alphabet', 'lettre', 'mot',
  'nombre', 'chiffre', 'addition', 'soustraction', 'multiplication', 'division', 'fraction', 'mesure', 'poids', 'longueur',
  // Le temps
  'temps', 'heure', 'minute', 'seconde', 'jour', 'semaine', 'mois', 'année', 'siècle', 'saison',
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'matin', 'midi', 'soir',
  'nuit', 'aube', 'crépuscule', 'hier', 'demain', 'veille', 'lendemain', 'moment', 'instant', 'durée',
  'janvier', 'février', 'avril', 'juillet', 'septembre', 'octobre', 'novembre', 'décembre', 'printemps', 'calendrier',
  // La météo
  'été', 'automne', 'hiver', 'soleil', 'nuage', 'pluie', 'neige', 'vent', 'orage', 'tempête',
  'brouillard', 'éclair', 'tonnerre', 'arc-en-ciel', 'gel', 'givre', 'canicule', 'averse', 'climat', 'température',
  // La nature
  'arbre', 'branche', 'racine', 'tronc', 'écorce', 'forêt', 'buisson', 'herbe', 'mousse', 'champignon',
  'fleur', 'rose', 'tulipe', 'marguerite', 'violette', 'muguet', 'lavande', 'pétale', 'bouquet', 'graine',
  'montagne', 'colline', 'vallée', 'plaine', 'falaise', 'grotte', 'volcan', 'sommet', 'rocher', 'caillou',
  'rivière', 'fleuve', 'ruisseau', 'lac', 'étang', 'cascade', 'source', 'marais', 'île', 'plage',
  'mer', 'océan', 'vague', 'marée', 'sable', 'coquillage', 'écume', 'courant', 'horizon', 'littoral',
  // Les animaux
  'animal', 'chien', 'chat', 'lapin', 'hamster', 'souris', 'cheval', 'poney', 'vache', 'taureau',
  'mouton', 'chèvre', 'cochon', 'poule', 'coq', 'poussin', 'canard', 'oie', 'dinde', 'pigeon',
  'lion', 'tigre', 'éléphant', 'girafe', 'zèbre', 'singe', 'gorille', 'panda', 'koala', 'kangourou',
  'loup', 'renard', 'ours', 'cerf', 'sanglier', 'écureuil', 'hérisson', 'blaireau', 'castor', 'chauve-souris',
  'oiseau', 'aigle', 'hibou', 'chouette', 'corbeau', 'moineau', 'hirondelle', 'perroquet', 'cygne', 'flamant',
  'poisson', 'requin', 'baleine', 'dauphin', 'pieuvre', 'crabe', 'crevette', 'méduse', 'truite', 'saumon',
  'serpent', 'lézard', 'tortue', 'grenouille', 'crocodile', 'insecte', 'papillon', 'abeille', 'fourmi', 'coccinelle',
  'araignée', 'mouche', 'moustique', 'guêpe', 'libellule', 'sauterelle', 'escargot', 'ver', 'chenille', 'scarabée',
  // La nourriture
  'pain', 'baguette', 'croissant', 'brioche', 'tartine', 'beurre', 'confiture', 'miel', 'céréales', 'biscuit',
  'fromage', 'yaourt', 'lait', 'crème', 'œuf', 'viande', 'poulet', 'jambon', 'saucisse', 'steak',
  'riz', 'pâtes', 'semoule', 'purée', 'frites', 'soupe', 'salade', 'sandwich', 'pizza', 'quiche',
  'légume', 'carotte', 'tomate', 'patate', 'courgette', 'aubergine', 'poireau', 'épinard', 'haricot', 'chou',
  'oignon', 'ail', 'concombre', 'radis', 'navet', 'citrouille', 'potiron', 'brocoli', 'céleri', 'betterave',
  'fruit', 'pomme', 'poire', 'pêche', 'abricot', 'prune', 'cerise', 'fraise', 'framboise', 'myrtille',
  'banane', 'citron', 'mandarine', 'pamplemousse', 'ananas', 'kiwi', 'mangue', 'raisin', 'melon', 'noisette',
  'dessert', 'gâteau', 'tarte', 'crêpe', 'gaufre', 'glace', 'chocolat', 'bonbon', 'caramel', 'vanille',
  'eau', 'jus', 'sirop', 'limonade', 'tisane', 'thé', 'café', 'cacao', 'boisson', 'gourde',
  // Les vêtements
  'vêtement', 'pantalon', 'jean', 'short', 'jupe', 'robe', 'chemise', 'pull', 'gilet', 'manteau',
  'veste', 'blouson', 'anorak', 'écharpe', 'bonnet', 'casquette', 'chapeau', 'gant', 'chaussette', 'chaussure',
  'botte', 'basket', 'sandale', 'pyjama', 'maillot', 'ceinture', 'poche', 'bouton', 'fermeture', 'capuche',
  // La ville
  'ville', 'village', 'quartier', 'rue', 'avenue', 'boulevard', 'trottoir', 'carrefour', 'rond-point', 'panneau',
  'magasin', 'boutique', 'marché', 'supermarché', 'boulangerie', 'pâtisserie', 'boucherie', 'pharmacie', 'librairie', 'fleuriste',
  'mairie', 'poste', 'banque', 'hôpital', 'clinique', 'caserne', 'commissariat', 'prison', 'tribunal', 'musée',
  'cinéma', 'stade', 'piscine', 'gymnase', 'parc', 'square', 'fontaine', 'statue', 'pont', 'tunnel',
  // Les transports
  'voiture', 'camion', 'camionnette', 'moto', 'scooter', 'vélo', 'trottinette', 'bus', 'car', 'taxi',
  'train', 'métro', 'tramway', 'avion', 'hélicoptère', 'fusée', 'bateau', 'voilier', 'péniche', 'ferry',
  'route', 'autoroute', 'chemin', 'sentier', 'gare', 'aéroport', 'port', 'quai', 'billet', 'valise',
  'roue', 'pneu', 'volant', 'moteur', 'frein', 'phare', 'klaxon', 'coffre', 'portière', 'essence',
  // Les métiers
  'métier', 'boulanger', 'boucher', 'coiffeur', 'facteur', 'pompier', 'policier', 'gendarme', 'médecin', 'infirmier',
  'dentiste', 'vétérinaire', 'pharmacien', 'avocat', 'juge', 'journaliste', 'photographe', 'cuisinier', 'serveur', 'fermier',
  'jardinier', 'maçon', 'plombier', 'électricien', 'menuisier', 'peintre', 'mécanicien', 'chauffeur', 'pilote', 'marin',
  'acteur', 'chanteur', 'danseur', 'musicien', 'écrivain', 'poète', 'sculpteur', 'architecte', 'ingénieur', 'savant',
  // Le sport
  'football', 'basket-ball', 'handball', 'rugby', 'tennis', 'badminton', 'golf', 'hockey', 'volley', 'pétanque',
  'natation', 'plongée', 'voile', 'aviron', 'escalade', 'randonnée', 'équitation', 'gymnastique', 'athlétisme', 'escrime',
  'course', 'saut', 'lancer', 'marathon', 'sprint', 'relais', 'champion', 'championnat', 'victoire', 'défaite',
  'équipe', 'joueur', 'arbitre', 'entraîneur', 'terrain', 'ballon', 'but', 'filet', 'raquette', 'médaille',
  // Les verbes
  'être', 'avoir', 'faire', 'dire', 'aller', 'voir', 'savoir', 'pouvoir', 'vouloir', 'venir',
  'devoir', 'prendre', 'trouver', 'donner', 'parler', 'aimer', 'passer', 'mettre', 'demander', 'tenir',
  'sembler', 'laisser', 'rester', 'penser', 'entendre', 'regarder', 'répondre', 'rendre', 'connaître', 'paraître',
  'arriver', 'croire', 'porter', 'chercher', 'entrer', 'sortir', 'monter', 'descendre', 'tomber', 'lever',
  'marcher', 'courir', 'sauter', 'nager', 'voler', 'danser', 'chanter', 'jouer', 'rire', 'pleurer',
  'manger', 'boire', 'dormir', 'rêver', 'écouter', 'sentir', 'toucher', 'goûter', 'respirer', 'bouger',
  'écrire', 'lire', 'compter', 'dessiner', 'peindre', 'coller', 'découper', 'plier', 'ranger', 'nettoyer',
  'ouvrir', 'fermer', 'allumer', 'éteindre', 'pousser', 'tirer', 'jeter', 'attraper', 'soulever', 'poser',
  'acheter', 'vendre', 'payer', 'gagner', 'perdre', 'choisir', 'changer', 'réparer', 'casser', 'construire',
  'apprendre', 'comprendre', 'expliquer', 'répéter', 'oublier', 'retenir', 'réfléchir', 'imaginer', 'inventer', 'découvrir',
  'aider', 'partager', 'prêter', 'offrir', 'remercier', 'inviter', 'accueillir', 'rencontrer', 'saluer', 'quitter',
  'commencer', 'finir', 'continuer', 'arrêter', 'attendre', 'préparer', 'essayer', 'réussir', 'rater', 'recommencer',
  // Les adjectifs
  'grand', 'petit', 'gros', 'mince', 'long', 'court', 'large', 'étroit', 'haut', 'bas',
  'beau', 'joli', 'laid', 'propre', 'sale', 'neuf', 'vieux', 'jeune', 'ancien', 'moderne',
  'chaud', 'froid', 'tiède', 'sec', 'mouillé', 'dur', 'mou', 'lisse', 'rugueux', 'pointu',
  'fort', 'faible', 'rapide', 'lent', 'léger', 'lourd', 'plein', 'vide', 'ouvert', 'fermé',
  'facile', 'difficile', 'simple', 'compliqué', 'possible', 'impossible', 'utile', 'inutile', 'important', 'urgent',
  'content', 'heureux', 'joyeux', 'triste', 'fâché', 'calme', 'nerveux', 'timide', 'courageux', 'peureux',
  'gentil', 'méchant', 'poli', 'sage', 'drôle', 'sérieux', 'curieux', 'prudent', 'honnête', 'fidèle',
  'intelligent', 'malin', 'habile', 'adroit', 'maladroit', 'attentif', 'distrait', 'patient', 'rêveur', 'bavard',
  // Les couleurs
  'couleur', 'rouge', 'bleu', 'vert', 'jaune', 'violet', 'orange', 'marron', 'gris', 'noir',
  'blanc', 'beige', 'doré', 'argenté', 'clair', 'foncé', 'multicolore', 'transparent', 'pâle', 'vif',
  // Les adverbes
  'bien', 'mal', 'vite', 'lentement', 'doucement', 'souvent', 'parfois', 'toujours', 'jamais', 'encore',
  'beaucoup', 'peu', 'trop', 'assez', 'presque', 'environ', 'ensemble', 'ailleurs', 'partout', 'dehors',
  'dedans', 'dessus', 'dessous', 'devant', 'derrière', 'autour', 'loin', 'près', 'ici', 'maintenant',
  // Les émotions
  'joie', 'bonheur', 'tristesse', 'colère', 'peur', 'surprise', 'amour', 'amitié', 'courage', 'espoir',
  // La santé
  'santé', 'maladie', 'fièvre', 'rhume', 'toux', 'blessure', 'pansement', 'médicament', 'vaccin', 'guérison',
  // La musique
  'instrument', 'piano', 'guitare', 'violon', 'flûte', 'trompette', 'tambour', 'batterie', 'orchestre', 'concert',
  'chanson', 'mélodie', 'rythme', 'refrain', 'couplet', 'partition', 'chorale', 'opéra', 'danse', 'spectacle',
  // La technologie
  'ordinateur', 'clavier', 'écran', 'tablette', 'téléphone', 'portable', 'message', 'internet', 'robot', 'machine',
  'photo', 'caméra', 'vidéo', 'film', 'télévision', 'radio', 'journal', 'magazine', 'affiche', 'antenne',
  // Les objets et outils
  'objet', 'boîte', 'sac', 'panier', 'corde', 'ficelle', 'clé', 'serrure', 'marteau', 'tournevis',
  'clou', 'vis', 'scie', 'pince', 'échelle', 'seau', 'balai', 'pelle', 'râteau', 'brouette',
  // La fête
  'cadeau', 'fête', 'anniversaire', 'invitation', 'guirlande', 'bougie', 'confetti', 'déguisement', 'masque', 'farandole',
  // Le voyage
  'voyage', 'vacances', 'tourisme', 'hôtel', 'camping', 'tente', 'aventure', 'carte', 'boussole', 'itinéraire',
  // Les contes
  'conte', 'légende', 'prince', 'princesse', 'château', 'chevalier', 'dragon', 'sorcière', 'fée', 'magie',
  'trésor', 'pirate', 'monstre', 'géant', 'nain', 'lutin', 'licorne', 'grimoire', 'potion', 'mystère',
  // L'espace
  'espace', 'étoile', 'planète', 'terre', 'lune', 'comète', 'galaxie', 'univers', 'satellite', 'astronaute',
  // La géographie
  'pays', 'capitale', 'frontière', 'continent', 'désert', 'jungle', 'savane', 'glacier', 'canyon', 'oasis',
  // Les gens
  'personne', 'monsieur', 'madame', 'voisin', 'ami', 'copain', 'camarade', 'groupe', 'foule', 'peuple',
  // Les sens
  'bruit', 'silence', 'voix', 'cri', 'chuchotement', 'écho', 'odeur', 'parfum', 'goût', 'saveur',
  // Les formes
  'forme', 'cercle', 'carré', 'triangle', 'rectangle', 'losange', 'ovale', 'cube', 'sphère', 'pyramide',
  // Les matières
  'bois', 'métal', 'fer', 'or', 'argent', 'cristal', 'pierre', 'marbre', 'plastique', 'carton',
  'tissu', 'laine', 'coton', 'soie', 'cuir', 'paille', 'caoutchouc', 'argile', 'ciment', 'gravier'
];

/**
 * Génère la liste de mots d'une course : tirage aléatoire sans doublons
 * dans la banque de mots.
 */
function generateWordList(count) {
  const shuffled = WORD_BANK.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const words = [];
  while (words.length < count) {
    words.push(...shuffled.slice(0, count - words.length));
  }
  return words.slice(0, count);
}

module.exports = { WORD_BANK, generateWordList };
