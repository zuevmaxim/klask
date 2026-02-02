/* ===============================
   GAME LOGIC TESTS
================================ */

// Test helper to reset state
function resetState() {
    players.length = 0;
    championship.championId = null;
    championship.challengerId = null;
    championship.winsInRow = 0;
    championship.lastWinDate = null;
    games.length = 0;
    championshipHistory.length = 0;
}

// Test helper for assertions
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

// Run all tests
function runTests() {
    const tests = [
        testAddPlayerToState,
        testProcessMatchResultFirstGame,
        testProcessMatchResultChallengerWinsOnce,
        testProcessMatchResultChallengerWinsTwiceSameDay,
        testProcessMatchResultChallengerWinsTwiceDifferentDay,
        testProcessMatchResultChampionDefends,
        testSetChampionManual,
        testSetChampionCannotChangeTwiceInOneDay,
        testCalculateStats,
        testCalculateChampionshipDuration,
        testChampionDaysWonAndLostSameDay,
        testChampionDaysDefendedTwoDays,
        testChampionDaysNoPlayOnOneDay,
        testChampionDaysMultipleGamesPerDay,
        testChampionDaysOnlyLosses,
        testRemoveGameFromHistory,
        testRemoveChampionshipEventFromHistory,
        testLoadStateFromData,
        testGetStateForSave
    ];

    let passed = 0;
    let failed = 0;

    console.log('Running game-logic tests...\n');

    tests.forEach(test => {
        try {
            resetState();
            test();
            console.log(`✓ ${test.name}`);
            passed++;
        } catch (error) {
            console.error(`✗ ${test.name}`);
            console.error(`  ${error.message}\n`);
            failed++;
        }
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    return failed === 0;
}

/* ===============================
   TESTS
================================ */

function testAddPlayerToState() {
    const player = addPlayerToState('Alice');

    assertEquals(players.length, 1, 'Should have 1 player');
    assertEquals(player.name, 'Alice', 'Player name should be Alice');
    assert(player.id > 0, 'Player should have an ID');
    assertEquals(players[0].name, 'Alice', 'Player should be in state');
}

function testProcessMatchResultFirstGame() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    processMatchResult(aliceId, bobId, 6, 4);

    assertEquals(games.length, 1, 'Should have 1 game');
    assertEquals(games[0].score1, 6, 'Score1 should be 6');
    assertEquals(games[0].score2, 4, 'Score2 should be 4');
    assertEquals(championship.championId, aliceId, 'Alice should be champion');
}

function testProcessMatchResultChallengerWinsOnce() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Alice becomes champion
    processMatchResult(aliceId, bobId, 6, 4);

    // Bob wins once against Alice
    processMatchResult(aliceId, bobId, 4, 6);

    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championship.challengerId, bobId, 'Bob should be challenger');
    assertEquals(championship.winsInRow, 1, 'Should have 1 win in a row');
    assertEquals(championshipHistory.length, 0, 'No championship change yet');
}

function testProcessMatchResultChallengerWinsTwiceSameDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Alice becomes champion
    processMatchResult(aliceId, bobId, 6, 4);

    // Bob wins twice against Alice on same day
    processMatchResult(aliceId, bobId, 4, 6);
    processMatchResult(aliceId, bobId, 4, 6);

    assertEquals(championship.championId, bobId, 'Bob should be champion');
    assertEquals(championship.challengerId, null, 'No challenger after championship change');
    assertEquals(championship.winsInRow, 0, 'Wins in row should reset');
    assertEquals(championshipHistory.length, 1, 'Should have 1 championship change');
    assertEquals(championshipHistory[0].newChampionId, bobId, 'Bob should be new champion');
    assertEquals(championshipHistory[0].previousChampionId, aliceId, 'Alice should be previous champion');
    assertEquals(championshipHistory[0].reason, 'game', 'Reason should be game');
}

function testProcessMatchResultChallengerWinsTwiceDifferentDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Alice becomes champion
    processMatchResult(aliceId, bobId, 6, 4);

    // Bob wins once
    processMatchResult(aliceId, bobId, 4, 6);

    // Simulate different day by changing lastWinDate
    championship.lastWinDate = 'Mon Jan 01 2024';

    // Bob wins again (but different day, should reset)
    processMatchResult(aliceId, bobId, 4, 6);

    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championship.challengerId, bobId, 'Bob should still be challenger');
    assertEquals(championship.winsInRow, 1, 'Wins should reset to 1');
    assertEquals(championshipHistory.length, 0, 'No championship change');
}

function testProcessMatchResultChampionDefends() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Alice becomes champion
    processMatchResult(aliceId, bobId, 6, 4);

    // Bob challenges once
    processMatchResult(aliceId, bobId, 4, 6);

    // Alice defends
    processMatchResult(aliceId, bobId, 6, 4);

    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championship.challengerId, null, 'No challenger after defense');
    assertEquals(championship.winsInRow, 0, 'Wins in row should reset');
}

function testSetChampionManual() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Initially no champion
    assertEquals(championship.championId, null, 'Should have no champion initially');

    // Set Alice as champion (from null, creates history event)
    setChampion(aliceId);
    assertEquals(championship.championId, aliceId, 'Alice should be champion');
    assertEquals(championshipHistory.length, 1, 'Should have 1 championship event after setting Alice');
    assertEquals(championshipHistory[0].reason, 'manual', 'Reason should be manual');
    assertEquals(championshipHistory[0].previousChampionId, null, 'Previous champion should be null');
}

function testSetChampionCannotChangeTwiceInOneDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Set Alice as champion manually (from null)
    setChampion(aliceId);
    assertEquals(championship.championId, aliceId, 'Alice should be champion');
    assertEquals(championshipHistory.length, 1, 'Should have 1 championship event');

    // Bob wins twice to try to take championship on the same day
    processMatchResult(aliceId, bobId, 4, 6); // First win
    assertEquals(championship.winsInRow, 1, 'Bob should have 1 win in a row');

    // Try to win championship on same day (should be silently skipped)
    processMatchResult(aliceId, bobId, 4, 6); // Second win (same day)

    // Championship should not have changed
    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championshipHistory.length, 1, 'Should still have only 1 championship event');
    assertEquals(championship.winsInRow, 2, 'Bob should still have 2 wins in a row');

    // Manual champion change should still be allowed on the same day
    setChampion(charlieId);
    assertEquals(championship.championId, charlieId, 'Charlie should be champion (manual change allowed)');
    assertEquals(championshipHistory.length, 2, 'Should now have 2 championship events');

    // Manual champion change can happen multiple times per day
    setChampion(bobId);
    assertEquals(championship.championId, bobId, 'Bob should be champion (manual change allowed)');
    assertEquals(championshipHistory.length, 3, 'Should now have 3 championship events');
}

function testCalculateStats() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Add some games
    games.push({ player1Id: aliceId, player2Id: bobId, score1: 6, score2: 4 });
    games.push({ player1Id: aliceId, player2Id: bobId, score1: 6, score2: 3 });
    games.push({ player1Id: bobId, player2Id: aliceId, score1: 6, score2: 5 });

    const stats = calculateStats();

    assertEquals(stats.length, 2, 'Should have stats for 2 players');

    const aliceStats = stats.find(s => s.name === 'Alice');
    const bobStats = stats.find(s => s.name === 'Bob');

    assertEquals(aliceStats.wins, 2, 'Alice should have 2 wins');
    assertEquals(aliceStats.losses, 1, 'Alice should have 1 loss');
    assertEquals(aliceStats.totalGames, 3, 'Alice should have 3 total games');
    assertEquals(aliceStats.winPercent, '66.7', 'Alice should have 66.7% win rate');
    assertEquals(aliceStats.pointsWon, 17, 'Alice should have 17 points won (6+6+5)');
    assertEquals(aliceStats.pointsLost, 13, 'Alice should have 13 points lost (4+3+6)');
    assertEquals(aliceStats.pointPercent, '56.7', 'Alice should have 56.7% point win rate');

    assertEquals(bobStats.wins, 1, 'Bob should have 1 win');
    assertEquals(bobStats.losses, 2, 'Bob should have 2 losses');
    assertEquals(bobStats.totalGames, 3, 'Bob should have 3 total games');
    assertEquals(bobStats.winPercent, '33.3', 'Bob should have 33.3% win rate');
    assertEquals(bobStats.pointsWon, 13, 'Bob should have 13 points won (4+3+6)');
    assertEquals(bobStats.pointsLost, 17, 'Bob should have 17 points lost (6+6+5)');
    assertEquals(bobStats.pointPercent, '43.3', 'Bob should have 43.3% point win rate');
}

function testCalculateChampionshipDuration() {
    addPlayerToState('Alice');
    const aliceId = players[0].id;

    // No championship history yet
    let duration = calculateChampionshipDuration(aliceId);
    assertEquals(duration, null, 'Duration should be null with no history');

    // Add championship event 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    championshipHistory.push({
        date: twoDaysAgo.toISOString(),
        newChampionId: aliceId
    });

    duration = calculateChampionshipDuration(aliceId);
    assert(duration >= 1 && duration <= 2, 'Duration should be around 2 days');
}

// Test: A became champion on Wednesday, lost on Thursday (played both days) -> counts as 1 day
function testChampionDaysWonAndLostSameDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    const wednesday = new Date('2024-01-03T10:00:00Z');
    const thursday = new Date('2024-01-04T10:00:00Z');

    // Alice becomes champion on Wednesday
    championshipHistory.push({
        date: wednesday.toISOString(),
        newChampionId: aliceId
    });

    // Alice plays and wins on Wednesday
    games.push({
        date: wednesday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });

    // Alice plays on Thursday but loses (this day should NOT count)
    games.push({
        date: thursday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 4,
        score2: 6
    });

    // Bob becomes champion on Thursday (Alice lost)
    championshipHistory.push({
        date: thursday.toISOString(),
        newChampionId: bobId
    });

    const stats = calculateStats();
    const aliceStats = stats.find(s => s.name === 'Alice');

    assertEquals(aliceStats.totalChampionDays, 1, 'Alice should have 1 champion day (Wed only, Thu does not count)');
}

// Test: A became champion on Wednesday, defended on Thursday, lost on Friday -> counts as 2 days
function testChampionDaysDefendedTwoDays() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    const wednesday = new Date('2024-01-03T10:00:00Z');
    const thursday = new Date('2024-01-04T10:00:00Z');
    const friday = new Date('2024-01-05T10:00:00Z');

    // Alice becomes champion on Wednesday
    championshipHistory.push({
        date: wednesday.toISOString(),
        newChampionId: aliceId
    });

    // Alice plays on Wednesday
    games.push({
        date: wednesday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });

    // Alice plays and wins on Thursday (defended)
    games.push({
        date: thursday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 3
    });

    // Bob becomes champion on Friday
    championshipHistory.push({
        date: friday.toISOString(),
        newChampionId: bobId
    });

    const stats = calculateStats();
    const aliceStats = stats.find(s => s.name === 'Alice');

    assertEquals(aliceStats.totalChampionDays, 2, 'Alice should have 2 champion days (Wed + Thu)');
}

// Test: A became champion on Wednesday, did not play on Thursday, lost on Friday -> counts as 1 day
function testChampionDaysNoPlayOnOneDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    const wednesday = new Date('2024-01-03T10:00:00Z');
    const thursday = new Date('2024-01-04T10:00:00Z');
    const friday = new Date('2024-01-05T10:00:00Z');

    // Alice becomes champion on Wednesday
    championshipHistory.push({
        date: wednesday.toISOString(),
        newChampionId: aliceId
    });

    // Alice plays on Wednesday
    games.push({
        date: wednesday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });

    // No games on Thursday

    // Bob becomes champion on Friday
    championshipHistory.push({
        date: friday.toISOString(),
        newChampionId: bobId
    });

    const stats = calculateStats();
    const aliceStats = stats.find(s => s.name === 'Alice');

    assertEquals(aliceStats.totalChampionDays, 1, 'Alice should have 1 champion day (only Wed, did not play Thu)');
}

// Test: Multiple games on the same day should count as 1 day
function testChampionDaysMultipleGamesPerDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    const wednesday = new Date('2024-01-03T10:00:00Z');
    const thursday = new Date('2024-01-04T10:00:00Z');

    // Alice becomes champion on Wednesday
    championshipHistory.push({
        date: wednesday.toISOString(),
        newChampionId: aliceId
    });

    // Alice plays 3 games on Wednesday
    games.push({
        date: wednesday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });
    games.push({
        date: new Date('2024-01-03T14:00:00Z').toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 2
    });
    games.push({
        date: new Date('2024-01-03T18:00:00Z').toISOString(),
        player1Id: bobId,
        player2Id: aliceId,
        score1: 6,
        score2: 5
    });

    // Bob becomes champion on Thursday
    championshipHistory.push({
        date: thursday.toISOString(),
        newChampionId: bobId
    });

    const stats = calculateStats();
    const aliceStats = stats.find(s => s.name === 'Alice');

    assertEquals(aliceStats.totalChampionDays, 1, 'Alice should have 1 champion day (3 games on same day = 1 day)');
}

// Test: Champion plays but loses -> days before losing count
function testChampionDaysOnlyLosses() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    const wednesday = new Date('2024-01-03T10:00:00Z');
    const thursday = new Date('2024-01-04T10:00:00Z');
    const friday = new Date('2024-01-05T10:00:00Z');

    // Alice becomes champion on Wednesday
    championshipHistory.push({
        date: wednesday.toISOString(),
        newChampionId: aliceId
    });

    // Alice wins on Wednesday
    games.push({
        date: wednesday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });

    // Alice plays on Thursday (still champion)
    games.push({
        date: thursday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });

    // Alice plays on Friday and loses championship
    games.push({
        date: friday.toISOString(),
        player1Id: aliceId,
        player2Id: bobId,
        score1: 4,
        score2: 6
    });

    // Bob becomes champion on Friday
    championshipHistory.push({
        date: friday.toISOString(),
        newChampionId: bobId
    });

    const stats = calculateStats();
    const aliceStats = stats.find(s => s.name === 'Alice');

    assertEquals(aliceStats.totalChampionDays, 2, 'Alice should have 2 champion days (Wed + Thu, not Fri when lost)');
}

function testRemoveGameFromHistory() {
    games.push({ player1Id: 1, player2Id: 2, score1: 6, score2: 4 });
    games.push({ player1Id: 1, player2Id: 2, score1: 6, score2: 3 });

    assertEquals(games.length, 2, 'Should have 2 games');

    removeGameFromHistory(0);

    assertEquals(games.length, 1, 'Should have 1 game after removal');
    assertEquals(games[0].score1, 6, 'Remaining game should be correct');
    assertEquals(games[0].score2, 3, 'Remaining game should be correct');
}

function testRemoveChampionshipEventFromHistory() {
    championshipHistory.push({ newChampionId: 1, reason: 'game' });
    championshipHistory.push({ newChampionId: 2, reason: 'manual' });

    assertEquals(championshipHistory.length, 2, 'Should have 2 events');

    removeChampionshipEventFromHistory(0);

    assertEquals(championshipHistory.length, 1, 'Should have 1 event after removal');
    assertEquals(championshipHistory[0].newChampionId, 2, 'Remaining event should be correct');
}

function testLoadStateFromData() {
    const testData = {
        players: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ],
        championship: {
            championId: 1,
            challengerId: null,
            winsInRow: 0,
            lastWinDate: null
        },
        games: [
            { player1Id: 1, player2Id: 2, score1: 6, score2: 4 }
        ],
        championshipHistory: [
            { newChampionId: 1, reason: 'game' }
        ]
    };

    loadStateFromData(testData);

    assertEquals(players.length, 2, 'Should have 2 players');
    assertEquals(players[0].name, 'Alice', 'First player should be Alice');
    assertEquals(championship.championId, 1, 'Champion should be loaded');
    assertEquals(games.length, 1, 'Should have 1 game');
    assertEquals(championshipHistory.length, 1, 'Should have 1 championship event');
}

function testGetStateForSave() {
    addPlayerToState('Alice');
    championship.championId = players[0].id;
    games.push({ player1Id: 1, player2Id: 2, score1: 6, score2: 4 });

    const state = getStateForSave();

    assert(state.players !== undefined, 'State should have players');
    assert(state.championship !== undefined, 'State should have championship');
    assert(state.games !== undefined, 'State should have games');
    assert(state.championshipHistory !== undefined, 'State should have championshipHistory');
    assertEquals(state.players.length, 1, 'Should have 1 player in saved state');
}

// Export for Node.js, or auto-load message for browser
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { runTests, resetState };
} else if (typeof window !== 'undefined') {
    // Browser environment
    console.log('Game logic tests loaded. Run runTests() to execute.');
}
