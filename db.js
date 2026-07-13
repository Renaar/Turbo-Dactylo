// Stockage des résultats de courses pour le leaderboard.
// Format : un fichier NDJSON (une ligne JSON par résultat), chargé en
// mémoire au démarrage. Aucune dépendance, sauvegarde = copier le fichier.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.TURBO_DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'resultats.ndjson');

let entries = [];

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    entries = fs
      .readFileSync(FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  }
}

function add(rows) {
  if (!rows.length) return;
  entries.push(...rows);
  fs.appendFileSync(FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function remove(id) {
  const before = entries.length;
  entries = entries.filter((e) => e.id !== id);
  if (entries.length === before) return false;
  fs.writeFileSync(
    FILE,
    entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '')
  );
  return true;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Les pseudos sont regroupés sans tenir compte de la casse
const key = (pseudo) => String(pseudo).trim().toLowerCase();

function filtered({ mode, days, classe }) {
  const since = days > 0 ? Date.now() - days * 86400000 : 0;
  return entries.filter(
    (e) => e.mode === mode && e.ts >= since && (!classe || e.classe === classe)
  );
}

/**
 * Classements : top vitesse (meilleur MPM par joueur) et assiduité
 * (nombre de courses par joueur).
 */
function leaderboard({ mode = 'mots', days = 0, classe = '' }) {
  const list = filtered({ mode, days, classe });
  const byPlayer = new Map();
  for (const e of list) {
    const k = key(e.pseudo);
    const cur = byPlayer.get(k);
    if (!cur) {
      byPlayer.set(k, { pseudo: e.pseudo, classe: e.classe, best: e, count: 1, lastTs: e.ts });
    } else {
      cur.count++;
      if (e.wpm > cur.best.wpm) cur.best = e;
      if (e.ts >= cur.lastTs) {
        cur.lastTs = e.ts;
        cur.pseudo = e.pseudo;
        if (e.classe) cur.classe = e.classe;
      }
    }
  }
  const players = [...byPlayer.values()];
  const top = players
    .sort((a, b) => b.best.wpm - a.best.wpm)
    .slice(0, 20)
    .map((p) => ({
      id: p.best.id,
      pseudo: p.pseudo,
      classe: p.classe,
      wpm: p.best.wpm,
      mistakes: p.best.mistakes,
      ts: p.best.ts
    }));
  const assidus = players
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((p) => ({ pseudo: p.pseudo, classe: p.classe, count: p.count }));
  return { top, assidus, total: list.length };
}

/** Statistiques d'un joueur : record, moyenne et dernières courses. */
function playerStats(pseudo, mode = 'mots') {
  const k = key(pseudo);
  const list = entries
    .filter((e) => key(e.pseudo) === k && e.mode === mode)
    .sort((a, b) => b.ts - a.ts);
  if (!list.length) return null;
  const best = list.reduce((m, e) => (e.wpm > m.wpm ? e : m));
  const last = list.slice(0, 10);
  const avg = Math.round(last.reduce((s, e) => s + e.wpm, 0) / last.length);
  return {
    pseudo: list[0].pseudo,
    classe: list[0].classe,
    count: list.length,
    best: { wpm: best.wpm, ts: best.ts },
    avg,
    dernieres: last.map((e) => ({ ts: e.ts, wpm: e.wpm, mistakes: e.mistakes, classe: e.classe }))
  };
}

/** Liste des classes présentes dans les résultats (pour le filtre). */
function classes() {
  return [...new Set(entries.map((e) => e.classe).filter(Boolean))].sort();
}

module.exports = { load, add, remove, makeId, leaderboard, playerStats, classes, FILE };
