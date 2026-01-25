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

function calculateChampionshipDuration(championId) {
    if (!championId) return null;

    const previousChampionshipEvent = championshipHistory
        .slice()
        .reverse()
        .find(e => e.newChampionId === championId);

    if (!previousChampionshipEvent) return null;

    const start = new Date(previousChampionshipEvent.date);
    const end = new Date();
    return Math.floor((end - start) / (1000 * 60 * 60 * 24));
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
                reason: 'game',
                previousChampionDurationDays: calculateChampionshipDuration(loserId)
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
            reason: 'manual',
            previousChampionDurationDays: calculateChampionshipDuration(championship.championId)
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
        stats[p.id] = { name: p.name, wins: 0, losses: 0 };
    });

    games.forEach(game => {
        const winnerId = game.score1 > game.score2 ? game.player1Id : game.player2Id;
        const loserId = game.score1 > game.score2 ? game.player2Id : game.player1Id;

        if (stats[winnerId]) stats[winnerId].wins++;
        if (stats[loserId]) stats[loserId].losses++;
    });

    return Object.values(stats);
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
