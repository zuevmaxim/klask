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
const championshipHistory = [];

/* ===============================
   BUSINESS LOGIC
================================ */

function durationInDays(end, start) {
    const hours = (end - start) / (1000 * 60 * 60);
    return Math.floor((hours + 12) / 24);
}

function calculateChampionshipDuration(championId) {
    if (!championId) return null;

    const previousChampionshipEvent = championshipHistory
        .slice()
        .reverse()
        .find(e => e.newChampionId === championId);

    if (!previousChampionshipEvent) return null;

    const start = new Date(previousChampionshipEvent.date);
    const end = new Date();
    return durationInDays(end, start);
}

// Calculate champion days for a specific championship period
function calculateChampionDaysForPeriod(championId, startDate, endDate) {
    const defendedDays = new Set();
    const endDayKey = endDate ? new Date(endDate).toDateString() : null;

    games.forEach(game => {
        const gameDate = new Date(game.date);
        const gameDayKey = new Date(gameDate).toDateString();

        // Exclude games on the day the championship ended
        if (gameDayKey === endDayKey) return;

        if (gameDate >= startDate && gameDate < endDate) {
            if (game.player1Id === championId || game.player2Id === championId) {
                defendedDays.add(gameDayKey);
            }
        }
    });

    return defendedDays.size;
}

function addPlayerToState(name) {
    // Use Date.now() + players.length to ensure unique IDs even in quick succession
    const player = {
        id: Date.now() + players.length,
        name
    };
    players.push(player);
    return player;
}

function processMatchResult(p1Id, p2Id, score1, score2) {
    const winnerId = score1 > score2 ? p1Id : p2Id;
    const loserId = score1 > score2 ? p2Id : p1Id;

    const currentDate = new Date();
    const today = currentDate.toDateString();
    const now = currentDate.toISOString();

    // Save game to history
    games.push({
        date: now,
        player1Id: p1Id,
        player2Id: p2Id,
        score1: score1,
        score2: score2
    });

    // Championship logic
    let championChanged = false;

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
            championshipHistory.push({
                date: now,
                newChampionId: winnerId,
                previousChampionId: loserId,
                reason: 'game'
            });

            championship.championId = winnerId;
            championship.challengerId = null;
            championship.winsInRow = 0;
            championship.lastWinDate = null;
            championChanged = true;
        }
    } else if (championship.championId === winnerId) {
        championship.challengerId = null;
        championship.winsInRow = 0;
        championship.lastWinDate = null;
    }

    return { championChanged };
}

function setChampion(newChampionId) {
    if (newChampionId !== championship.championId) {
        championshipHistory.push({
            date: new Date().toISOString(),
            newChampionId: newChampionId,
            previousChampionId: championship.championId,
            reason: 'manual'
        });
    }

    championship.championId = newChampionId;
    championship.challengerId = null;
    championship.winsInRow = 0;
    championship.lastWinDate = null;
}

function removeGameFromHistory(index) {
    games.splice(index, 1);
}

function removeChampionshipEventFromHistory(index) {
    championshipHistory.splice(index, 1);
}

function calculateStats() {
    const stats = {};
    players.forEach(p => {
        stats[p.id] = {
            name: p.name,
            wins: 0,
            losses: 0,
            pointsWon: 0,
            pointsLost: 0,
            totalChampionDays: 0,
            maxChampionStreak: 0
        };
    });

    games.forEach(game => {
        const winnerId = game.score1 > game.score2 ? game.player1Id : game.player2Id;
        const loserId = game.score1 > game.score2 ? game.player2Id : game.player1Id;
        const winnerScore = Math.max(game.score1, game.score2);
        const loserScore = Math.min(game.score1, game.score2);

        if (stats[winnerId]) {
            stats[winnerId].wins++;
            stats[winnerId].pointsWon += winnerScore;
            stats[winnerId].pointsLost += loserScore;
        }
        if (stats[loserId]) {
            stats[loserId].losses++;
            stats[loserId].pointsWon += loserScore;
            stats[loserId].pointsLost += winnerScore;
        }
    });

    // Calculate championship days for each player
    // Only count days when the champion played at least one game
    championshipHistory.forEach((event, index) => {
        const championId = event.newChampionId;
        if (!championId || !stats[championId]) return;

        const startDate = new Date(event.date);

        // Find when this championship ended (next championship event)
        const nextEvent = championshipHistory[index + 1];
        const endDate = nextEvent ? new Date(nextEvent.date) : new Date();

        const days = calculateChampionDaysForPeriod(championId, startDate, endDate);

        stats[championId].totalChampionDays += days;
        if (days > stats[championId].maxChampionStreak) {
            stats[championId].maxChampionStreak = days;
        }
    });

    // Calculate percentages
    return Object.values(stats).map(s => {
        const totalGames = s.wins + s.losses;
        const winPercent = totalGames > 0 ? ((s.wins / totalGames) * 100).toFixed(1) : 0;
        const totalPoints = s.pointsWon + s.pointsLost;
        const pointPercent = totalPoints > 0 ? ((s.pointsWon / totalPoints) * 100).toFixed(1) : 0;

        return {
            ...s,
            totalGames,
            winPercent,
            pointPercent
        };
    });
}

function loadStateFromData(data) {
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

    championshipHistory.length = 0;
    if (data.championshipHistory) {
        championshipHistory.push(...data.championshipHistory);
    }
}

function getStateForSave() {
    return {
        players,
        championship,
        games,
        championshipHistory
    };
}
