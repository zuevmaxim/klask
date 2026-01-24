/* ===============================
   CONFIG
================================ */

const API_URL = location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

/* ===============================
   STATE
================================ */

const players = [];
const championship = {
    championId: null,
    challengerId: null,
    winsInRow: 0,
    lastWinDate: null
};
const games = [];

let score1 = null;
let score2 = null;

/* ===============================
   API
================================ */

async function loadState() {
    const res = await fetch(`${API_URL}/state`, {
        method: 'GET',
        credentials: 'include' // allow browser to handle auth cookies / prompts
    });
    if (!res.ok) {
        console.error('Failed to load state');
        return;
    }

    const data = await res.json();

    players.length = 0;
    players.push(...data.players);

    championship.championId = data.championship.championId;
    championship.challengerId = data.championship.challengerId;
    championship.winsInRow = data.championship.winsInRow;
    championship.lastWinDate = data.championship.lastWinDate;

    games.length = 0;
    if (data.games) {
        games.push(...data.games);
    }

    render();
    renderScoreCircles();
    renderGameHistory();
}

function saveState() {
    fetch(`${API_URL}/state`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            players,
            championship,
            games
        })
    }).catch(err => {
        console.error('Failed to save state', err);
    });
}

/* ===============================
   PLAYERS
================================ */

function toggleAddPlayer() {
    const form = document.getElementById('addPlayerForm');
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        document.getElementById('playerName').focus();
    }
}

function addPlayer() {
    const input = document.getElementById('playerName');
    const name = input.value.trim();
    if (!name) return;

    players.push({
        id: Date.now(),
        name
    });

    input.value = '';
    document.getElementById('addPlayerForm').style.display = 'none';
    saveState();
    render();
}

/* ===============================
   SCORE CIRCLES
================================ */

function renderScoreCircles() {
    const s1 = document.getElementById('score1');
    const s2 = document.getElementById('score2');

    s1.innerHTML = '';
    s2.innerHTML = '';

    for (let i = 0; i <= 6; i++) {
        const c1 = createScoreCircle(i, 1);
        const c2 = createScoreCircle(i, 2);

        s1.appendChild(c1);
        s2.appendChild(c2);
    }
}

function createScoreCircle(value, player) {
    const el = document.createElement('div');
    el.className = 'score-circle';
    el.innerText = value;

    el.onclick = () => {
        if (player === 1) {
            score1 = value;
            updateActive('score1', value);
        } else {
            score2 = value;
            updateActive('score2', value);
        }
    };

    return el;
}

function updateActive(containerId, value) {
    const container = document.getElementById(containerId);
    [...container.children].forEach((el, idx) => {
        el.classList.toggle('active', idx === value);
    });
}

/* ===============================
   MATCH / CHAMPIONSHIP
================================ */

function handlePlayerSelect(changedPlayer) {
    if (players.length < 2) return;

    const p1 = document.getElementById('p1');
    const p2 = document.getElementById('p2');
    const p1Id = +p1.value;
    const p2Id = +p2.value;

    // If both players are the same, switch the other player
    if (p1Id === p2Id) {
        const otherSelect = changedPlayer === 1 ? p2 : p1;
        const selectedId = changedPlayer === 1 ? p1Id : p2Id;

        // Find a different player
        const otherPlayer = players.find(p => p.id !== selectedId);
        if (otherPlayer) {
            otherSelect.value = otherPlayer.id;
        }
    }
}

function addMatch() {
    if (players.length < 2) return;
    if (score1 === null || score2 === null) return;

    const p1Id = +document.getElementById('p1').value;
    const p2Id = +document.getElementById('p2').value;

    if (p1Id === p2Id) {
        alert('A player cannot play against themselves');
        return;
    }

    if (score1 !== 6 && score2 !== 6) {
        alert('One player must have 6 points');
        return;
    }

    if (score1 === score2) {
        alert('Scores cannot be equal');
        return;
    }

    const winnerId = score1 > score2 ? p1Id : p2Id;
    const loserId = score1 > score2 ? p2Id : p1Id;

    // Save game to history
    games.push({
        date: new Date().toISOString(),
        player1Id: p1Id,
        player2Id: p2Id,
        score1: score1,
        score2: score2
    });

    // Championship logic
    const today = new Date().toDateString();

    if (!championship.championId) {
        championship.championId = winnerId;
    } else if (championship.championId === loserId) {
        const isSameDay = championship.lastWinDate === today;

        if (championship.challengerId === winnerId && isSameDay) {
            championship.winsInRow++;
        } else {
            championship.challengerId = winnerId;
            championship.winsInRow = 1;
            championship.lastWinDate = today;
        }

        if (championship.winsInRow === 2) {
            championship.championId = winnerId;
            championship.challengerId = null;
            championship.winsInRow = 0;
            championship.lastWinDate = null;
        }
    } else if (championship.championId === winnerId) {
        championship.challengerId = null;
        championship.winsInRow = 0;
        championship.lastWinDate = null;
    }

    score1 = null;
    score2 = null;
    renderScoreCircles();

    saveState();
    render();
    renderGameHistory();
}

/* ===============================
   RENDER
================================ */

function renderGameHistory() {
    const historyEl = document.getElementById('gameHistory');
    if (!historyEl) return;

    if (games.length === 0) {
        historyEl.innerHTML = '<p>No games played yet</p>';
        return;
    }

    // Show games in reverse order (most recent first)
    const historyHTML = games
        .slice()
        .reverse()
        .map(game => {
            const p1 = players.find(p => p.id === game.player1Id);
            const p2 = players.find(p => p.id === game.player2Id);
            const date = new Date(game.date);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const p1Name = p1 ? p1.name : 'Unknown';
            const p2Name = p2 ? p2.name : 'Unknown';

            // Show winner first
            const winnerName = game.score1 > game.score2 ? p1Name : p2Name;
            const loserName = game.score1 > game.score2 ? p2Name : p1Name;
            const winnerScore = Math.max(game.score1, game.score2);
            const loserScore = Math.min(game.score1, game.score2);

            return `<li>${dateStr} ${timeStr} - ${winnerName} ${winnerScore}:${loserScore} ${loserName}</li>`;
        })
        .join('');

    historyEl.innerHTML = `<ul>${historyHTML}</ul>`;
}

function render() {
    const p1 = document.getElementById('p1');
    const p2 = document.getElementById('p2');

    const currentP1 = p1.value;
    const currentP2 = p2.value;

    p1.innerHTML = '';
    p2.innerHTML = '';

    players.forEach(p => {
        const opt1 = document.createElement('option');
        opt1.value = p.id;
        opt1.innerText = p.name;

        const opt2 = opt1.cloneNode(true);

        p1.appendChild(opt1);
        p2.appendChild(opt2);
    });

    // Set initial players to be different
    if (players.length >= 2) {
        if (currentP1) {
            p1.value = currentP1;
        } else {
            p1.value = players[0].id;
        }

        if (currentP2) {
            p2.value = currentP2;
        } else {
            p2.value = players[1].id;
        }
    }

    // Calculate stats from game history
    const stats = {};
    players.forEach(p => {
        stats[p.id] = { name: p.name, wins: 0, losses: 0 };
    });

    games.forEach(game => {
        const winnerId = game.score1 > game.score2 ? game.player1Id : game.player2Id;
        const loserId = game.score1 > game.score2 ? game.player2Id : game.player1Id;

        if (stats[winnerId]) stats[winnerId].wins++;
        if (stats[loserId]) stats[loserId].losses++;
    });

    document.getElementById('stats').innerHTML = Object.values(stats)
        .map(s => `<li>${s.name}: ${s.wins}W / ${s.losses}L</li>`)
        .join('');

    const champ = players.find(p => p.id === championship.championId);
    document.getElementById('champion').innerText =
        champ ? champ.name : 'No champion';
}

/* ===============================
   START
================================ */

loadState();
