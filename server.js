// Serveur du jeu de course de dactylographie.
// Sert les fichiers statiques de public/ et gère les salons via WebSocket.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { generateWordList } = require('./words');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
// PIN de modération du leaderboard (à changer via la variable d'environnement)
const MODERATION_PIN = process.env.TURBO_PIN || 'turbo';

db.load();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// Classements disponibles : courses de classe (mots), échauffement, solo
const MODES = ['mots', 'echauffement', 'solo'];
const readMode = (v) => (MODES.includes(v) ? v : 'mots');

function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/classements') {
    const mode = readMode(url.searchParams.get('mode'));
    const days = Math.max(0, parseInt(url.searchParams.get('jours'), 10) || 0);
    const classe = (url.searchParams.get('classe') || '').slice(0, 20);
    return sendJSON(res, 200, {
      ...db.leaderboard({ mode, days, classe }),
      classes: db.classes()
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/joueur') {
    const pseudo = (url.searchParams.get('pseudo') || '').slice(0, 20);
    const stats = db.playerStats(pseudo, readMode(url.searchParams.get('mode')));
    return sendJSON(res, stats ? 200 : 404, stats || { error: 'Joueur inconnu' });
  }
  if (req.method === 'POST' && url.pathname === '/api/moderation') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch { return sendJSON(res, 400, { error: 'Requête invalide' }); }
      if (msg.pin !== MODERATION_PIN) return sendJSON(res, 403, { error: 'PIN incorrect' });
      // Suppression d'une entrée, ou de toutes celles d'un pseudo
      // (utile quand un pseudo inapproprié a couru plusieurs fois)
      if (msg.pseudo) {
        const n = db.removeByPseudo(String(msg.pseudo));
        return sendJSON(res, n ? 200 : 404,
          n ? { ok: true, supprimees: n } : { error: 'Pseudo introuvable' });
      }
      const ok = db.remove(String(msg.id || ''));
      sendJSON(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Entrée introuvable' });
    });
    return;
  }
  sendJSON(res, 404, { error: 'Introuvable' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  let urlPath = decodeURIComponent(url.pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Interdit');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Page introuvable');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

// ---------------------------------------------------------------------------
// État du jeu

const CAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
  '#e67e22', '#e84393', '#00cec9', '#6c5ce7', '#fdcb6e', '#55efc4',
  '#fab1a0', '#74b9ff', '#a29bfe', '#ff7675', '#badc58', '#f0932b',
  '#22a6b3', '#be2edd'
];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 40;
const WORD_COUNTS = [10, 15, 20, 30, 40];

// Course par équipes : 0 = chacun pour soi, sinon 2 à 4 équipes
const TEAM_COUNTS = [0, 2, 3, 4];
const TEAM_DEFS = [
  { name: 'Rouges', emoji: '🔴', color: '#e74c3c' },
  { name: 'Bleus', emoji: '🔵', color: '#3498db' },
  { name: 'Verts', emoji: '🟢', color: '#2ecc71' },
  { name: 'Jaunes', emoji: '🟡', color: '#f39c12' }
];

const lobbies = new Map(); // code -> lobby
let nextPlayerId = 1;

function makeCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (lobbies.has(code));
  return code;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(lobby, msg) {
  const data = JSON.stringify(msg);
  for (const p of lobby.players.values()) {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(data);
  }
}

function lobbyState(lobby) {
  return {
    type: 'lobby',
    code: lobby.code,
    hostId: lobby.hostId,
    status: lobby.status,
    options: lobby.options,
    classe: lobby.classe,
    solo: !!lobby.solo,
    players: [...lobby.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      spectator: p.spectator
    }))
  };
}

/** Vitesse d'un joueur en mots par minute (plancher d'une seconde). */
function playerWpm(lobby, p, now = Date.now()) {
  const elapsedMin = Math.max(((p.finishTime || now) - lobby.race.startTime) / 60000, 1 / 60);
  return Math.round((p.chars + p.partial) / 5 / elapsedMin);
}

/**
 * Répartit les coureurs au hasard en équipes de tailles équilibrées
 * (une différence d'un joueur au maximum).
 */
function assignTeams(racers, nbTeams) {
  const shuffled = racers.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const teams = TEAM_DEFS.slice(0, nbTeams).map((def, index) => ({
    ...def, index, memberIds: [], rank: null, finishTime: null
  }));
  shuffled.forEach((p, i) => {
    const t = teams[i % nbTeams];
    p.team = t.index;
    t.memberIds.push(p.id);
  });
  return teams;
}

/** Membres d'une équipe encore présents dans le salon. */
function teamMembers(lobby, team) {
  return team.memberIds.map((id) => lobby.players.get(id)).filter(Boolean);
}

/** Message décrivant la course qui commence (mots ou frappes, équipes). */
function raceSetupMsg(lobby) {
  return {
    type: 'race_setup',
    mode: lobby.race.mode,
    words: lobby.race.words,
    target: lobby.race.target,
    teams: lobby.race.teams
      ? lobby.race.teams.map((t) => ({
        index: t.index,
        name: t.name,
        emoji: t.emoji,
        color: t.color,
        members: teamMembers(lobby, t).map((p) => ({ id: p.id, name: p.name }))
      }))
      : null
  };
}

/** État d'une équipe : la progression est la moyenne de ses membres. */
function teamState(lobby, team, now = Date.now()) {
  const members = teamMembers(lobby, team);
  const progress = members.length
    ? members.reduce((s, p) => s + p.progress, 0) / members.length : 0;
  const wpm = members.length
    ? Math.round(members.reduce((s, p) => s + playerWpm(lobby, p, now), 0) / members.length) : 0;
  return {
    index: team.index,
    name: team.name,
    emoji: team.emoji,
    color: team.color,
    progress,
    wpm,
    finishedCount: members.filter((p) => p.finished).length,
    total: members.length,
    rank: team.rank
  };
}

function progressState(lobby) {
  const now = Date.now();
  return {
    type: 'progress',
    players: [...lobby.players.values()]
      .filter((p) => !p.spectator)
      .map((p) => ({
        id: p.id,
        progress: p.progress,
        wordIndex: p.wordIndex,
        wpm: playerWpm(lobby, p, now),
        finished: p.finished,
        rank: p.rank,
        disconnected: p.ws.readyState !== p.ws.OPEN
      })),
    teams: lobby.race.teams
      ? lobby.race.teams.map((t) => teamState(lobby, t, now)) : null
  };
}

function resetPlayerRace(p) {
  p.wordIndex = 0;
  p.partial = 0;
  p.chars = 0;
  p.progress = 0;
  p.mistakes = 0;
  p.finished = false;
  p.finishTime = null;
  p.rank = null;
}

function startRace(lobby) {
  lobby.status = 'countdown';
  const { mode, wordCount, charCount } = lobby.options;
  lobby.race = {
    mode,
    words: mode === 'echauffement' ? null : generateWordList(wordCount),
    target: mode === 'echauffement' ? charCount : null,
    startTime: null,
    finishedCount: 0,
    teamFinishedCount: 0,
    teams: null,
    tick: null
  };
  for (const p of lobby.players.values()) {
    // L'hôte organise la course mais n'y participe pas — sauf en solo,
    // où il est le seul joueur.
    p.spectator = !lobby.solo && p.id === lobby.hostId;
    p.team = null;
    resetPlayerRace(p);
  }

  // Tirage au sort des équipes (il en faut au moins deux pour que ça ait
  // un sens : sinon on retombe sur une course individuelle)
  const racers = [...lobby.players.values()].filter((p) => !p.spectator);
  const nbTeams = Math.min(lobby.options.teams || 0, racers.length);
  if (nbTeams >= 2) lobby.race.teams = assignTeams(racers, nbTeams);

  broadcast(lobby, lobbyState(lobby));
  broadcast(lobby, raceSetupMsg(lobby));

  let n = 3;
  const step = () => {
    if (!lobbies.has(lobby.code)) return;
    if (n > 0) {
      broadcast(lobby, { type: 'countdown', n });
      n--;
      lobby.countdownTimer = setTimeout(step, 1000);
    } else {
      lobby.status = 'racing';
      lobby.race.startTime = Date.now();
      broadcast(lobby, { type: 'go' });
      lobby.race.tick = setInterval(() => broadcast(lobby, progressState(lobby)), 200);
    }
  };
  step();
}

function finishPlayer(lobby, player) {
  player.finished = true;
  player.finishTime = Date.now();
  player.rank = ++lobby.race.finishedCount;
  player.progress = 1;
  broadcast(lobby, {
    type: 'player_finished',
    id: player.id,
    name: player.name,
    rank: player.rank
  });

  // Une équipe a terminé quand tous ses membres sont arrivés
  const team = lobby.race.teams && player.team !== null
    ? lobby.race.teams[player.team] : null;
  if (team && team.rank === null) {
    const members = teamMembers(lobby, team);
    if (members.length && members.every((p) => p.finished)) {
      team.rank = ++lobby.race.teamFinishedCount;
      team.finishTime = Date.now();
      broadcast(lobby, {
        type: 'team_finished',
        index: team.index,
        name: team.name,
        emoji: team.emoji,
        rank: team.rank
      });
    }
  }

  maybeEndRace(lobby);
}

function endRace(lobby) {
  if (lobby.race && lobby.race.tick) clearInterval(lobby.race.tick);
  lobby.status = 'results';
  const results = [...lobby.players.values()]
    .filter((p) => !p.spectator)
    .map((p) => {
      const time = p.finishTime ? (p.finishTime - lobby.race.startTime) / 1000 : null;
      const elapsedMin = Math.max(((p.finishTime || Date.now()) - lobby.race.startTime) / 60000, 1 / 60);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        team: p.team,
        rank: p.rank,
        finished: p.finished,
        time,
        wpm: Math.round((p.chars + p.partial) / 5 / elapsedMin),
        mistakes: p.mistakes,
        wordIndex: p.wordIndex,
        totalWords: lobby.race.words ? lobby.race.words.length : lobby.race.target
      };
    })
    .sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.rank - b.rank;
      return b.wordIndex - a.wordIndex;
    });

  // Classement des équipes : celles qui ont fini d'abord, puis à la
  // progression moyenne
  const teams = lobby.race.teams
    ? lobby.race.teams
      .map((t) => teamState(lobby, t))
      .sort((a, b) => {
        if ((a.rank === null) !== (b.rank === null)) return a.rank === null ? 1 : -1;
        if (a.rank !== null) return a.rank - b.rank;
        return b.progress - a.progress;
      })
    : null;

  broadcast(lobby, { type: 'results', results, teams });
  broadcast(lobby, lobbyState(lobby));

  // Enregistre les courses terminées. Les entraînements solo vont dans
  // leur propre classement : le classement de classe ne récompense que
  // les courses organisées par un enseignant.
  db.add(results
    .filter((r) => r.finished)
    .map((r) => ({
      id: db.makeId(),
      ts: Date.now(),
      pseudo: r.name,
      classe: lobby.classe || '',
      mode: lobby.solo ? 'solo' : lobby.race.mode,
      wpm: r.wpm,
      mistakes: r.mistakes,
      timeS: Math.round(r.time * 10) / 10,
      total: r.totalWords
    })));
}

function maybeEndRace(lobby) {
  const racers = [...lobby.players.values()].filter(
    (p) => !p.spectator && p.ws.readyState === p.ws.OPEN
  );
  const allDone = racers.length > 0 && racers.every((p) => p.finished);
  if (allDone) endRace(lobby);
}

function backToLobby(lobby) {
  if (lobby.race && lobby.race.tick) clearInterval(lobby.race.tick);
  clearTimeout(lobby.countdownTimer);
  lobby.status = 'waiting';
  lobby.race = null;
  for (const p of lobby.players.values()) {
    p.spectator = false;
    resetPlayerRace(p);
  }
  broadcast(lobby, lobbyState(lobby));
}

function removePlayer(lobby, player) {
  lobby.players.delete(player.id);
  if (lobby.players.size === 0) {
    if (lobby.race && lobby.race.tick) clearInterval(lobby.race.tick);
    clearTimeout(lobby.countdownTimer);
    lobbies.delete(lobby.code);
    return;
  }
  if (lobby.hostId === player.id) {
    lobby.hostId = lobby.players.keys().next().value;
  }
  broadcast(lobby, lobbyState(lobby));
  if (lobby.status === 'racing') maybeEndRace(lobby);
}

// ---------------------------------------------------------------------------
// Connexions

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  let lobby = null;
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create':
      case 'join':
      case 'solo': {
        if (player) return;
        const name = String(msg.name || '').trim().slice(0, 20);
        if (!name) return send(ws, { type: 'error', message: 'Choisis un pseudo.' });

        if (msg.type === 'join') {
          const code = String(msg.code || '').trim().toUpperCase();
          lobby = lobbies.get(code);
          // Un entraînement solo n'est jamais rejoignable
          if (!lobby || lobby.solo) {
            lobby = null;
            return send(ws, { type: 'error', message: 'Salon introuvable. Vérifie le code.' });
          }
          if (lobby.players.size >= MAX_PLAYERS) {
            lobby = null;
            return send(ws, { type: 'error', message: 'Ce salon est complet.' });
          }
        } else {
          const solo = msg.type === 'solo';
          lobby = {
            code: makeCode(),
            hostId: null,
            status: 'waiting',
            solo,
            options: {
              mode: 'mots',
              wordCount: WORD_COUNTS.includes(msg.wordCount) ? msg.wordCount : 20,
              charCount: 200,
              teams: 0
            },
            classe: solo ? '' : String(msg.classe || '').trim().slice(0, 20),
            players: new Map(),
            race: null,
            countdownTimer: null
          };
          lobbies.set(lobby.code, lobby);
        }

        player = {
          id: nextPlayerId++,
          ws,
          name,
          color: CAR_COLORS[lobby.players.size % CAR_COLORS.length],
          spectator: lobby.status !== 'waiting' && lobby.status !== 'results'
        };
        resetPlayerRace(player);
        lobby.players.set(player.id, player);
        if (lobby.hostId === null) lobby.hostId = player.id;

        send(ws, { type: 'welcome', playerId: player.id, code: lobby.code });
        broadcast(lobby, lobbyState(lobby));
        // L'entraînement solo démarre sans salle d'attente
        if (lobby.solo) {
          startRace(lobby);
        } else if (player.spectator && lobby.race) {
          send(ws, raceSetupMsg(lobby));
          send(ws, { type: 'go' });
        }
        break;
      }

      case 'options': {
        if (!lobby || player.id !== lobby.hostId || lobby.status !== 'waiting') return;
        const mode = ['mots', 'echauffement'].includes(msg.mode)
          ? msg.mode : lobby.options.mode;
        const wordCount = WORD_COUNTS.includes(msg.wordCount)
          ? msg.wordCount : lobby.options.wordCount;
        const charCount = [100, 200, 300, 400].includes(msg.charCount)
          ? msg.charCount : lobby.options.charCount;
        const teams = TEAM_COUNTS.includes(msg.teams) ? msg.teams : lobby.options.teams;
        lobby.options = { mode, wordCount, charCount, teams };
        broadcast(lobby, lobbyState(lobby));
        break;
      }

      case 'start': {
        if (!lobby || player.id !== lobby.hostId) return;
        if (lobby.status !== 'waiting' && lobby.status !== 'results') return;
        const racers = [...lobby.players.values()].filter(
          (p) => p.id !== lobby.hostId && p.ws.readyState === p.ws.OPEN
        );
        if (racers.length === 0) {
          return send(ws, {
            type: 'lobby_error',
            message: 'Il faut au moins un joueur dans le salon pour lancer la course.'
          });
        }
        startRace(lobby);
        break;
      }

      case 'typed': {
        if (!lobby || lobby.status !== 'racing' || player.spectator || player.finished) return;

        if (lobby.race.mode === 'echauffement') {
          // Échauffement : chaque frappe compte. On borne la progression par
          // message pour éviter les sauts impossibles.
          const target = lobby.race.target;
          let count = Math.floor(Number(msg.count) || 0);
          count = Math.min(count, target, player.chars + 20);
          if (count <= player.chars) return;
          player.chars = count;
          player.wordIndex = count;
          player.progress = count / target;
          if (count >= target) finishPlayer(lobby, player);
          break;
        }

        const words = lobby.race.words;
        const word = words[player.wordIndex];
        if (word === undefined) return;
        const value = String(msg.value || '').slice(0, word.length + 10);
        player.mistakes = Math.max(player.mistakes, Number(msg.mistakes) || 0);

        if (value === word) {
          player.chars += word.length;
          player.partial = 0;
          player.wordIndex++;
          if (player.wordIndex >= words.length) {
            finishPlayer(lobby, player);
          } else {
            player.progress = player.wordIndex / words.length;
          }
        } else {
          let matched = 0;
          while (matched < value.length && matched < word.length && value[matched] === word[matched]) {
            matched++;
          }
          player.partial = matched;
          player.progress = (player.wordIndex + matched / word.length) / words.length;
        }
        break;
      }

      case 'kick': {
        if (!lobby || player.id !== lobby.hostId) return;
        const target = lobby.players.get(Number(msg.id));
        if (!target || target.id === player.id) return;
        send(target.ws, { type: 'kicked' });
        target.ws.close();
        break;
      }

      case 'end_race': {
        if (!lobby || player.id !== lobby.hostId || lobby.status !== 'racing') return;
        endRace(lobby);
        break;
      }

      case 'replay': {
        if (!lobby || player.id !== lobby.hostId || lobby.status !== 'results') return;
        if (lobby.solo) {
          // En solo on relance aussitôt, avec le nombre de mots choisi
          if (WORD_COUNTS.includes(msg.wordCount)) lobby.options.wordCount = msg.wordCount;
          startRace(lobby);
        } else {
          backToLobby(lobby);
        }
        break;
      }

      case 'leave': {
        if (lobby && player) {
          const l = lobby, p = player;
          lobby = null;
          player = null;
          removePlayer(l, p);
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (lobby && player) removePlayer(lobby, player);
  });
});

// Nettoyage des connexions mortes
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`🏁 Course de dactylo lancée sur http://localhost:${PORT}`);
});
