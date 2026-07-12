// Serveur du jeu de course de dactylographie.
// Sert les fichiers statiques de public/ et gère les salons via WebSocket.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { generateWordList } = require('./words');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
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
    players: [...lobby.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      spectator: p.spectator
    }))
  };
}

function progressState(lobby) {
  const now = Date.now();
  return {
    type: 'progress',
    players: [...lobby.players.values()]
      .filter((p) => !p.spectator)
      .map((p) => {
        // Plancher d'une seconde pour éviter des MPM absurdes en début de course
        const elapsedMin = Math.max(((p.finishTime || now) - lobby.race.startTime) / 60000, 1 / 60);
        const chars = p.chars + p.partial;
        return {
          id: p.id,
          progress: p.progress,
          wordIndex: p.wordIndex,
          wpm: Math.round(chars / 5 / elapsedMin),
          finished: p.finished,
          rank: p.rank,
          disconnected: p.ws.readyState !== p.ws.OPEN
        };
      })
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
  lobby.race = {
    words: generateWordList(lobby.options.wordCount),
    startTime: null,
    finishedCount: 0,
    tick: null
  };
  for (const p of lobby.players.values()) {
    p.spectator = false;
    resetPlayerRace(p);
  }
  broadcast(lobby, lobbyState(lobby));
  broadcast(lobby, { type: 'race_setup', words: lobby.race.words });

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
        rank: p.rank,
        finished: p.finished,
        time,
        wpm: Math.round((p.chars + p.partial) / 5 / elapsedMin),
        mistakes: p.mistakes,
        wordIndex: p.wordIndex,
        totalWords: lobby.race.words.length
      };
    })
    .sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.rank - b.rank;
      return b.wordIndex - a.wordIndex;
    });
  broadcast(lobby, { type: 'results', results });
  broadcast(lobby, lobbyState(lobby));
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
      case 'join': {
        if (player) return;
        const name = String(msg.name || '').trim().slice(0, 20);
        if (!name) return send(ws, { type: 'error', message: 'Choisis un pseudo.' });

        if (msg.type === 'create') {
          lobby = {
            code: makeCode(),
            hostId: null,
            status: 'waiting',
            options: { wordCount: 20 },
            players: new Map(),
            race: null,
            countdownTimer: null
          };
          lobbies.set(lobby.code, lobby);
        } else {
          const code = String(msg.code || '').trim().toUpperCase();
          lobby = lobbies.get(code);
          if (!lobby) {
            return send(ws, { type: 'error', message: 'Salon introuvable. Vérifie le code.' });
          }
          if (lobby.players.size >= MAX_PLAYERS) {
            lobby = null;
            return send(ws, { type: 'error', message: 'Ce salon est complet.' });
          }
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
        if (player.spectator && lobby.race) {
          send(ws, { type: 'race_setup', words: lobby.race.words });
          send(ws, { type: 'go' });
        }
        break;
      }

      case 'options': {
        if (!lobby || player.id !== lobby.hostId || lobby.status !== 'waiting') return;
        const wordCount = [10, 15, 20, 30, 40].includes(msg.wordCount)
          ? msg.wordCount : lobby.options.wordCount;
        lobby.options = { wordCount };
        broadcast(lobby, lobbyState(lobby));
        break;
      }

      case 'start': {
        if (!lobby || player.id !== lobby.hostId) return;
        if (lobby.status !== 'waiting' && lobby.status !== 'results') return;
        startRace(lobby);
        break;
      }

      case 'typed': {
        if (!lobby || lobby.status !== 'racing' || player.spectator || player.finished) return;
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
            maybeEndRace(lobby);
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

      case 'end_race': {
        if (!lobby || player.id !== lobby.hostId || lobby.status !== 'racing') return;
        endRace(lobby);
        break;
      }

      case 'replay': {
        if (!lobby || player.id !== lobby.hostId || lobby.status !== 'results') return;
        backToLobby(lobby);
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
