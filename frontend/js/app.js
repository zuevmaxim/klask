/* ===============================
   CONFIG
================================ */

const API_URL = 'http://localhost:3000';

/* ===============================
   STATE
================================ */

const players = [];
const championship = {
    championId: null,
    challengerId: null,
    winsInRow: 0
};

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

    render();
    renderScoreCircles();
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
            championship
        })
    }).catch(err => {
        console.error('Failed to save state', err);
    });
}

/* ===============================
   PLAYERS
================================ */

function addPlayer() {
    const input = document.getElementById('playerName');
    const name = input.value.trim();
    if (!name) return;

    players.push({
        id: Date.now(),
        name,
        wins: 0,
        losses: 0
    });

    input.value = '';
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

function addMatch() {
    if (players.length < 2) return;
    if (score1 === null || score2 === null) return;
    if (score1 === score2) return;

    const p1Id = +document.getElementById('p1').value;
    const p2Id = +document.getElementById('p2').value;
    if (p1Id === p2Id) return;

    const winnerId = score1 > score2 ? p1Id : p2Id;
    const loserId = score1 > score2 ? p2Id : p1Id;

    players.find(p => p.id === winnerId).wins++;
    players.find(p => p.id === loserId).losses++;

    // Championship logic
    if (!championship.championId) {
        championship.championId = winnerId;
    } else if (championship.championId === loserId) {
        if (championship.challengerId === winnerId) {
            championship.winsInRow++;
        } else {
            championship.challengerId = winnerId;
            championship.winsInRow = 1;
        }

        if (championship.winsInRow === 2) {
            championship.championId = winnerId;
            championship.challengerId = null;
            championship.winsInRow = 0;
        }
    } else if (championship.championId === winnerId) {
        championship.challengerId = null;
        championship.winsInRow = 0;
    }

    score1 = null;
    score2 = null;
    renderScoreCircles();

    saveState();
    render();
}

/* ===============================
   RENDER
================================ */

function render() {
    const p1 = document.getElementById('p1');
    const p2 = document.getElementById('p2');

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

    document.getElementById('stats').innerHTML = players
        .map(p => `<li>${p.name}: ${p.wins}W / ${p.losses}L</li>`)
        .join('');

    const champ = players.find(p => p.id === championship.championId);
    document.getElementById('champion').innerText =
        champ ? champ.name : 'No champion';
}

/* ===============================
   START
================================ */

loadState();
