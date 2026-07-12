// Listes de mots français par niveau de difficulté.
// Facile : mots courts, sans accents. Moyen : mots courants avec quelques
// accents. Difficile : mots longs et pièges orthographiques.

const WORDS = {
  facile: [
    'ami', 'eau', 'roi', 'lit', 'mur', 'sac', 'bal', 'riz', 'jeu', 'feu',
    'nid', 'bec', 'lac', 'mer', 'sud', 'nul', 'sel', 'vin', 'pain', 'main',
    'chat', 'chien', 'bleu', 'vert', 'rose', 'gris', 'noir', 'lune', 'jour',
    'nuit', 'pluie', 'vent', 'rue', 'pont', 'bois', 'fleur', 'arbre', 'porte',
    'table', 'chaise', 'livre', 'page', 'mot', 'nom', 'ligne', 'point', 'balle',
    'jouet', 'ecole', 'classe', 'ferme', 'vache', 'poule', 'lapin', 'souris',
    'ours', 'loup', 'singe', 'poisson', 'oiseau', 'plage', 'sable', 'neige',
    'route', 'train', 'avion', 'bateau', 'velo', 'moto', 'auto', 'roue',
    'pied', 'bras', 'dos', 'nez', 'oeil', 'dent', 'coeur', 'corps', 'tete',
    'papa', 'mama', 'frere', 'soeur', 'bebe', 'fille', 'garcon', 'copain',
    'pomme', 'poire', 'prune', 'fraise', 'banane', 'orange', 'citron', 'melon',
    'lait', 'sucre', 'gateau', 'bonbon', 'soupe', 'salade', 'tomate', 'carotte'
  ],
  moyen: [
    'maison', 'jardin', 'voiture', 'fenêtre', 'école', 'forêt', 'été',
    'rivière', 'montagne', 'musique', 'histoire', 'lecture', 'cahier',
    'crayon', 'gomme', 'trousse', 'cartable', 'bureau', 'tableau', 'craie',
    'semaine', 'année', 'saison', 'automne', 'hiver', 'printemps', 'soleil',
    'nuage', 'orage', 'tonnerre', 'éclair', 'tempête', 'brouillard', 'météo',
    'famille', 'cousin', 'cousine', 'oncle', 'tante', 'grand-père',
    'grand-mère', 'parents', 'enfants', 'voisin', 'village', 'quartier',
    'magasin', 'marché', 'boulangerie', 'baguette', 'fromage', 'beurre',
    'confiture', 'chocolat', 'vanille', 'caramel', 'dessert', 'cuisine',
    'assiette', 'fourchette', 'couteau', 'cuillère', 'serviette', 'verre',
    'animal', 'éléphant', 'girafe', 'panthère', 'crocodile', 'tortue',
    'papillon', 'coccinelle', 'araignée', 'fourmi', 'abeille', 'guêpe',
    'château', 'chevalier', 'princesse', 'dragon', 'trésor', 'pirate',
    'bateau', 'capitaine', 'aventure', 'voyage', 'vacances', 'valise',
    'plongée', 'piscine', 'football', 'basket', 'tennis', 'course', 'saut',
    'victoire', 'équipe', 'joueur', 'ballon', 'terrain', 'arbitre', 'sifflet',
    'ordinateur', 'clavier', 'souris', 'écran', 'téléphone', 'message'
  ],
  difficile: [
    'bibliothèque', 'gymnastique', "aujourd'hui", 'développement',
    'extraordinaire', 'mathématiques', 'géographie', 'dictionnaire',
    'encyclopédie', 'orthographe', 'grammaire', 'conjugaison', 'vocabulaire',
    'apprentissage', 'connaissance', 'intelligence', 'imagination',
    'construction', 'architecture', 'température', 'thermomètre',
    'électricité', 'magnétisme', 'laboratoire', 'expérience', 'scientifique',
    'astronomie', 'télescope', 'microscope', 'photographie', 'cinématographe',
    'chrysanthème', 'rhinocéros', 'hippopotame', 'chimpanzé', 'orang-outan',
    'bourgeon', 'écureuil', 'grenouille', 'chauve-souris', 'hérisson',
    'anniversaire', 'félicitations', 'remerciement', 'politesse',
    'gentillesse', 'honnêteté', 'sincérité', 'générosité', 'solidarité',
    'environnement', 'recyclage', 'pollution', 'biodiversité', 'écosystème',
    'météorologie', 'catastrophe', 'tremblement', 'inondation', 'sécheresse',
    'championnat', 'compétition', 'entraînement', 'performance', 'endurance',
    'chronomètre', 'kilomètre', 'centimètre', 'millimètre', 'rectangle',
    'parallèle', 'perpendiculaire', 'symétrie', 'périmètre', 'multiplication',
    'soustraction', 'quotient', 'fraction', 'pourcentage', 'probabilité',
    'gouvernement', 'république', 'démocratie', 'citoyenneté', 'monument',
    'révolution', 'préhistoire', 'archéologie', 'civilisation', 'pyramide'
  ]
};

/**
 * Génère une liste de mots pour une course : tirage aléatoire sans doublons
 * tant que la réserve le permet.
 */
function generateWordList(difficulty, count) {
  const pool = WORDS[difficulty] || WORDS.moyen;
  const shuffled = pool.slice();
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

module.exports = { WORDS, generateWordList };
