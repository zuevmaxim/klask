// @ts-nocheck
import {
  generateAllPairings,
  shufflePairings,
  createGame,
  submitRoundScore,
  getRoundWinners,
  calculateGameResults,
  calculatePlayerStats,
  calculatePairStats,
  addPlayer,
  buildStateForSave,
  loadStateFromData,
} from './game-logic';

// ===== Test Runner =====

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function assertEquals(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'assertEquals'}: expected ${e}, got ${a}`);
}

function assertThrows(fn, expectedMsg) {
  try {
    fn();
    throw new Error(`Expected function to throw "${expectedMsg}" but it did not`);
  } catch (err) {
    if (expectedMsg && !err.message.includes(expectedMsg)) {
      throw new Error(`Expected error "${expectedMsg}", got "${err.message}"`);
    }
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ===== Pairing Generation Tests =====

console.log('\n--- Pairing Generation ---');

test('generates exactly 3 pairings for 4 players', () => {
  const pairings = generateAllPairings([1, 2, 3, 4]);
  assertEquals(pairings.length, 3);
});

test('each pairing has 2 teams of 2', () => {
  const pairings = generateAllPairings([1, 2, 3, 4]);
  for (const p of pairings) {
    assertEquals(p.team1.length, 2);
    assertEquals(p.team2.length, 2);
  }
});

test('all 3 unique combinations are present', () => {
  const pairings = generateAllPairings([1, 2, 3, 4]);
  const keys = pairings.map(p => {
    const t1 = [...p.team1].sort().join(',');
    const t2 = [...p.team2].sort().join(',');
    return [t1, t2].sort().join('|');
  });
  const unique = new Set(keys);
  assertEquals(unique.size, 3);
});

test('each player appears in every pairing', () => {
  const pairings = generateAllPairings([1, 2, 3, 4]);
  for (const p of pairings) {
    const all = [...p.team1, ...p.team2].sort();
    assertEquals(all, [1, 2, 3, 4]);
  }
});

test('throws for non-4 players', () => {
  assertThrows(() => generateAllPairings([1, 2, 3]), 'Exactly 4 players');
});

// ===== Game Creation Tests =====

console.log('\n--- Game Creation ---');

test('createGame returns correct structure', () => {
  const game = createGame([1, 2, 3, 4]);
  assertEquals(game.playerIds.length, 4);
  assertEquals(game.rounds.length, 3);
  assertEquals(game.currentRound, 0);
  assertEquals(game.completed, false);
});

test('createGame rounds have null scores initially', () => {
  const game = createGame([1, 2, 3, 4]);
  for (const r of game.rounds) {
    assertEquals(r.score1, null);
    assertEquals(r.score2, null);
  }
});

test('createGame uses all 3 pairings', () => {
  const game = createGame([1, 2, 3, 4]);
  const keys = game.rounds.map(r => {
    const t1 = [...r.team1].sort().join(',');
    const t2 = [...r.team2].sort().join(',');
    return [t1, t2].sort().join('|');
  });
  const unique = new Set(keys);
  assertEquals(unique.size, 3);
});

// ===== Score Submission Tests =====

console.log('\n--- Score Submission ---');

test('submitRoundScore records score and advances round', () => {
  const game = createGame([1, 2, 3, 4]);
  const updated = submitRoundScore(game, 6, 4);
  assertEquals(updated.rounds[0].score1, 6);
  assertEquals(updated.rounds[0].score2, 4);
  assertEquals(updated.currentRound, 1);
  assertEquals(updated.completed, false);
});

test('submitRoundScore rejects ties', () => {
  const game = createGame([1, 2, 3, 4]);
  assertThrows(() => submitRoundScore(game, 5, 5), 'Ties are not allowed');
});

test('submitRoundScore rejects out-of-range scores', () => {
  const game = createGame([1, 2, 3, 4]);
  assertThrows(() => submitRoundScore(game, -1, 5), 'Scores must be between 0 and 10');
  assertThrows(() => submitRoundScore(game, 5, 11), 'Scores must be between 0 and 10');
});

test('submitRoundScore rejects completed game', () => {
  let game = createGame([1, 2, 3, 4]);
  game = submitRoundScore(game, 6, 4);
  game = submitRoundScore(game, 6, 3);
  game = submitRoundScore(game, 7, 2);
  assertEquals(game.completed, true);
  assertThrows(() => submitRoundScore(game, 5, 3), 'Game is already completed');
});

test('3 rounds completes the game', () => {
  let game = createGame([1, 2, 3, 4]);
  game = submitRoundScore(game, 6, 4);
  game = submitRoundScore(game, 6, 3);
  game = submitRoundScore(game, 7, 2);
  assertEquals(game.completed, true);
});

test('submitRoundScore does not mutate original', () => {
  const game = createGame([1, 2, 3, 4]);
  const original = JSON.stringify(game);
  submitRoundScore(game, 6, 4);
  assertEquals(JSON.stringify(game), original);
});

// ===== Round Winners Tests =====

console.log('\n--- Round Winners ---');

test('getRoundWinners returns team1 when score1 > score2', () => {
  const round = { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 };
  const winners = getRoundWinners(round);
  assertEquals(winners.sort(), [1, 2]);
});

test('getRoundWinners returns team2 when score2 > score1', () => {
  const round = { team1: [1, 2], team2: [3, 4], score1: 3, score2: 7 };
  const winners = getRoundWinners(round);
  assertEquals(winners.sort(), [3, 4]);
});

test('getRoundWinners returns null for incomplete round', () => {
  const round = { team1: [1, 2], team2: [3, 4], score1: null, score2: null };
  assertEquals(getRoundWinners(round), null);
});

// ===== Game Results Tests =====

console.log('\n--- Game Results ---');

test('calculateGameResults for completed game', () => {
  let game = createGame([1, 2, 3, 4]);
  game = submitRoundScore(game, 6, 4);
  game = submitRoundScore(game, 6, 3);
  game = submitRoundScore(game, 7, 2);

  const results = calculateGameResults(game);
  for (const [, r] of results) {
    assertEquals(r.roundsPlayed, 3);
  }
});

test('calculateGameResults for partial game', () => {
  let game = createGame([1, 2, 3, 4]);
  game = submitRoundScore(game, 6, 4);

  const results = calculateGameResults(game);
  for (const [, r] of results) {
    assertEquals(r.roundsPlayed, 1);
  }
});

test('calculateGameResults tracks wins correctly', () => {
  const game = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
      { team1: [1, 3], team2: [2, 4], score1: 6, score2: 3 },
      { team1: [1, 4], team2: [2, 3], score1: 7, score2: 2 },
    ],
    currentRound: 2,
    completed: true,
  };

  const results = calculateGameResults(game);
  // Player 1 is on the winning team in all 3 rounds
  assertEquals(results.get(1).roundsWon, 3);
  assertEquals(results.get(1).roundsPlayed, 3);
});

// ===== Player Stats Tests =====

console.log('\n--- Player Stats ---');

test('calculatePlayerStats with no games', () => {
  const players = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  const stats = calculatePlayerStats(players, []);
  assertEquals(stats.length, 2);
  assertEquals(stats[0].roundsPlayed, 0);
  assertEquals(stats[0].winPercent, 0);
});

test('calculatePlayerStats with one game', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
      { team1: [1, 3], team2: [2, 4], score1: 6, score2: 3 },
      { team1: [1, 4], team2: [2, 3], score1: 7, score2: 2 },
    ],
    currentRound: 2,
    completed: true,
  };
  const stats = calculatePlayerStats(players, [game]);
  const p1 = stats.find(s => s.playerId === 1);
  assertEquals(p1.roundsWon, 3);
  assertEquals(p1.roundsPlayed, 3);
  assertEquals(p1.winPercent, 100);
});

test('calculatePlayerStats with multiple games', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game1 = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
      { team1: [1, 3], team2: [2, 4], score1: 3, score2: 6 },
      { team1: [1, 4], team2: [2, 3], score1: 7, score2: 2 },
    ],
    currentRound: 2,
    completed: true,
  };
  const stats = calculatePlayerStats(players, [game1]);
  const p1 = stats.find(s => s.playerId === 1);
  assertEquals(p1.roundsWon, 2);
  assertEquals(p1.roundsPlayed, 3);
  assertEquals(p1.winPercent, 67);
});

test('calculatePlayerStats sorts by winPercent descending', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
      { team1: [1, 3], team2: [2, 4], score1: 6, score2: 3 },
      { team1: [1, 4], team2: [2, 3], score1: 7, score2: 2 },
    ],
    currentRound: 2,
    completed: true,
  };
  const stats = calculatePlayerStats(players, [game]);
  assert(stats[0].winPercent >= stats[1].winPercent, 'should be sorted desc');
});

// ===== Pair Stats Tests =====

console.log('\n--- Pair Stats ---');

test('calculatePairStats with one game', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
      { team1: [1, 3], team2: [2, 4], score1: 6, score2: 3 },
      { team1: [1, 4], team2: [2, 3], score1: 7, score2: 2 },
    ],
    currentRound: 2,
    completed: true,
  };
  const stats = calculatePairStats(players, [game]);
  // 6 unique pairs from 3 rounds (each round has 2 teams)
  assertEquals(stats.length, 6);
});

test('calculatePairStats calculates avgScore', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
    ],
    currentRound: 0,
    completed: false,
  };
  const stats = calculatePairStats(players, [game]);
  const pair12 = stats.find(s => s.pair[0] === 1 && s.pair[1] === 2);
  assertEquals(pair12.avgScore, 6);
  assertEquals(pair12.roundsWon, 1);
});

test('calculatePairStats sorted by winPercent', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game = {
    playerIds: [1, 2, 3, 4],
    rounds: [
      { team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 },
      { team1: [1, 3], team2: [2, 4], score1: 3, score2: 6 },
      { team1: [1, 4], team2: [2, 3], score1: 7, score2: 2 },
    ],
    currentRound: 2,
    completed: true,
  };
  const stats = calculatePairStats(players, [game]);
  for (let i = 1; i < stats.length; i++) {
    assert(stats[i - 1].winPercent >= stats[i].winPercent, 'should be sorted desc');
  }
});

test('calculatePairStats accumulates across games', () => {
  const players = [
    { id: 1, name: 'A' }, { id: 2, name: 'B' },
    { id: 3, name: 'C' }, { id: 4, name: 'D' },
  ];
  const game1 = {
    playerIds: [1, 2, 3, 4],
    rounds: [{ team1: [1, 2], team2: [3, 4], score1: 6, score2: 4 }],
    currentRound: 0, completed: false,
  };
  const game2 = {
    playerIds: [1, 2, 3, 4],
    rounds: [{ team1: [1, 2], team2: [3, 4], score1: 8, score2: 2 }],
    currentRound: 0, completed: false,
  };
  const stats = calculatePairStats(players, [game1, game2]);
  const pair12 = stats.find(s => s.pair[0] === 1 && s.pair[1] === 2);
  assertEquals(pair12.roundsPlayed, 2);
  assertEquals(pair12.roundsWon, 2);
  assertEquals(pair12.avgScore, 7);
});

// ===== Player Management Tests =====

console.log('\n--- Player Management ---');

test('addPlayer creates player with id and name', () => {
  const { newPlayer, newPlayers } = addPlayer([], 'Alice');
  assert(typeof newPlayer.id === 'number', 'id should be number');
  assertEquals(newPlayer.name, 'Alice');
  assertEquals(newPlayers.length, 1);
});

test('addPlayer does not mutate original', () => {
  const original = [{ id: 1, name: 'Alice' }];
  const copy = JSON.stringify(original);
  addPlayer(original, 'Bob');
  assertEquals(JSON.stringify(original), copy);
});

// ===== State Serialization Tests =====

console.log('\n--- State Serialization ---');

test('buildStateForSave creates correct shape', () => {
  const state = buildStateForSave([{ id: 1, name: 'A' }], [], null);
  assertEquals(state.players.length, 1);
  assertEquals(state.games, undefined);
  assertEquals(state.activeGame, null);
});

test('loadStateFromData parses correctly', () => {
  const data = { players: [{ id: 1, name: 'A' }], games: [{ id: 1 }], activeGame: { x: 1 }, stats: { playerStats: [] }, theme: 'dark' };
  const state = loadStateFromData(data);
  assertEquals(state.players.length, 1);
  assertEquals(state.games.length, 1);
  assert(state.activeGame !== null, 'activeGame should be set');
  assertEquals(state.stats.playerStats.length, 0);
  assertEquals(state.extraFields.theme, 'dark');
  assertEquals(state.extraFields.stats, undefined);
});

test('loadStateFromData handles missing fields', () => {
  const state = loadStateFromData({});
  assertEquals(state.players.length, 0);
  assertEquals(state.games.length, 0);
  assertEquals(state.activeGame, null);
});

// ===== Summary =====

console.log(`\n===== Results: ${passed} passed, ${failed} failed =====\n`);
process.exit(failed > 0 ? 1 : 0);
