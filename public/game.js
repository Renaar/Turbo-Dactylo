// Logique client du jeu de course de dactylographie.

(() => {
  'use strict';

  // --- État ----------------------------------------------------------------
  let ws = null;
  let myId = null;
  let lobby = null; // dernier état "lobby" reçu du serveur
  let race = {
    mode: 'mots',
    words: [],
    target: 0,
    typed: 0,
    index: 0,
    mistakes: 0,
    prevLen: 0,
    spectator: false
  };

  // --- Éléments ---------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const screens = {
    home: $('screen-home'),
    lobby: $('screen-lobby'),
    race: $('screen-race'),
    results: $('screen-results')
  };

  const inputName = $('input-name');
  const inputCode = $('input-code');
  const homeError = $('home-error');
  const lobbyCodeEl = $('lobby-code');
  const playerList = $('player-list');
  const hostOptions = $('host-options');
  const guestOptions = $('guest-options');
  const selectMode = $('select-mode');
  const selectCount = $('select-count');
  const selectChars = $('select-chars');
  const optWords = $('opt-words');
  const optChars = $('opt-chars');
  const btnStart = $('btn-start');
  const waitingMsg = $('waiting-msg');
  const trackEl = $('track');
  const wordDisplay = $('word-display');
  const inputTyping = $('input-typing');
  const raceProgress = $('race-progress');
  const raceWpm = $('race-wpm');
  const spectatorMsg = $('spectator-msg');
  const btnEndRace = $('btn-end-race');
  const countdownOverlay = $('countdown-overlay');
  const countdownNumber = $('countdown-number');
  const finishBanner = $('finish-banner');
  const podium = $('podium');
  const resultsBody = $('results-body');
  const btnReplay = $('btn-replay');
  const replayWait = $('replay-wait');

  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
      el.classList.toggle('active', key === name);
    }
  }

  // --- Voiture (vue du dessus, avance vers la droite) ---------------------
  function carSVG(color, size = 46) {
    return `
      <svg width="${size}" height="${size / 2}" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="1" width="12" height="5" rx="2" fill="#222"/>
        <rect x="8" y="24" width="12" height="5" rx="2" fill="#222"/>
        <rect x="40" y="1" width="12" height="5" rx="2" fill="#222"/>
        <rect x="40" y="24" width="12" height="5" rx="2" fill="#222"/>
        <path d="M6 5 h38 q12 0 14 10 q-2 10 -14 10 h-38 q-4 0 -4 -4 v-12 q0 -4 4 -4 z" fill="${color}"/>
        <rect x="34" y="8" width="8" height="14" rx="3" fill="#bde3ff" opacity="0.9"/>
        <rect x="12" y="8" width="16" height="14" rx="3" fill="#00000022"/>
        <rect x="1" y="6" width="4" height="18" rx="2" fill="#00000055"/>
      </svg>`;
  }

  // --- WebSocket ------------------------------------------------------------
  function connect(onOpen) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = onOpen;
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
    ws.onclose = () => {
      if (myId !== null) {
        showError('Connexion perdue. Recharge la page pour rejouer.');
      }
      myId = null;
      showScreen('home');
    };
  }

  function sendMsg(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function showError(text) {
    homeError.textContent = text;
    homeError.classList.remove('hidden');
  }

  // --- Messages serveur ------------------------------------------------------
  function handleMessage(msg) {
    switch (msg.type) {
      case 'error':
        showError(msg.message);
        if (myId === null && ws) ws.close();
        break;

      case 'welcome':
        myId = msg.playerId;
        homeError.classList.add('hidden');
        break;

      case 'lobby':
        lobby = msg;
        renderLobby();
        if (msg.status === 'waiting') {
          // Retour au salon depuis n'importe quel écran (accueil, course, résultats)
          showScreen('lobby');
        } else if (screens.home.classList.contains('active')) {
          // On vient de rejoindre une partie déjà commencée
          showScreen(msg.status === 'results' ? 'lobby' : 'race');
        }
        break;

      case 'race_setup': {
        race.mode = msg.mode || 'mots';
        race.words = msg.words || [];
        race.target = msg.target || 0;
        race.typed = 0;
        race.index = 0;
        race.mistakes = 0;
        race.prevLen = 0;
        const me = lobby && lobby.players.find((p) => p.id === myId);
        race.spectator = !!(me && me.spectator);
        setupRaceScreen();
        break;
      }

      case 'countdown':
        showScreen('race');
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = msg.n;
        break;

      case 'go':
        showScreen('race');
        countdownOverlay.classList.add('hidden');
        if (!race.spectator) {
          inputTyping.disabled = false;
          inputTyping.value = '';
          inputTyping.focus();
          if (race.mode === 'echauffement') {
            renderWarmup();
          } else {
            renderWord('');
          }
        }
        break;

      case 'kicked':
        myId = null;
        lobby = null;
        if (ws) ws.close();
        ws = null;
        showScreen('home');
        showError('Tu as été renvoyé du salon par le professeur.');
        break;

      case 'progress':
        updateTrack(msg.players);
        break;

      case 'player_finished':
        announceFinish(msg);
        break;

      case 'results':
        showResults(msg.results);
        break;
    }
  }

  // --- Salon -----------------------------------------------------------------
  function renderLobby() {
    if (!lobby) return;
    const isHost = lobby.hostId === myId;
    lobbyCodeEl.textContent = lobby.code;

    hostOptions.classList.toggle('hidden', !isHost);
    guestOptions.classList.toggle('hidden', isHost);
    const opts = lobby.options;
    if (isHost) {
      selectMode.value = opts.mode;
      selectCount.value = String(opts.wordCount);
      selectChars.value = String(opts.charCount);
      optWords.classList.toggle('hidden', opts.mode === 'echauffement');
      optChars.classList.toggle('hidden', opts.mode !== 'echauffement');
    } else {
      guestOptions.textContent = opts.mode === 'echauffement'
        ? `🔥 Échauffement · ${opts.charCount} frappes`
        : `🏁 Course de ${opts.wordCount} mots`;
    }

    btnStart.classList.toggle('hidden', !isHost);
    waitingMsg.classList.toggle('hidden', isHost);
    btnReplay.classList.toggle('hidden', !isHost);
    replayWait.classList.toggle('hidden', isHost);
    btnEndRace.classList.toggle('hidden', !isHost);

    playerList.innerHTML = '';
    for (const p of lobby.players) {
      const li = document.createElement('li');
      const icon = document.createElement('span');
      icon.className = 'car-icon';
      icon.innerHTML = carSVG(p.color, 34);
      li.appendChild(icon);
      const name = document.createElement('span');
      name.textContent = p.name + (p.id === myId ? ' (toi)' : '');
      li.appendChild(name);
      if (p.id === lobby.hostId) {
        const badge = document.createElement('span');
        badge.className = 'host-badge';
        badge.textContent = '⭐ hôte';
        li.appendChild(badge);
      }
      if (p.spectator) {
        const badge = document.createElement('span');
        badge.className = 'spectator-badge';
        badge.textContent = '👀 spectateur';
        li.appendChild(badge);
      }
      if (isHost && p.id !== myId) {
        const kick = document.createElement('button');
        kick.className = 'kick-btn';
        kick.title = `Renvoyer ${p.name} du salon`;
        kick.textContent = '✖';
        kick.addEventListener('click', () => {
          if (confirm(`Renvoyer ${p.name} du salon ?`)) {
            sendMsg({ type: 'kick', id: p.id });
          }
        });
        li.appendChild(kick);
      }
      playerList.appendChild(li);
    }
  }

  // --- Course ------------------------------------------------------------------
  function setupRaceScreen() {
    finishBanner.classList.add('hidden');
    inputTyping.value = '';
    inputTyping.disabled = true;
    spectatorMsg.classList.toggle('hidden', !race.spectator);
    wordDisplay.innerHTML = race.spectator ? '' : '…';
    raceProgress.textContent = race.mode === 'echauffement'
      ? `0 / ${race.target} frappes`
      : `Mot 0 / ${race.words.length}`;
    raceWpm.textContent = '0 MPM';
    buildTrack();
  }

  function renderWarmup() {
    wordDisplay.innerHTML =
      '<span class="warmup">🔥 Tape n’importe quoi,<br>le plus vite possible !</span>';
    raceProgress.textContent = `${race.typed} / ${race.target} frappes`;
  }

  function buildTrack() {
    trackEl.innerHTML = '';
    if (!lobby) return;
    for (const p of lobby.players) {
      if (p.spectator) continue;
      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.dataset.playerId = p.id;
      lane.innerHTML = `
        <span class="lane-name">${escapeHTML(p.name)}${p.id === myId ? ' ⬅ toi' : ''}</span>
        <span class="lane-wpm"></span>
        <div class="start-line"></div>
        <div class="finish-line"></div>
        <div class="car">${carSVG(p.color)}</div>`;
      trackEl.appendChild(lane);
    }
  }

  function updateTrack(players) {
    for (const p of players) {
      const lane = trackEl.querySelector(`.lane[data-player-id="${p.id}"]`);
      if (!lane) continue;
      const car = lane.querySelector('.car');
      // La voiture va de 2 % (départ) à 88 % (ligne d'arrivée)
      car.style.left = `${2 + p.progress * 86}%`;
      car.classList.toggle('finished', p.finished);
      car.classList.toggle('disconnected', p.disconnected);
      const wpmEl = lane.querySelector('.lane-wpm');
      wpmEl.textContent = p.finished ? `🏁 ${ordinal(p.rank)}` : `${p.wpm} MPM`;
      if (p.id === myId) {
        raceWpm.textContent = `${p.wpm} MPM`;
      }
    }
  }

  function renderWord(typed) {
    const word = race.words[race.index];
    if (word === undefined) {
      wordDisplay.innerHTML = '🏁 Terminé !';
      return;
    }
    let html = '';
    for (let i = 0; i < word.length; i++) {
      const ch = escapeHTML(word[i]);
      if (i < typed.length) {
        html += typed[i] === word[i]
          ? `<span class="done">${ch}</span>`
          : `<span class="wrong">${ch}</span>`;
      } else {
        html += `<span class="todo">${ch}</span>`;
      }
    }
    const next = race.words[race.index + 1];
    if (next !== undefined) {
      html += `<span class="next-hint">suivant : ${escapeHTML(next)}</span>`;
    }
    wordDisplay.innerHTML = html;
    raceProgress.textContent = `Mot ${race.index} / ${race.words.length}`;
  }

  function onTyping() {
    if (race.mode === 'echauffement') {
      const len = inputTyping.value.length;
      if (len > race.prevLen) {
        race.typed = Math.min(race.typed + (len - race.prevLen), race.target);
        sendMsg({ type: 'typed', count: race.typed });
      }
      race.prevLen = len;
      // On vide le champ régulièrement pour qu'il ne déborde jamais
      if (len > 24) {
        inputTyping.value = '';
        race.prevLen = 0;
      }
      renderWarmup();
      if (race.typed >= race.target) {
        inputTyping.disabled = true;
        wordDisplay.innerHTML = '🏁 Terminé !';
      }
      return;
    }

    const word = race.words[race.index];
    if (word === undefined) return;
    const value = inputTyping.value;

    // Compte une erreur quand une nouvelle lettre tapée ne correspond pas
    if (value.length > race.prevLen && !word.startsWith(value)) {
      race.mistakes++;
      inputTyping.classList.add('error-flash');
      setTimeout(() => inputTyping.classList.remove('error-flash'), 200);
    }
    race.prevLen = value.length;

    sendMsg({ type: 'typed', value, mistakes: race.mistakes });

    if (value === word) {
      race.index++;
      race.prevLen = 0;
      inputTyping.value = '';
      renderWord('');
      if (race.index >= race.words.length) {
        inputTyping.disabled = true;
        raceProgress.textContent = `Mot ${race.words.length} / ${race.words.length}`;
      }
    } else {
      renderWord(value);
    }
  }

  function announceFinish(msg) {
    finishBanner.textContent = msg.id === myId
      ? `🎉 Bravo, tu termines ${ordinal(msg.rank)} !`
      : `🏁 ${msg.name} termine ${ordinal(msg.rank)} !`;
    finishBanner.classList.remove('hidden');
    setTimeout(() => finishBanner.classList.add('hidden'), 3500);
  }

  // --- Résultats -----------------------------------------------------------------
  function showResults(results) {
    showScreen('results');
    podium.innerHTML = '';
    const finishers = results.filter((r) => r.finished).slice(0, 3);
    const order = [1, 0, 2]; // 2e, 1er, 3e — disposition d'un podium
    for (const idx of order) {
      const r = finishers[idx];
      if (!r) continue;
      const step = document.createElement('div');
      step.className = `step p${idx + 1}`;
      step.innerHTML = `
        <div>${carSVG(r.color, 44)}</div>
        <div class="name">${escapeHTML(r.name)}</div>
        <div class="block">${idx + 1}</div>`;
      podium.appendChild(step);
    }

    const warmup = race.mode === 'echauffement';
    $('th-words').textContent = warmup ? 'Frappes' : 'Mots';
    resultsBody.innerHTML = '';
    results.forEach((r, i) => {
      const tr = document.createElement('tr');
      const rank = r.finished ? ordinal(r.rank) : '—';
      const time = r.time !== null ? `${r.time.toFixed(1)} s` : '—';
      tr.innerHTML = `
        <td>${rank}</td>
        <td class="player-cell">${carSVG(r.color, 30)} ${escapeHTML(r.name)}${r.id === myId ? ' (toi)' : ''}</td>
        <td>${time}</td>
        <td>${r.wpm}</td>
        <td>${warmup ? '—' : r.mistakes}</td>
        <td>${r.wordIndex} / ${r.totalWords}</td>`;
      resultsBody.appendChild(tr);
    });

    if (lobby) {
      const isHost = lobby.hostId === myId;
      btnReplay.classList.toggle('hidden', !isHost);
      replayWait.classList.toggle('hidden', isHost);
    }
  }

  // --- Utilitaires ------------------------------------------------------------------
  function ordinal(n) {
    return n === 1 ? '1er' : `${n}e`;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // --- Événements UI -----------------------------------------------------------------
  $('btn-create').addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) return showError('Choisis un pseudo avant de créer un salon.');
    connect(() => sendMsg({ type: 'create', name }));
  });

  $('btn-join').addEventListener('click', joinLobby);
  inputCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinLobby();
  });

  function joinLobby() {
    const name = inputName.value.trim();
    const code = inputCode.value.trim().toUpperCase();
    if (!name) return showError('Choisis un pseudo avant de rejoindre.');
    if (code.length !== 5) return showError('Le code du salon fait 5 caractères.');
    connect(() => sendMsg({ type: 'join', name, code }));
  }

  selectMode.addEventListener('change', sendOptions);
  selectCount.addEventListener('change', sendOptions);
  selectChars.addEventListener('change', sendOptions);
  function sendOptions() {
    sendMsg({
      type: 'options',
      mode: selectMode.value,
      wordCount: parseInt(selectCount.value, 10),
      charCount: parseInt(selectChars.value, 10)
    });
  }

  btnStart.addEventListener('click', () => sendMsg({ type: 'start' }));
  btnReplay.addEventListener('click', () => sendMsg({ type: 'replay' }));
  btnEndRace.addEventListener('click', () => sendMsg({ type: 'end_race' }));
  inputTyping.addEventListener('input', onTyping);

  function leave() {
    sendMsg({ type: 'leave' });
    if (ws) ws.close();
    ws = null;
    myId = null;
    lobby = null;
    showScreen('home');
  }
  $('btn-leave-lobby').addEventListener('click', leave);
  $('btn-leave-results').addEventListener('click', leave);
})();
