import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeState, paginateGames, removeGameByDate, stateForClient } from './state-operations.ts';

test('normalizes an empty store with a games array and strips games from the client state', () => {
    const state = normalizeState({ players: [], championshipHistory: [], games: [] }, null);
    const clientState = stateForClient(state, { playerStats: [] });

    assert.deepEqual(state.games, []);
    assert.equal('games' in clientState, false);
    assert.deepEqual(clientState.stats, { playerStats: [] });
});

test('paginates newest-first and reports whether another page exists from total and limit', () => {
    const state = {
        games: Array.from({ length: 205 }, (_, index) => ({
            date: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
            index
        }))
    };

    const first = paginateGames(state, 0, 100);
    const third = paginateGames(state, 2, 100);

    assert.equal(first.matches.length, 100);
    assert.equal(first.matches[0].index, 204);
    assert.equal(first.total, 205);
    assert.equal(third.matches.length, 5);
    assert.equal(third.matches[0].index, 4);
});

test('sanitizes pagination parameters', () => {
    const result = paginateGames({ games: [{ date: '2024-01-01T00:00:00Z' }] }, -2, 1000);

    assert.equal(result.page, 0);
    assert.equal(result.limit, 500);
});

test('uses safe fallbacks when stored games and pagination parameters are missing', () => {
    const normalized = normalizeState({ players: [], games: [] }, { players: [{ id: 1 }] });
    const page = paginateGames({}, undefined, 0);
    const removal = removeGameByDate({}, 'missing');

    assert.deepEqual(normalized.games, []);
    assert.deepEqual(page.matches, []);
    assert.equal(page.page, 0);
    assert.equal(page.limit, 1);
    assert.equal(removal.removed, false);
    assert.deepEqual(removal.state, {});
});

test('removes only one matching game', () => {
    const state = {
        games: [
            { date: 'same', score: 1 },
            { date: 'same', score: 2 },
            { date: 'other', score: 3 }
        ]
    };

    const result = removeGameByDate(state, 'same');

    assert.equal(result.removed, true);
    assert.deepEqual(result.state.games.map((game) => game.score), [2, 3]);
    assert.equal(state.games.length, 3);
});
