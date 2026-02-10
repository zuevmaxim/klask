/* ===============================
   CONFIG
================================ */

const API_URL = location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

/* ===============================
   UI STATE
================================ */

let score1 = null;
let score2 = null;

/* ===============================
   API
================================ */

const TOKEN_KEY = 'klask_auth_token';

function getAuthHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

async function handleAuthResponse(res) {
    if (res.status === 401) {
        // Token expired or invalid, clear it and prompt login
        localStorage.removeItem(TOKEN_KEY);
        await promptLogin();
        return null;
    }
    return res;
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.add('fade-out');

    // Remove from DOM after fade animation completes
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 1000); // Match the CSS transition duration
}

function showLoginScreen() {
    hideLoadingScreen();
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    hideLoadingScreen();
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    errorEl.textContent = '';

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem(TOKEN_KEY, data.token);
            showMainApp();
            await loadState();
        } else {
            errorEl.textContent = 'Invalid credentials';
        }
    } catch (err) {
        console.error('Login failed', err);
        errorEl.textContent = 'Login failed. Please try again.';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem(TOKEN_KEY);
        location.reload();
    }
}

async function promptLogin() {
    showLoginScreen();
}

async function loadState() {
    const res = await fetch(`${API_URL}/state`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
    });

    const handledRes = await handleAuthResponse(res);
    if (!handledRes) return;

    if (!handledRes.ok) {
        console.error('Failed to load state');
        return;
    }

    const data = await handledRes.json();
    loadStateFromData(data);

    render();
    renderScoreCircles();
    renderGameHistory();
}

function showNotification(message, type = 'error') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function saveState(cause) {
    const stateWithCause = {
        ...getStateForSave(),
        cause
    };

    fetch(`${API_URL}/state`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(stateWithCause)
    }).catch(err => {
        console.error('Failed to save state', err);
        showNotification('Failed to save. Please check your connection.');
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

    addPlayerToState(name);

    input.value = '';
    document.getElementById('addPlayerForm').style.display = 'none';
    saveState('New player');
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

            // If score is less than 6, set other player's score to 6
            if (value < 6 && score2 !== 6) {
                score2 = 6;
                updateActive('score2', 6);
            }
        } else {
            score2 = value;
            updateActive('score2', value);

            // If score is less than 6, set other player's score to 6
            if (value < 6 && score1 !== 6) {
                score1 = 6;
                updateActive('score1', 6);
            }
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

    processMatchResult(p1Id, p2Id, score1, score2);

    score1 = null;
    score2 = null;
    renderScoreCircles();

    saveState('New game');
    render();
    renderGameHistory();
}

/* ===============================
   CHAMPIONSHIP
================================ */

function toggleChangeChampion() {
    const form = document.getElementById('changeChampionForm');
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        renderChampionSelect();
    }
}

function renderChampionSelect() {
    const select = document.getElementById('newChampion');
    select.innerHTML = '<option value="">No champion</option>';

    players.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.innerText = p.name;
        select.appendChild(opt);
    });

    if (championship.championId) {
        select.value = championship.championId;
    }
}

function changeChampion() {
    const newChampionId = document.getElementById('newChampion').value;
    const newId = newChampionId ? +newChampionId : null;

    setChampion(newId);

    document.getElementById('changeChampionForm').style.display = 'none';
    saveState('New champion');
    render();
    renderGameHistory();
}

/* ===============================
   RENDER
================================ */

function removeHistoryEvent(type, index) {
    let eventDescription;

    if (type === 'game') {
        const game = games[index];
        const p1 = players.find(p => p.id === game.player1Id);
        const p2 = players.find(p => p.id === game.player2Id);
        const p1Name = p1 ? p1.name : 'Unknown';
        const p2Name = p2 ? p2.name : 'Unknown';
        eventDescription = `${p1Name} ${game.score1}:${game.score2} ${p2Name}`;
    } else {
        const event = championshipHistory[index];
        const newChamp = players.find(p => p.id === event.newChampionId);
        const newName = newChamp ? newChamp.name : 'None';
        eventDescription = `${newName} became champion`;
    }

    if (!confirm(`Remove this event?\n${eventDescription}`)) {
        return;
    }

    if (type === 'game') {
        removeGameFromHistory(index);
    } else {
        removeChampionshipEventFromHistory(index);
    }

    saveState('Remove history event');
    render();
    renderGameHistory();
}

function renderGameHistory() {
    const historyEl = document.getElementById('gameHistory');
    if (!historyEl) return;

    // Combine games and championship events with their original indices
    const allEvents = [
        ...championshipHistory.map((e, idx) => ({...e, type: 'championship', originalIndex: idx})),
        ...games.map((g, idx) => ({...g, type: 'game', originalIndex: idx})),
    ];

    if (allEvents.length === 0) {
        historyEl.innerHTML = '<p>No games played yet</p>';
        return;
    }

    // Sort by date (most recent first)
    allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    const historyHTML = allEvents.map(event => {
        const date = new Date(event.date);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

        if (event.type === 'game') {
            const p1 = players.find(p => p.id === event.player1Id);
            const p2 = players.find(p => p.id === event.player2Id);
            const p1Name = p1 ? p1.name : 'Unknown';
            const p2Name = p2 ? p2.name : 'Unknown';

            // Show winner first
            const winnerName = event.score1 > event.score2 ? p1Name : p2Name;
            const loserName = event.score1 > event.score2 ? p2Name : p1Name;
            const winnerScore = Math.max(event.score1, event.score2);
            const loserScore = Math.min(event.score1, event.score2);

            return `<li class="history-item">
                <span>${dateStr} ${timeStr} - ${winnerName} ${winnerScore}:${loserScore} ${loserName}</span>
                <button class="remove-event-btn" onclick="removeHistoryEvent('game', ${event.originalIndex})">×</button>
            </li>`;
        } else {
            // Championship event
            const newChamp = players.find(p => p.id === event.newChampionId);
            const prevChamp = players.find(p => p.id === event.previousChampionId);
            const newName = newChamp ? newChamp.name : 'None';
            const prevName = prevChamp ? prevChamp.name : 'None';
            const reason = event.reason === 'manual' ? '(manual)' : '';

            let durationText = '';
            if (event.previousChampionId) {
                // Find when the previous champion started
                let prevChampStartDate = null;
                for (let i = event.originalIndex - 1; i >= 0; i--) {
                    if (championshipHistory[i].newChampionId === event.previousChampionId) {
                        prevChampStartDate = new Date(championshipHistory[i].date);
                        break;
                    }
                }

                if (prevChampStartDate) {
                    const endDate = new Date(event.date);
                    const days = calculateChampionDaysForPeriod(event.previousChampionId, prevChampStartDate, endDate);

                    if (days === 0) {
                        durationText = ' - held for <1 day';
                    } else if (days === 1) {
                        durationText = ' - held for 1 day';
                    } else {
                        durationText = ` - held for ${days} days`;
                    }
                }
            }

            return `<li class="history-item">
                <span><strong>${dateStr} ${timeStr} - 👑 ${newName} became champion ${reason}</strong> (was: ${prevName}${durationText})</span>
                <button class="remove-event-btn" onclick="removeHistoryEvent('championship', ${event.originalIndex})">×</button>
            </li>`;
        }
    }).join('');

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
    const stats = calculateStats();

    if (stats.length === 0) {
        document.getElementById('stats').innerHTML = '<p>No statistics yet</p>';
    } else {
        document.getElementById('stats').innerHTML = `
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Win %</th>
                        <th>Games</th>
                        <th>Points %</th>
                        <th>Champion Days</th>
                        <th>Max Streak</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.map(s => {
                        const player = players.find(p => p.name === s.name);
                        const playerId = player ? player.id : null;
                        return `
                        <tr onclick="showHeadToHeadPopup(${playerId})">
                            <td>${s.name}</td>
                            <td>${s.winPercent}%</td>
                            <td>${s.totalGames}</td>
                            <td>${s.pointPercent}%</td>
                            <td>${s.totalChampionDays}</td>
                            <td>${s.maxChampionStreak}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    }

    const champ = players.find(p => p.id === championship.championId);
    document.getElementById('champion').innerText =
        champ ? champ.name : 'No champion';
}

/* ===============================
   LOADING
================================ */

async function initializeApp() {
    const loadStartTime = Date.now();
    const minLoadTime = 3000; // 3 seconds

    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
        // Load state and show main app
        await loadState();

        // Calculate remaining time to show loading screen
        const elapsed = Date.now() - loadStartTime;
        const remainingTime = Math.max(0, minLoadTime - elapsed);

        setTimeout(() => {
            showMainApp();
        }, remainingTime);
    } else {
        // Show login after minimum loading time
        const elapsed = Date.now() - loadStartTime;
        const remainingTime = Math.max(0, minLoadTime - elapsed);

        setTimeout(() => {
            showLoginScreen();
        }, remainingTime);
    }
}

/* ===============================
   HEAD TO HEAD POPUP
================================ */

function showHeadToHeadPopup(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const h2hStats = calculateHeadToHead(playerId);
    const modal = document.getElementById('h2hModal');
    const title = document.getElementById('h2hModalTitle');
    const body = document.getElementById('h2hModalBody');

    title.innerText = `${player.name}'s statistics`;

    if (h2hStats.length === 0) {
        body.innerHTML = '<p style="color: #111111; text-align: center;">No games played against other players yet.</p>';
    } else {
        body.innerHTML = `
            <table class="h2h-table">
                <thead>
                    <tr>
                        <th>Opponent</th>
                        <th>Games</th>
                        <th>Win Balance</th>
                        <th>Avg Point Diff</th>
                    </tr>
                </thead>
                <tbody>
                    ${h2hStats.map(s => `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.gamesAgainst}</td>
                            <td>${s.winBalance > 0 ? '+' : ''}${s.winBalance}</td>
                            <td>${s.avgPointDiff > 0 ? '+' : ''}${s.avgPointDiff}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    modal.classList.add('show');
}

function closeHeadToHeadPopup(event) {
    // If event is passed, only close if clicking on the backdrop
    if (event && event.target.id !== 'h2hModal') return;

    const modal = document.getElementById('h2hModal');
    modal.classList.remove('show');
}

/* ===============================
   START
================================ */

initializeApp();
