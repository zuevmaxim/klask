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
   UI UTILITIES
================================ */

// Create a data table with headers and rows
function createTable(headers, rows, cssClass = 'data-table') {
    const headerCells = headers.map(h => `<th>${h}</th>`).join('');
    const bodyRows = rows.map(row => {
        const cells = row.cells.map(c => `<td>${c}</td>`).join('');
        const clickAttr = row.onClick ? `onclick="${row.onClick}"` : '';
        const cursorStyle = row.onClick ? 'cursor: pointer;' : '';
        return `<tr ${clickAttr} style="${cursorStyle}">${cells}</tr>`;
    }).join('');

    return `
        <div class="table-wrapper">
            <table class="${cssClass}">
                <thead>
                    <tr>${headerCells}</tr>
                </thead>
                <tbody>
                    ${bodyRows}
                </tbody>
            </table>
        </div>
    `;
}

// Toggle visibility of an element
function toggleElement(elementId) {
    const el = document.getElementById(elementId);
    const isVisible = el.style.display !== 'none';
    el.style.display = isVisible ? 'none' : 'block';
    return !isVisible; // Return new visibility state
}

// Show/hide modal
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Create circular button elements
function createCircleButton(value, onClick) {
    const el = document.createElement('div');
    el.className = 'score-circle';
    el.innerText = value;
    el.onclick = onClick;
    return el;
}

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
    const isNowVisible = toggleElement('addPlayerForm');
    if (isNowVisible) {
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
    renderScoreRow('score1', 1);
    renderScoreRow('score2', 2);
}

function renderScoreRow(containerId, player) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    for (let i = 0; i <= 6; i++) {
        const circle = createCircleButton(i, () => handleScoreSelect(i, player));
        container.appendChild(circle);
    }
}

function handleScoreSelect(value, player) {
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
    const isNowVisible = toggleElement('changeChampionForm');
    if (isNowVisible) {
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
        const headers = ['Player', 'Win %', 'Games', 'Points %', 'Champion Days', 'Max Streak'];
        const rows = stats.map(s => {
            const player = players.find(p => p.name === s.name);
            const playerId = player ? player.id : null;
            return {
                cells: [s.name, `${s.winPercent}%`, s.totalGames, `${s.pointPercent}%`, s.totalChampionDays, s.maxChampionStreak],
                onClick: `showHeadToHeadPopup(${playerId})`
            };
        });

        document.getElementById('stats').innerHTML = createTable(headers, rows, 'data-table');
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
    let handler = null;
    let minLoadTime = 2000;
    let timeoutId = null;

    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.addEventListener('click', () => {
        minLoadTime = 0;
        if (handler) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            handler();
        }
    });

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        // Load state and show main app
        await loadState();
        handler = () => {
            showMainApp();
        };
    } else {
        handler = () => {
            showLoginScreen();
        };

    }
    // Calculate remaining time to show loading screen
    const elapsed = Date.now() - loadStartTime;
    const remainingTime = Math.max(0, minLoadTime - elapsed);
    timeoutId = setTimeout(handler, remainingTime);
}

/* ===============================
   HEAD TO HEAD POPUP
================================ */

function showHeadToHeadPopup(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const h2hStats = calculateHeadToHead(playerId);
    const title = document.getElementById('h2hModalTitle');
    const body = document.getElementById('h2hModalBody');

    title.innerText = `${player.name}'s statistics`;

    if (h2hStats.length === 0) {
        body.innerHTML = '<p style="color: #111111; text-align: center;">No games played against other players yet.</p>';
    } else {
        const headers = ['Opponent', 'Games', 'Win Balance', 'Avg Point Diff'];
        const rows = h2hStats.map(s => ({
            cells: [
                s.name,
                s.gamesAgainst,
                `${s.winBalance > 0 ? '+' : ''}${s.winBalance}`,
                `${s.avgPointDiff > 0 ? '+' : ''}${s.avgPointDiff}`
            ]
        }));

        body.innerHTML = createTable(headers, rows, 'data-table h2h-table');
    }

    showModal('h2hModal');
}

function closeHeadToHeadPopup(event) {
    // If event is passed, only close if clicking on the backdrop
    if (event && event.target.id !== 'h2hModal') return;
    hideModal('h2hModal');
}

/* ===============================
   START
================================ */

initializeApp();
