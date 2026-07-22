// Pure game logic functions for Klask 4-player game tracker.
// No side effects, no DOM access.

/**
 * Generate all 3 possible team pairings for 4 players.
 * With players [A,B,C,D]: {A,B}v{C,D}, {A,C}v{B,D}, {A,D}v{B,C}
 */
export function generateAllPairings(playerIds) {
  if (playerIds.length !== 4) {
    throw new Error('Exactly 4 players required');
  }
  const [a, b, c, d] = playerIds;
  return [
    { team1: [a, b], team2: [c, d] },
    { team1: [a, c], team2: [b, d] },
    { team1: [a, d], team2: [b, c] },
  ];
}

/**
 * Fisher-Yates shuffle. Returns a new array.
 */
export function shufflePairings(pairings) {
  const arr = [...pairings];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Create a new active game with shuffled round pairings.
 */
export function createGame(playerIds) {
  const pairings = generateAllPairings(playerIds);
  const shuffled = shufflePairings(pairings);
  return {
    playerIds: [...playerIds],
    rounds: shuffled.map(p => ({
      team1: [...p.team1],
      team2: [...p.team2],
      score1: null,
      score2: null,
    })),
    currentRound: 0,
    completed: false,
  };
}

/**
 * Validate and record a round score, advance round. Returns a new game object.
 */
export function submitRoundScore(game, score1, score2) {
  if (game.completed) {
    throw new Error('Game is already completed');
  }
  if (score1 === score2) {
    throw new Error('Ties are not allowed');
  }
  if (score1 < 0 || score1 > 10 || score2 < 0 || score2 > 10) {
    throw new Error('Scores must be between 0 and 10');
  }
  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    throw new Error('Scores must be integers');
  }

  const newRounds = game.rounds.map((r, i) => {
    if (i === game.currentRound) {
      return { ...r, score1, score2 };
    }
    return { ...r };
  });

  const nextRound = game.currentRound + 1;
  const completed = nextRound >= game.rounds.length;

  return {
    ...game,
    playerIds: [...game.playerIds],
    rounds: newRounds,
    currentRound: completed ? game.currentRound : nextRound,
    completed,
  };
}

/**
 * Returns the winning team's player IDs for a round, or null if incomplete.
 */
export function getRoundWinners(round) {
  if (round.score1 === null || round.score2 === null) {
    return null;
  }
  return round.score1 > round.score2 ? [...round.team1] : [...round.team2];
}

/**
 * Calculate per-player results for one completed/partial game.
 * Returns Map<playerId, { roundsWon, roundsPlayed }>
 */
export function calculateGameResults(game) {
  const results = new Map();
  for (const id of game.playerIds) {
    results.set(id, { roundsWon: 0, roundsPlayed: 0 });
  }

  for (const round of game.rounds) {
    if (round.score1 === null || round.score2 === null) continue;

    // All 4 players play each round
    for (const id of [...round.team1, ...round.team2]) {
      const r = results.get(id);
      if (r) r.roundsPlayed++;
    }

    const winners = getRoundWinners(round);
    if (winners) {
      for (const id of winners) {
        const r = results.get(id);
        if (r) r.roundsWon++;
      }
    }
  }

  return results;
}

/**
 * Aggregate player stats across all completed games.
 * Returns array of { playerId, name, roundsWon, roundsPlayed, winPercent }
 * sorted by winPercent descending.
 */
export function calculatePlayerStats(players, games) {
  const stats = new Map();
  for (const p of players) {
    stats.set(p.id, { playerId: p.id, name: p.name, roundsWon: 0, roundsPlayed: 0 });
  }

  for (const game of games) {
    const results = calculateGameResults(game);
    for (const [id, r] of results) {
      const s = stats.get(id);
      if (s) {
        s.roundsWon += r.roundsWon;
        s.roundsPlayed += r.roundsPlayed;
      }
    }
  }

  return Array.from(stats.values())
    .map(s => ({
      ...s,
      winPercent: s.roundsPlayed > 0 ? Math.round((s.roundsWon / s.roundsPlayed) * 100) : 0,
    }))
    .sort((a, b) => b.winPercent - a.winPercent || b.roundsWon - a.roundsWon);
}

/**
 * Calculate per-pair stats across all completed games.
 * Returns array of { pair: [id1, id2], names: [name1, name2], roundsWon, roundsPlayed, winPercent, avgScore }
 * sorted by winPercent descending.
 */
export function calculatePairStats(players, games) {
  const playerMap = new Map(players.map(p => [p.id, p.name]));
  const pairStats = new Map();

  function pairKey(a, b) {
    return [Math.min(a, b), Math.max(a, b)].join('-');
  }

  for (const game of games) {
    for (const round of game.rounds) {
      if (round.score1 === null || round.score2 === null) continue;

      const processTeam = (team, score, won) => {
        const key = pairKey(team[0], team[1]);
        if (!pairStats.has(key)) {
          pairStats.set(key, {
            pair: [Math.min(team[0], team[1]), Math.max(team[0], team[1])],
            roundsWon: 0,
            roundsPlayed: 0,
            totalScore: 0,
          });
        }
        const s = pairStats.get(key);
        s.roundsPlayed++;
        s.totalScore += score;
        if (won) s.roundsWon++;
      };

      const team1Won = round.score1 > round.score2;
      processTeam(round.team1, round.score1, team1Won);
      processTeam(round.team2, round.score2, !team1Won);
    }
  }

  return Array.from(pairStats.values())
    .map(s => ({
      pair: s.pair,
      names: s.pair.map(id => playerMap.get(id) || `Player ${id}`),
      roundsWon: s.roundsWon,
      roundsPlayed: s.roundsPlayed,
      winPercent: s.roundsPlayed > 0 ? Math.round((s.roundsWon / s.roundsPlayed) * 100) : 0,
      avgScore: s.roundsPlayed > 0 ? +(s.totalScore / s.roundsPlayed).toFixed(1) : 0,
    }))
    .sort((a, b) => b.winPercent - a.winPercent || b.roundsWon - a.roundsWon);
}

/**
 * Add a player to the roster. Returns { newPlayer, newPlayers }.
 */
export function addPlayer(players, name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Player name is required');
  }
  const newPlayer = {
    id: Date.now(),
    name: trimmed,
  };
  return {
    newPlayer,
    newPlayers: [...players, newPlayer],
  };
}

/**
 * Serialize state for API save.
 */
export function buildStateForSave(players, games, activeGame, extraFields = {}) {
  return {
    ...extraFields,
    players,
    // We don't include games here to avoid 413 Content Too Large
    // The server will preserve existing games if they are missing in POST
    activeGame: activeGame || null,
  };
}

/**
 * Deserialize state from API response.
 */
export function loadStateFromData(data) {
  const {
    players = [],
    games = [],
    activeGame = null,
    stats = null,
    ...extraFields
  } = data || {};

  return {
    players,
    games,
    activeGame,
    stats,
    extraFields,
  };
}
