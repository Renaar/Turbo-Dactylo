// Logique client du jeu de course de dactylographie.

(() => {
  'use strict';

  // --- État ----------------------------------------------------------------
  let ws = null;
  let myId = null;
  let lobby = null; // dernier état "lobby" reçu du serveur
  let race = {
    mode: 'mots',
    teams: null,   // composition des équipes, ou null (chacun pour soi)
    myTeam: null,
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
    results: $('screen-results'),
    leaderboard: $('screen-leaderboard')
  };

  const inputName = $('input-name');
  const inputCode = $('input-code');
  const inputClasse = $('input-classe');
  const homeError = $('home-error');
  const lobbyError = $('lobby-error');
  const lobbyCodeEl = $('lobby-code');
  const playerList = $('player-list');
  const hostOptions = $('host-options');
  const guestOptions = $('guest-options');
  const selectMode = $('select-mode');
  const selectCount = $('select-count');
  const selectChars = $('select-chars');
  const selectTeams = $('select-teams');
  const optWords = $('opt-words');
  const optChars = $('opt-chars');
  const raceTeam = $('race-team');
  const countdownTeam = $('countdown-team');
  const teamResults = $('team-results');
  const btnStart = $('btn-start');
  const waitingMsg = $('waiting-msg');
  const trackEl = $('track');
  const wordDisplay = $('word-display');
  const inputTyping = $('input-typing');
  const raceProgress = $('race-progress');
  const raceWpm = $('race-wpm');
  const raceChrono = $('race-chrono');
  const selectSoloCount = $('select-solo-count');
  const selectSoloCount2 = $('select-solo-count-2');
  const soloAgain = $('solo-again');
  const soloRecord = $('solo-record');
  const resultsTitle = $('results-title');
  let chronoTimer = null;
  let chronoStart = 0;
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
    // En course, la page tient dans l'écran (voir body.race-mode)
    document.body.classList.toggle('race-mode', name === 'race');
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
      stopChrono();
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

      case 'lobby_error':
        lobbyError.textContent = msg.message;
        lobbyError.classList.remove('hidden');
        setTimeout(() => lobbyError.classList.add('hidden'), 4000);
        break;

      case 'welcome':
        myId = msg.playerId;
        homeError.classList.add('hidden');
        break;

      case 'lobby':
        lobby = msg;
        renderLobby();
        // En solo il n'y a pas de salle d'attente : la course enchaîne seule
        if (msg.solo) break;
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
        race.teams = msg.teams || null;
        race.myTeam = race.teams
          ? race.teams.find((t) => t.members.some((m) => m.id === myId)) || null
          : null;
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
        layoutTrack();
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = msg.n;
        // Chacun découvre son équipe pendant le décompte
        countdownTeam.classList.toggle('hidden', !race.myTeam);
        if (race.myTeam) {
          countdownTeam.style.color = race.myTeam.color;
          countdownTeam.textContent = race.spectator
            ? `${race.teams.length} équipes tirées au sort !`
            : `${race.myTeam.emoji} Tu cours pour les ${race.myTeam.name} : `
              + race.myTeam.members.map((m) => m.name).join(', ');
        }
        break;

      case 'go':
        showScreen('race');
        countdownOverlay.classList.add('hidden');
        layoutTrack();
        if (lobby && lobby.solo) startChrono();
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
        updateTrack(msg.players, msg.teams);
        break;

      case 'player_finished':
        announceFinish(msg);
        break;

      case 'team_finished':
        finishBanner.textContent = race.myTeam && race.myTeam.index === msg.index
          ? `🎉 Ton équipe, les ${msg.name}, termine ${ordinal(msg.rank)} !`
          : `${msg.emoji} Les ${msg.name} terminent ${ordinal(msg.rank)} !`;
        finishBanner.classList.remove('hidden');
        setTimeout(() => finishBanner.classList.add('hidden'), 3500);
        break;

      case 'results':
        showResults(msg.results, msg.teams);
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
      selectTeams.value = String(opts.teams || 0);
      optWords.classList.toggle('hidden', opts.mode === 'echauffement');
      optChars.classList.toggle('hidden', opts.mode !== 'echauffement');
    } else {
      const format = opts.mode === 'echauffement'
        ? `🔥 Échauffement · ${opts.charCount} frappes`
        : `🏁 Course de ${opts.wordCount} mots`;
      guestOptions.textContent = opts.teams >= 2
        ? `${format} · 🤝 ${opts.teams} équipes tirées au sort`
        : format;
    }

    btnStart.classList.toggle('hidden', !isHost);
    btnStart.disabled = lobby.players.length < 2;
    btnStart.title = lobby.players.length < 2
      ? 'Attends qu\'au moins un joueur rejoigne le salon' : '';
    waitingMsg.classList.toggle('hidden', isHost);
    btnReplay.classList.toggle('hidden', !isHost);
    replayWait.classList.toggle('hidden', isHost);
    // En solo, pas de bouton « terminer pour tout le monde »
    btnEndRace.classList.toggle('hidden', !isHost || lobby.solo);

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
        badge.textContent = '⭐ organise';
        li.appendChild(badge);
      }
      if (p.spectator && p.id !== lobby.hostId) {
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
    const isHost = lobby && lobby.hostId === myId;
    // Organisateur et spectateurs : la piste occupe tout l'écran
    screens.race.classList.toggle('spectating', race.spectator);
    // L'organisateur a son bouton dans le coin ; seul le spectateur
    // retardataire a besoin d'une explication.
    spectatorMsg.classList.toggle('hidden', !race.spectator || isHost);
    stopChrono();
    raceChrono.classList.toggle('hidden', !(lobby && lobby.solo));
    raceChrono.textContent = '0.0 s';
    // Rappel permanent de son équipe pendant la course
    raceTeam.classList.toggle('hidden', !race.myTeam || race.spectator);
    if (race.myTeam) {
      raceTeam.textContent = `${race.myTeam.emoji} ${race.myTeam.name}`;
      raceTeam.style.color = race.myTeam.color;
    }
    // Immersion : la pelouse prend la couleur de l'équipe du joueur
    // (l'organisateur et les spectateurs gardent la pelouse verte)
    paintLawn(race.myTeam);
    wordDisplay.innerHTML = race.spectator ? '' : '…';
    raceProgress.textContent = race.mode === 'echauffement'
      ? `0 / ${race.target} frappes`
      : `Mot 0 / ${race.words.length}`;
    raceWpm.textContent = '0 MPM';
    buildTrack();
  }

  /**
   * Teinte de pelouse dérivée d'une couleur d'équipe : on l'assombrit vers
   * un gris foncé pour garder l'aspect d'un gazon tondu plutôt qu'un aplat
   * criard. Les deux bandes ne diffèrent que légèrement, comme la pelouse
   * verte d'origine.
   */
  function lawnShade(hex, ratio) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(c * ratio + 0x1a * (1 - ratio));
    return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
  }

  function paintLawn(team) {
    if (team) {
      trackEl.style.setProperty('--lawn-a', lawnShade(team.color, 0.62));
      trackEl.style.setProperty('--lawn-b', lawnShade(team.color, 0.57));
    } else {
      trackEl.style.removeProperty('--lawn-a');
      trackEl.style.removeProperty('--lawn-b');
    }
  }

  // --- Chronomètre (course solo contre la montre) -------------------------
  function startChrono() {
    stopChrono();
    chronoStart = Date.now();
    raceChrono.classList.remove('hidden');
    raceChrono.textContent = '0.0 s';
    chronoTimer = setInterval(() => {
      raceChrono.textContent = `${((Date.now() - chronoStart) / 1000).toFixed(1)} s`;
    }, 100);
  }

  function stopChrono() {
    if (chronoTimer) clearInterval(chronoTimer);
    chronoTimer = null;
  }

  function renderWarmup() {
    wordDisplay.innerHTML =
      '<span class="warmup">🔥 Tape n’importe quoi,<br>le plus vite possible !</span>';
    raceProgress.textContent = `${race.typed} / ${race.target} frappes`;
  }

  function buildTrack() {
    trackEl.innerHTML = '';
    if (!lobby) return;

    // En mode équipe, une piste par équipe : la voiture avance à la
    // progression moyenne de ses membres.
    if (race.teams) {
      for (const t of race.teams) {
        const mine = race.myTeam && race.myTeam.index === t.index;
        const lane = document.createElement('div');
        lane.className = 'lane';
        lane.dataset.teamIndex = t.index;
        lane.innerHTML = `
          <span class="lane-name">${t.emoji} ${escapeHTML(t.name)}${mine ? '<br><span class="lane-you">⬅ toi</span>' : ''}</span>
          <span class="lane-wpm"></span>
          <span class="lane-members">${t.members.map((m) => escapeHTML(m.name)).join(' · ')}</span>
          <div class="start-line"></div>
          <div class="finish-line"></div>
          <div class="car">${carSVG(t.color)}</div>`;
        trackEl.appendChild(lane);
      }
      layoutTrack();
      return;
    }

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
    layoutTrack();
  }

  /**
   * Ajuste la hauteur des couloirs pour que tous les joueurs tiennent à
   * l'écran, sans jamais descendre sous une taille lisible.
   */
  function layoutTrack() {
    const lanes = trackEl.querySelectorAll('.lane');
    if (!lanes.length || !screens.race.classList.contains('active')) return;
    const screenStyle = getComputedStyle(screens.race);
    const trackStyle = getComputedStyle(trackEl);
    let avail = screens.race.getBoundingClientRect().height
      - parseFloat(screenStyle.paddingTop) - parseFloat(screenStyle.paddingBottom)
      - parseFloat(trackStyle.paddingTop) - parseFloat(trackStyle.paddingBottom);
    const zone = document.querySelector('.typing-zone');
    if (zone.offsetParent) avail -= zone.getBoundingClientRect().height + 18;

    // Peu de couloirs en mode équipe : on peut les faire plus grands
    const maxLane = race.teams ? 140 : 52;
    const maxCar = race.teams ? 86 : 46;
    const laneH = Math.max(28, Math.min(maxLane, Math.floor(avail / lanes.length)));
    trackEl.style.setProperty('--lane-h', `${laneH}px`);
    trackEl.style.setProperty('--car-w',
      `${Math.round(Math.max(26, Math.min(maxCar, laneH * 0.85)))}px`);
    trackEl.classList.toggle('compact', laneH < 42);

    // Si la piste déborde malgré tout, le joueur doit au moins voir sa
    // propre voiture : on la recentre dans la piste.
    if (!race.spectator && myId !== null) {
      const mine = trackEl.querySelector(race.teams && race.myTeam
        ? `.lane[data-team-index="${race.myTeam.index}"]`
        : `.lane[data-player-id="${myId}"]`);
      if (mine) {
        const laneBox = mine.getBoundingClientRect();
        const trackBox = trackEl.getBoundingClientRect();
        trackEl.scrollTop += (laneBox.top - trackBox.top)
          - (trackBox.height - laneBox.height) / 2;
      }
    }
  }

  window.addEventListener('resize', layoutTrack);

  function updateTrack(players, teams) {
    // Ma vitesse personnelle reste affichée dans tous les modes
    const me = players.find((p) => p.id === myId);
    if (me) raceWpm.textContent = `${me.wpm} MPM`;

    if (teams) {
      for (const t of teams) {
        const lane = trackEl.querySelector(`.lane[data-team-index="${t.index}"]`);
        if (!lane) continue;
        const car = lane.querySelector('.car');
        car.style.left = `${2 + t.progress * 86}%`;
        car.classList.toggle('finished', t.finishedCount === t.total);
        lane.querySelector('.lane-wpm').textContent = t.rank
          ? `🏁 ${ordinal(t.rank)}`
          : `${Math.round(t.progress * 100)} %`;
      }
      return;
    }

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
        stopChrono();
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
        stopChrono();
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
  function showResults(results, teams) {
    showScreen('results');
    stopChrono();
    const solo = !!(lobby && lobby.solo);
    resultsTitle.textContent = solo
      ? '⏱️ Ta course solo'
      : (teams ? '🤝 Résultats par équipes' : '🏆 Résultats de la course');
    renderTeamResults(teams);
    soloAgain.classList.toggle('hidden', !solo);
    // En équipe, le classement des équipes tient lieu de podium
    podium.classList.toggle('hidden', solo || !!teams);
    btnReplay.textContent = solo ? '🔄 Nouvelle course' : '🔄 Rejouer';
    $('btn-leave-results').textContent = solo ? "Retour à l'accueil" : 'Quitter le salon';
    if (solo) showSoloRecord(results.find((r) => r.id === myId));
    else soloRecord.classList.add('hidden');

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
      // En équipe, on rappelle la couleur de l'équipe de chacun
      const equipe = teams && r.team !== null && race.teams
        ? (race.teams.find((t) => t.index === r.team)?.emoji || '') + ' ' : '';
      tr.innerHTML = `
        <td>${rank}</td>
        <td class="player-cell">${carSVG(r.color, 30)} ${equipe}${escapeHTML(r.name)}${r.id === myId ? ' (toi)' : ''}</td>
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

  /** Classement des équipes, en tête des résultats. */
  function renderTeamResults(teams) {
    teamResults.classList.toggle('hidden', !teams);
    teamResults.innerHTML = '';
    if (!teams) return;
    const medals = ['🥇', '🥈', '🥉', '4e'];
    teams.forEach((t, i) => {
      const mine = race.myTeam && race.myTeam.index === t.index;
      const card = document.createElement('div');
      card.className = 'team-card' + (mine ? ' mine' : '');
      card.style.borderColor = t.color;
      card.innerHTML = `
        <div class="team-rank">${medals[i] || i + 1}</div>
        <div class="team-car">${carSVG(t.color, 54)}</div>
        <div class="team-name" style="color:${t.color}">${t.emoji} ${escapeHTML(t.name)}</div>
        <div class="team-detail">${Math.round(t.progress * 100)} % · ${t.wpm} MPM</div>
        <div class="team-detail">${t.finishedCount}/${t.total} arrivés</div>`;
      teamResults.appendChild(card);
    });
  }

  /**
   * Record personnel de l'entraînement solo, gardé dans le navigateur
   * (par pseudo, pour que plusieurs élèves puissent partager un poste).
   */
  function showSoloRecord(me) {
    soloRecord.classList.remove('hidden');
    if (!me || !me.finished) {
      soloRecord.textContent = 'Course interrompue — réessaie quand tu veux !';
      return;
    }
    const key = `turbo-record-${inputName.value.trim().toLowerCase()}`;
    let best = 0;
    try { best = parseInt(localStorage.getItem(key), 10) || 0; } catch { /* ignore */ }

    if (me.wpm > best) {
      soloRecord.textContent = best
        ? `🏅 Nouveau record personnel : ${me.wpm} MPM (ancien : ${best} MPM)`
        : `🏅 Premier résultat enregistré : ${me.wpm} MPM. À toi de le battre !`;
      soloRecord.classList.add('record');
      try { localStorage.setItem(key, String(me.wpm)); } catch { /* ignore */ }
    } else {
      soloRecord.classList.remove('record');
      const manque = best - me.wpm;
      soloRecord.textContent =
        `Ton record : ${best} MPM · cette course : ${me.wpm} MPM (${manque} de moins)`;
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
  // Le pseudo est mémorisé sur l'appareil pour garder des statistiques cohérentes
  try {
    inputName.value = localStorage.getItem('turbo-pseudo') || '';
    inputClasse.value = localStorage.getItem('turbo-classe') || '';
    const soloCount = localStorage.getItem('turbo-solo-count');
    if (soloCount && [...selectSoloCount.options].some((o) => o.value === soloCount)) {
      selectSoloCount.value = soloCount;
      selectSoloCount2.value = soloCount;
    }
  } catch { /* stockage local indisponible : tant pis */ }

  function rememberMe(name) {
    try {
      localStorage.setItem('turbo-pseudo', name);
      localStorage.setItem('turbo-classe', inputClasse.value.trim());
      localStorage.setItem('turbo-solo-count', selectSoloCount.value);
    } catch { /* ignore */ }
  }

  $('btn-create').addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) return showError('Choisis un pseudo avant de créer un salon.');
    rememberMe(name);
    const classe = inputClasse.value.trim();
    connect(() => sendMsg({ type: 'create', name, classe }));
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
    rememberMe(name);
    connect(() => sendMsg({ type: 'join', name, code }));
  }

  // --- Entraînement solo ---------------------------------------------------
  $('btn-solo').addEventListener('click', startSolo);
  function startSolo() {
    const name = inputName.value.trim();
    if (!name) return showError('Choisis un pseudo avant de t\'entraîner.');
    rememberMe(name);
    const wordCount = parseInt(selectSoloCount.value, 10);
    selectSoloCount2.value = String(wordCount);
    connect(() => sendMsg({ type: 'solo', name, wordCount }));
  }

  selectMode.addEventListener('change', sendOptions);
  selectCount.addEventListener('change', sendOptions);
  selectChars.addEventListener('change', sendOptions);
  selectTeams.addEventListener('change', sendOptions);
  function sendOptions() {
    sendMsg({
      type: 'options',
      mode: selectMode.value,
      wordCount: parseInt(selectCount.value, 10),
      charCount: parseInt(selectChars.value, 10),
      teams: parseInt(selectTeams.value, 10)
    });
  }

  btnStart.addEventListener('click', () => sendMsg({ type: 'start' }));
  btnReplay.addEventListener('click', () => {
    const wordCount = parseInt(selectSoloCount2.value, 10);
    if (lobby && lobby.solo) {
      selectSoloCount.value = String(wordCount);
      try { localStorage.setItem('turbo-solo-count', String(wordCount)); } catch { /* ignore */ }
    }
    sendMsg({ type: 'replay', wordCount });
  });
  btnEndRace.addEventListener('click', () => sendMsg({ type: 'end_race' }));
  inputTyping.addEventListener('input', onTyping);

  function leave() {
    stopChrono();
    sendMsg({ type: 'leave' });
    if (ws) ws.close();
    ws = null;
    myId = null;
    lobby = null;
    showScreen('home');
  }
  $('btn-leave-lobby').addEventListener('click', leave);
  $('btn-leave-results').addEventListener('click', leave);

  // --- Classements -------------------------------------------------------------------
  const lbMode = $('lb-mode');
  const lbPeriode = $('lb-periode');
  const lbClasse = $('lb-classe');
  const lbPlayer = $('lb-player');
  let moderationPin = null;

  async function loadLeaderboard() {
    // Le solo ignore le filtre de classe (ces courses n'en ont pas)
    if (lbMode.value === 'solo') lbClasse.value = '';
    const params = new URLSearchParams({
      mode: lbMode.value,
      jours: lbPeriode.value,
      classe: lbClasse.value
    });
    let data;
    try {
      data = await (await fetch(`/api/classements?${params}`)).json();
    } catch {
      $('lb-empty').classList.remove('hidden');
      return;
    }

    // L'entraînement solo n'est rattaché à aucune classe
    const solo = lbMode.value === 'solo';
    lbClasse.disabled = solo;
    lbClasse.title = solo ? 'Les entraînements solo ne sont pas liés à une classe' : '';
    document.querySelector('.leaderboard-box').classList.toggle('solo-view', solo);
    const intro = $('lb-intro');
    intro.classList.toggle('hidden', !solo);
    intro.textContent = solo
      ? '⏱️ Courses d\'entraînement faites en solo — un classement à part, pour le plaisir de progresser.'
      : '';

    // Filtre des classes (on préserve la sélection actuelle)
    const current = lbClasse.value;
    lbClasse.innerHTML = '<option value="">Toutes les classes</option>';
    for (const c of data.classes) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      lbClasse.appendChild(opt);
    }
    lbClasse.value = data.classes.includes(current) ? current : '';

    $('lb-empty').classList.toggle('hidden', data.top.length > 0);

    const medals = ['🥇', '🥈', '🥉'];
    const topBody = $('lb-top');
    topBody.innerHTML = '';
    data.top.forEach((r, i) => {
      const tr = document.createElement('tr');
      const date = new Date(r.ts).toLocaleDateString('fr-CH');
      tr.innerHTML = `
        <td>${medals[i] || i + 1}</td>
        <td><button class="lb-pseudo" data-pseudo="${escapeHTML(r.pseudo)}">${escapeHTML(r.pseudo)}</button></td>
        <td>${escapeHTML(r.classe || '—')}</td>
        <td><strong>${r.wpm}</strong></td>
        <td>${date}${moderationPin ? `
          <button class="kick-btn lb-delete" data-id="${r.id}"
            data-pseudo="${escapeHTML(r.pseudo)}" title="Supprimer ce résultat">✖</button>
          <button class="kick-btn lb-delete-all" data-pseudo="${escapeHTML(r.pseudo)}"
            title="Supprimer toutes les courses de ce pseudo">🗑</button>` : ''}</td>`;
      topBody.appendChild(tr);
    });

    const assBody = $('lb-assidus');
    assBody.innerHTML = '';
    data.assidus.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${medals[i] || i + 1}</td>
        <td><button class="lb-pseudo" data-pseudo="${escapeHTML(r.pseudo)}">${escapeHTML(r.pseudo)}</button></td>
        <td>${escapeHTML(r.classe || '—')}</td>
        <td>${r.count}</td>`;
      assBody.appendChild(tr);
    });

    for (const btn of document.querySelectorAll('.lb-pseudo')) {
      btn.addEventListener('click', () => showPlayerStats(btn.dataset.pseudo));
    }
    for (const btn of document.querySelectorAll('.lb-delete')) {
      btn.addEventListener('click', () => moderer(
        { id: btn.dataset.id },
        `Supprimer ce résultat de ${btn.dataset.pseudo} du classement ?`
      ));
    }
    for (const btn of document.querySelectorAll('.lb-delete-all')) {
      btn.addEventListener('click', () => moderer(
        { pseudo: btn.dataset.pseudo },
        `Supprimer TOUTES les courses de « ${btn.dataset.pseudo} » (tous les classements) ?`
      ));
    }
  }

  /** Supprime une entrée (ou toutes celles d'un pseudo), avec confirmation. */
  async function moderer(cible, question) {
    if (!confirm(question)) return;
    const resp = await fetch('/api/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: moderationPin, ...cible })
    });
    if (resp.status === 403) {
      moderationPin = null;
      alert('PIN incorrect.');
    }
    loadLeaderboard();
  }

  async function showPlayerStats(pseudo) {
    const params = new URLSearchParams({ pseudo, mode: lbMode.value });
    const resp = await fetch(`/api/joueur?${params}`);
    if (!resp.ok) return;
    const s = await resp.json();
    $('lb-player-title').textContent = `📊 Statistiques de ${s.pseudo}`;
    $('lb-player-summary').textContent =
      `Record : ${s.best.wpm} MPM · Moyenne (10 dernières) : ${s.avg} MPM · ${s.count} course${s.count > 1 ? 's' : ''} jouée${s.count > 1 ? 's' : ''}`;
    const body = $('lb-player-races');
    body.innerHTML = '';
    for (const r of s.dernieres) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.ts).toLocaleDateString('fr-CH')}</td>
        <td><strong>${r.wpm}</strong></td>
        <td>${lbMode.value === 'echauffement' ? '—' : r.mistakes}</td>
        <td>${escapeHTML(r.classe || '—')}</td>`;
      body.appendChild(tr);
    }
    lbPlayer.classList.remove('hidden');
    lbPlayer.scrollIntoView({ behavior: 'smooth' });
  }

  function openLeaderboard() {
    lbPlayer.classList.add('hidden');
    showScreen('leaderboard');
    loadLeaderboard();
  }

  $('btn-leaderboard').addEventListener('click', openLeaderboard);
  $('btn-lb-back').addEventListener('click', () => showScreen('home'));
  lbMode.addEventListener('change', loadLeaderboard);
  lbPeriode.addEventListener('change', loadLeaderboard);
  lbClasse.addEventListener('change', loadLeaderboard);
  $('btn-lb-moderation').addEventListener('click', () => {
    moderationPin = prompt('PIN de modération :');
    loadLeaderboard();
  });
})();
