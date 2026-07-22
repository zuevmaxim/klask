// @ts-nocheck
/* ===============================
   GAME LOGIC TESTS
================================ */

// Test helper to reset state
function resetState() {
    players.length = 0;
    championship.championId = null;
    championship.candidate = null;
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
        testProcessMatchResultStoresEloSnapshot,
        testProcessMatchResultStoresEloSnapshotWhenPlayer2Wins,
        testProcessMatchResultUsesProvidedFullState,
        testEloUnderdogWinIsWorthMore,
        testCalculateEloRatingsEmptyState,
        testCalculateEloRatingsReplaysGames,
        testCalculateEloRatingsSkipsUnknownPlayers,
        testLoadStateFromDataEnrichesLegacyGamesWithElo,
        testCalculateStatsIncludesRating,
        testProcessMatchResultChallengerWinsOnce,
        testNoCandidateIfWinVsChampionIsNotFirstChampionGameOfDay,
        testProcessMatchResultChallengerWinsTwiceSameDay,
        testProcessMatchResultChallengerWinsTwiceDifferentDay,
        testCandidateWindowNotAffectedByGamesVsNonChampion,
        testCandidateLosesThenWinsStillBecomesChampionWithinWindow,
        testCannotOpenSecondCandidateWindowSameDay,
        testCandidateWindowExpiresAfterTwoChampionGamesEvenIfChampionDefends,
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
        testGetStateForSave,
        ...(typeof getKlask4Tests === 'function' ? getKlask4Tests() : []),
        testCalculateHeadToHeadBasic,
        testCalculateHeadToHeadMultipleOpponents,
        testCalculateHeadToHeadNoGames,
        testCalculateHeadToHeadSortedByGamesCount,
        testCannotBecomeChampionAfterLosingToday,
        testCanBecomeChampionIfNoLossToday,
        testLostTodaySetClearsOnNewDay,
        testChampionBeatsMultiplePlayersTracked
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

function testProcessMatchResultUsesProvidedFullState() {
    const state = {
        players: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        championship: { championId: 1, candidate: { playerId: 2, remainingGames: 1 } },
        games: [
            { date: '2024-01-01T10:00:00Z', player1Id: 1, player2Id: 2, score1: 6, score2: 4 },
            { date: '2024-01-01T11:00:00Z', player1Id: 1, player2Id: 2, score1: 6, score2: 3 }
        ],
        championshipHistory: []
    };

    const result = processMatchResult(1, 2, 6, 2, state, new Date('2024-01-02T10:00:00Z'));

    assertEquals(state.games.length, 3, 'Provided state should receive the new game');
    assert(result.game.rating.player1Before > ELO_INITIAL_RATING, 'Elo should include stored historical games');
    assertEquals(state.championship.candidate, null, 'A candidate from the previous day should expire');
    assertEquals(games.length, 0, 'The module-global game list should not be mutated');
    assertEquals(calculateHeadToHead(1, state)[0].gamesAgainst, 3, 'Head-to-head should support the complete provided state');
}

function testProcessMatchResultStoresEloSnapshot() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    processMatchResult(aliceId, bobId, 6, 4);

    assertEquals(games[0].rating.player1Before, 1000, 'Alice should start at 1000');
    assertEquals(games[0].rating.player2Before, 1000, 'Bob should start at 1000');
    assertEquals(games[0].rating.player1After, 1020, 'Winner with provisional K=40 should gain 20');
    assertEquals(games[0].rating.player2After, 980, 'Loser with provisional K=40 should lose 20');
    assertEquals(games[0].rating.player1Delta, 20, 'Winner delta should be +20');
    assertEquals(games[0].rating.player2Delta, -20, 'Loser delta should be -20');
}

function testProcessMatchResultStoresEloSnapshotWhenPlayer2Wins() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    processMatchResult(aliceId, bobId, 4, 6);

    assertEquals(games[0].rating.player1Before, 1000, 'Alice should start at 1000');
    assertEquals(games[0].rating.player2Before, 1000, 'Bob should start at 1000');
    assertEquals(games[0].rating.player1After, 980, 'Player 1 loser should lose 20');
    assertEquals(games[0].rating.player2After, 1020, 'Player 2 winner should gain 20');
    assertEquals(games[0].rating.player1Delta, -20, 'Player 1 delta should be -20');
    assertEquals(games[0].rating.player2Delta, 20, 'Player 2 delta should be +20');
}

function testEloUnderdogWinIsWorthMore() {
    const favoriteBeatsUnderdog = calculateEloChange(1200, 1000, 10, 10);
    const underdogBeatsFavorite = calculateEloChange(1000, 1200, 10, 10);

    assert(favoriteBeatsUnderdog.winnerDelta < underdogBeatsFavorite.winnerDelta, 'Upset win should be worth more than expected win');
    assertEquals(favoriteBeatsUnderdog.winnerDelta, 6, 'Favorite should gain a small amount');
    assertEquals(underdogBeatsFavorite.winnerDelta, 18, 'Underdog should gain a larger amount');
}

function testCalculateEloRatingsEmptyState() {
    const result = calculateEloRatings();

    assertEquals(Object.keys(result.ratings).length, 0, 'No players should produce no ratings');
    assertEquals(Object.keys(result.gamesPlayed).length, 0, 'No players should produce no game counts');
}

function testCalculateEloRatingsReplaysGames() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    games.push({
        date: '2024-01-01T10:00:00Z',
        player1Id: aliceId,
        player2Id: bobId,
        score1: 6,
        score2: 4
    });

    const result = calculateEloRatings();

    assertEquals(result.ratings[aliceId], 1020, 'Replay should rate Alice win');
    assertEquals(result.ratings[bobId], 980, 'Replay should rate Bob loss');
    assertEquals(result.gamesPlayed[aliceId], 1, 'Alice should have one rated game');
    assertEquals(result.gamesPlayed[bobId], 1, 'Bob should have one rated game');
}

function testCalculateEloRatingsSkipsUnknownPlayers() {
    addPlayerToState('Alice');
    const aliceId = players[0].id;

    games.push({
        date: '2024-01-01T10:00:00Z',
        player1Id: aliceId,
        player2Id: 999,
        score1: 6,
        score2: 4
    });

    const result = calculateEloRatings();

    assertEquals(result.ratings[aliceId], 1000, 'Unknown opponent game should not affect rating');
    assertEquals(result.gamesPlayed[aliceId], 0, 'Unknown opponent game should not count as rated');
    assertEquals(games[0].rating, undefined, 'Unknown opponent game should not receive a rating snapshot');
}

function testLoadStateFromDataEnrichesLegacyGamesWithElo() {
    loadStateFromData({
        players: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ],
        championship: { championId: 1 },
        games: [
            {
                date: '2024-01-01T10:00:00Z',
                player1Id: 1,
                player2Id: 2,
                score1: 6,
                score2: 4
            },
            {
                date: '2024-01-02T10:00:00Z',
                player1Id: 1,
                player2Id: 2,
                score1: 3,
                score2: 6
            }
        ],
        championshipHistory: []
    });

    assertEquals(games[0].rating.player1Before, 1000, 'Legacy first game should get player 1 rating before');
    assertEquals(games[0].rating.player1After, 1020, 'Legacy first game should get player 1 rating after');
    assertEquals(games[1].rating.player1Before, 1020, 'Legacy second game should start from previous rating');
    assertEquals(games[1].rating.player2Before, 980, 'Legacy second game should start from previous opponent rating');
    assertEquals(games[1].rating.player1Delta, -22, 'Legacy second game should get underdog-loss delta for player 1');
    assertEquals(games[1].rating.player2Delta, 22, 'Legacy second game should get upset-win delta for player 2');
}

function testCalculateStatsIncludesRating() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    processMatchResult(aliceId, bobId, 6, 4);

    const stats = calculateStats();
    const aliceStats = stats.find(s => s.name === 'Alice');
    const bobStats = stats.find(s => s.name === 'Bob');

    assertEquals(aliceStats.rating, 1020, 'Alice rating should reflect the game result');
    assertEquals(bobStats.rating, 980, 'Bob rating should reflect the game result');
}

function testProcessMatchResultChallengerWinsOnce() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob having played today
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob wins once against Alice (first game of Bob's day)
    processMatchResult(aliceId, bobId, 4, 6);

    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should be challenger candidate');
    assertEquals(championshipHistory.length, 0, 'No championship change yet');
}

function testNoCandidateIfWinVsChampionIsNotFirstChampionGameOfDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob playing yet
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob's first game vs champion today is a LOSS
    processMatchResult(aliceId, bobId, 6, 4);

    // Bob can play other people; should not matter
    processMatchResult(bobId, charlieId, 6, 2);

    // Bob then beats champion Alice, but this is NOT his first game vs champion today
    processMatchResult(aliceId, bobId, 4, 6);

    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championship.candidate, null, 'Bob should not become challenger when win is not first game vs champion of day');
    assertEquals(championshipHistory.length, 0, 'No championship change yet');
    assertEquals(championship.candidate, null, 'Candidate should not be created');
}

function testProcessMatchResultChallengerWinsTwiceSameDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob having played today
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob wins twice against Alice on same day
    const firstWin = processMatchResult(aliceId, bobId, 4, 6);
    assertEquals(firstWin.championChanged, false, 'First win should not change champion yet');
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should become candidate after first win');
    assertEquals(championship.candidate.remainingGames, 2, 'Bob should have 2 champion games in window after first win');

    const secondWin = processMatchResult(aliceId, bobId, 4, 6);
    assertEquals(secondWin.championChanged, true, 'Second win in window should change champion');

    assertEquals(championship.championId, bobId, 'Bob should be champion');
    assertEquals(championship.candidate, null, 'No challenger after championship change');
    assertEquals(championshipHistory.length, 1, 'Should have 1 championship change');
    assertEquals(championshipHistory[0].newChampionId, bobId, 'Bob should be new champion');
    assertEquals(championshipHistory[0].previousChampionId, aliceId, 'Alice should be previous champion');
    assertEquals(championshipHistory[0].reason, 'game', 'Reason should be game');
}

function testProcessMatchResultChallengerWinsTwiceDifferentDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob having played today
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob wins once (starts candidate window)
    processMatchResult(aliceId, bobId, 4, 6);

    // Simulate different day by moving old games out of today
    games.forEach(g => {
        g.date = '2024-01-01T10:00:00Z';
    });

    // Bob wins again on a new day: should start a fresh window, not become champion yet
    processMatchResult(aliceId, bobId, 4, 6);

    // After a win on a different day, ensure no championship change occurred
    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championshipHistory.length, 0, 'No championship change');
}

function testCandidateWindowNotAffectedByGamesVsNonChampion() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob playing yet
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob starts candidate window (first game vs champion today is a win)
    processMatchResult(aliceId, bobId, 4, 6);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should be candidate');
    assertEquals(championship.candidate.remainingGames, 2, 'Candidate should start with 2 remaining champion games');

    // Bob plays two games vs non-champion Charlie - should NOT consume candidate window
    processMatchResult(bobId, charlieId, 6, 2);
    assertEquals(championship.candidate.remainingGames, 2, 'Games vs non-champion should not affect candidate window');

    processMatchResult(bobId, charlieId, 6, 3);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Candidate should remain active');
    assertEquals(championship.candidate.remainingGames, 2, 'Still 2 remaining champion games');
    assertEquals(championship.championId, aliceId, 'Alice should remain champion');
}

function testCandidateLosesThenWinsStillBecomesChampionWithinWindow() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob playing yet
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob starts candidate window
    processMatchResult(aliceId, bobId, 4, 6);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should be candidate');
    assertEquals(championship.candidate.remainingGames, 2, 'Bob should have 2 champion games in window');

    // Bob loses one game to champion (window -> 1)
    const defend = processMatchResult(aliceId, bobId, 6, 4);
    assertEquals(defend.championChanged, false, 'Champion defense should not change champion');
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should still be candidate');
    assertEquals(championship.candidate.remainingGames, 1, 'One champion game should remain');

    // Bob wins next game vs champion and should become champion
    const convert = processMatchResult(aliceId, bobId, 4, 6);
    assertEquals(convert.championChanged, true, 'Bob should become champion on next win within window');
    assertEquals(championship.championId, bobId, 'Bob should be new champion');
    assertEquals(championship.candidate, null, 'Candidate should reset after championship change');
}

function testCannotOpenSecondCandidateWindowSameDay() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    processMatchResult(aliceId, charlieId, 6, 4); // Alice champion

    // First window starts for Bob
    processMatchResult(aliceId, bobId, 4, 6);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should have first candidate window');

    // Bob spends window without conversion
    processMatchResult(aliceId, bobId, 6, 4);
    processMatchResult(aliceId, bobId, 6, 3);
    assertEquals(championship.candidate, null, 'First window should be closed');

    // Bob wins again vs champion on same day, but second window must not open
    processMatchResult(aliceId, bobId, 4, 6);
    assertEquals(championship.candidate, null, 'Second candidate window should not open on same day');
    assertEquals(championship.championId, aliceId, 'Alice should remain champion');
}

function testCandidateWindowExpiresAfterTwoChampionGamesEvenIfChampionDefends() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob playing yet
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob starts candidate window
    processMatchResult(aliceId, bobId, 4, 6);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should be candidate');

    // Champion defends once (consumes one champion game from Bob's window)
    processMatchResult(aliceId, bobId, 6, 4);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should still be candidate');
    assertEquals(championship.candidate.remainingGames, 1, 'One champion game should remain in candidate window');

    // Non-champion game should not consume window
    processMatchResult(bobId, charlieId, 6, 2);
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Candidate should still be active after non-champion game');
    assertEquals(championship.candidate.remainingGames, 1, 'Still one champion game remaining');

    // Second game vs champion consumes last chance and expires window
    processMatchResult(aliceId, bobId, 6, 3);
    assertEquals(championship.candidate, null, 'Candidate window should expire after second champion game without conversion');
    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
}

function testProcessMatchResultChampionDefends() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice becomes champion without Bob playing yet
    processMatchResult(aliceId, charlieId, 6, 4);

    // Bob challenges once
    processMatchResult(aliceId, bobId, 4, 6);

    // Alice defends
    processMatchResult(aliceId, bobId, 6, 4);

    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should remain candidate with one game left');
    assertEquals(championship.candidate.remainingGames, 1, 'Bob should have one remaining game in window');
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
    const firstWin = processMatchResult(aliceId, bobId, 4, 6); // First win
    assertEquals(firstWin.championChanged, false, 'First win should not change champion');
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should have candidate started after first win');
    assertEquals(championship.candidate.remainingGames, 2, 'Bob should have 2 champion games left in window');

    // Try to win championship on same day (should be skipped because champion already changed today manually)
    const secondWin = processMatchResult(aliceId, bobId, 4, 6); // Second win (same day)
    assertEquals(secondWin.championChanged, false, 'Second win should not change champion when champion already changed today');

    // Championship should not have changed
    assertEquals(championship.championId, aliceId, 'Alice should still be champion');
    assertEquals(championshipHistory.length, 1, 'Should still have only 1 championship event');
    assert(championship.candidate && championship.candidate.playerId === bobId, 'Bob should still have candidate');
    assertEquals(championship.candidate.remainingGames, 1, 'One champion game should remain after second attempt is consumed');

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
            candidate: { playerId: 2, remainingGames: 1 }
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
    assert(championship.candidate && championship.candidate.playerId === 2, 'Candidate should be loaded');
    assertEquals(championship.candidate.remainingGames, 1, 'Candidate remaining games should be loaded');
    assertEquals(games.length, 1, 'Should have 1 game');
    assertEquals(championshipHistory.length, 1, 'Should have 1 championship event');
}

function testGetStateForSave() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    championship.championId = players[0].id;
    championship.candidate = { playerId: players[1].id, remainingGames: 1 };
    games.push({ player1Id: 1, player2Id: 2, score1: 6, score2: 4 });

    const state = getStateForSave();

    assert(state.players !== undefined, 'State should have players');
    assert(state.championship !== undefined, 'State should have championship');
    assert(state.games === undefined, 'State should NOT have games (excluded to avoid 413 error)');
    assert(state.championshipHistory !== undefined, 'State should have championshipHistory');
    assertEquals(state.players.length, 2, 'Should have 2 players in saved state');
    assert(state.championship.candidate && state.championship.candidate.playerId === players[1].id, 'Candidate should be serialized');
    assertEquals(state.championship.candidate.remainingGames, 1, 'Candidate remainingGames should be serialized');
}

function testCalculateHeadToHeadBasic() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;
    const bobId = players[1].id;

    // Alice wins 2 games against Bob
    games.push({ date: '2024-01-01', player1Id: aliceId, player2Id: bobId, score1: 6, score2: 4 });
    games.push({ date: '2024-01-02', player1Id: aliceId, player2Id: bobId, score1: 6, score2: 3 });
    // Bob wins 1 game against Alice
    games.push({ date: '2024-01-03', player1Id: bobId, player2Id: aliceId, score1: 6, score2: 2 });

    const aliceH2H = calculateHeadToHead(aliceId);

    assertEquals(aliceH2H.length, 1, 'Alice should have stats against 1 opponent');
    assertEquals(aliceH2H[0].name, 'Bob', 'Opponent should be Bob');
    assertEquals(aliceH2H[0].gamesAgainst, 3, 'Should have 3 games against Bob');
    assertEquals(aliceH2H[0].winBalance, 1, 'Win balance should be +1 (2 wins - 1 loss)');
    // Average point diff: (6-4) + (6-3) + (2-6) = 2 + 3 + (-4) = 1, avg = 1/3 = 0.3
    assertEquals(aliceH2H[0].avgPointDiff, '0.3', 'Average point difference should be 0.3');
}

function testCalculateHeadToHeadMultipleOpponents() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;

    // Alice vs Bob: 2 games
    games.push({ date: '2024-01-01', player1Id: aliceId, player2Id: bobId, score1: 6, score2: 4 });
    games.push({ date: '2024-01-02', player1Id: bobId, player2Id: aliceId, score1: 6, score2: 3 });

    // Alice vs Charlie: 1 game
    games.push({ date: '2024-01-03', player1Id: aliceId, player2Id: charlieId, score1: 6, score2: 1 });

    const aliceH2H = calculateHeadToHead(aliceId);

    assertEquals(aliceH2H.length, 2, 'Alice should have stats against 2 opponents');

    // Should be sorted by games count (Bob first with 2 games, then Charlie with 1)
    assertEquals(aliceH2H[0].name, 'Bob', 'First opponent should be Bob (most games)');
    assertEquals(aliceH2H[0].gamesAgainst, 2, 'Should have 2 games against Bob');
    assertEquals(aliceH2H[0].winBalance, 0, 'Win balance vs Bob should be 0 (1-1)');

    assertEquals(aliceH2H[1].name, 'Charlie', 'Second opponent should be Charlie');
    assertEquals(aliceH2H[1].gamesAgainst, 1, 'Should have 1 game against Charlie');
    assertEquals(aliceH2H[1].winBalance, 1, 'Win balance vs Charlie should be +1');
}

function testCalculateHeadToHeadNoGames() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    const aliceId = players[0].id;

    // No games played
    const aliceH2H = calculateHeadToHead(aliceId);

    assertEquals(aliceH2H.length, 0, 'Should return empty array when no games played');
}

function testCalculateHeadToHeadSortedByGamesCount() {
    addPlayerToState('Alice');
    addPlayerToState('Bob');
    addPlayerToState('Charlie');
    addPlayerToState('Dave');
    const aliceId = players[0].id;
    const bobId = players[1].id;
    const charlieId = players[2].id;
    const daveId = players[3].id;

    // Alice vs Bob: 5 games
    for (let i = 0; i < 5; i++) {
        games.push({ date: '2024-01-01', player1Id: aliceId, player2Id: bobId, score1: 6, score2: 4 });
    }

    // Alice vs Charlie: 3 games
    for (let i = 0; i < 3; i++) {
        games.push({ date: '2024-01-02', player1Id: aliceId, player2Id: charlieId, score1: 6, score2: 3 });
    }

    // Alice vs Dave: 10 games
    for (let i = 0; i < 10; i++) {
        games.push({ date: '2024-01-03', player1Id: aliceId, player2Id: daveId, score1: 6, score2: 2 });
    }

    const aliceH2H = calculateHeadToHead(aliceId);

    assertEquals(aliceH2H.length, 3, 'Alice should have stats against 3 opponents');
    assertEquals(aliceH2H[0].name, 'Dave', 'First should be Dave (10 games)');
    assertEquals(aliceH2H[0].gamesAgainst, 10, 'Dave should have 10 games');
    assertEquals(aliceH2H[1].name, 'Bob', 'Second should be Bob (5 games)');
    assertEquals(aliceH2H[1].gamesAgainst, 5, 'Bob should have 5 games');
    assertEquals(aliceH2H[2].name, 'Charlie', 'Third should be Charlie (3 games)');
    assertEquals(aliceH2H[2].gamesAgainst, 3, 'Charlie should have 3 games');
}

// Test: if player's first game vs champion today is a loss, later wins cannot open window
function testCannotBecomeChampionAfterLosingToday() {
    addPlayerToState('A');
    addPlayerToState('B');
    addPlayerToState('C');
    const aId = players[0].id;
    const bId = players[1].id;
    const cId = players[2].id;

    processMatchResult(aId, cId, 6, 4); // A champion

    // B's first game vs champion today is loss
    processMatchResult(aId, bId, 6, 3);

    // Later wins vs champion same day should not create candidate window
    processMatchResult(bId, aId, 6, 4);
    assertEquals(championship.candidate, null, 'Candidate should not start when first champion game was a loss');

    const result = processMatchResult(bId, aId, 6, 5);
    assertEquals(result.championChanged, false, 'Championship should not change');
    assertEquals(championship.championId, aId, 'A should still be champion');
}

// Test: another player whose first game vs champion is win can still become champion
function testCanBecomeChampionIfNoLossToday() {
    addPlayerToState('A');
    addPlayerToState('B');
    addPlayerToState('C');
    const aId = players[0].id;
    const bId = players[1].id;
    const cId = players[2].id;

    processMatchResult(aId, bId, 6, 4); // A champion

    // B loses to A (irrelevant for C)
    processMatchResult(aId, bId, 6, 3);

    // C's first game vs champion is a win, then conversion win
    processMatchResult(cId, aId, 6, 4);
    processMatchResult(cId, aId, 6, 5);

    assertEquals(championship.championId, cId, 'C should become champion');
}

// Test: window can open again on a new day after a failed day
function testLostTodaySetClearsOnNewDay() {
    addPlayerToState('A');
    addPlayerToState('B');
    const aId = players[0].id;
    const bId = players[1].id;

    processMatchResult(aId, bId, 6, 4); // A champion

    // Day 1: B's first champion game is a loss
    processMatchResult(aId, bId, 6, 3);
    processMatchResult(bId, aId, 6, 4);
    assertEquals(championship.candidate, null, 'No candidate on day 1 after first-game loss');

    // Move games to previous day
    games.forEach(g => {
        g.date = '2024-01-01T10:00:00Z';
    });

    // Day 2: B can start window and convert
    processMatchResult(bId, aId, 6, 4);
    assert(championship.candidate && championship.candidate.playerId === bId, 'Candidate should start on new day');

    processMatchResult(bId, aId, 6, 5);
    assertEquals(championship.championId, bId, 'B should become champion on new day');
}

// Test: champion can beat multiple players, rules still depend on each player's first champion game
function testChampionBeatsMultiplePlayersTracked() {
    addPlayerToState('A');
    addPlayerToState('B');
    addPlayerToState('C');
    addPlayerToState('D');
    const aId = players[0].id;
    const bId = players[1].id;
    const cId = players[2].id;
    const dId = players[3].id;

    processMatchResult(aId, bId, 6, 4); // A champion

    // A beats B, C, D first
    processMatchResult(aId, bId, 6, 3);
    processMatchResult(aId, cId, 6, 2);
    processMatchResult(aId, dId, 6, 0);

    // B cannot become champion today because first champion game was a loss
    processMatchResult(bId, aId, 6, 4);
    processMatchResult(bId, aId, 6, 5);
    assertEquals(championship.championId, aId, 'A should still be champion');
}

// Export for Node.js, or auto-load message for browser
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { runTests, resetState };
} else if (typeof window !== 'undefined') {
    // Browser environment
    console.log('Game logic tests loaded. Run runTests() to execute.');
}
