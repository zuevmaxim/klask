import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import {
    calculateChampionDaysForPeriod,
    calculateHeadToHead,
    calculateStats,
    processMatchResult
} from '../frontend/klask/src/klask/game-logic.js';
import { calculatePlayerStats, calculatePairStats } from '../frontend/klask/src/klask4/game-logic.js';
import { normalizeState, paginateGames, removeGameByDate, stateForClient } from './state-operations.js';

dotenv.config(); // load environment variables

const app = express();
app.use(express.json());

// ===== CORS =====
app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ===== Check if LOCAL_MODE is enabled =====
const LOCAL_MODE = process.env.LOCAL_MODE === 'true';

// ===== Authentication =====
const BASIC_USER = process.env.BASIC_USER;
const BASIC_PASS = process.env.BASIC_PASS;
const JWT_SECRET = process.env.JWT_SECRET;

if (!BASIC_USER || !BASIC_PASS) {
    console.error('❌ BASIC_USER or BASIC_PASS not set.');
    process.exit(1);
}

if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

function basicAuth(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Unauthorized');
    }

    try {
        const base64 = auth.substring(6);
        const decoded = Buffer.from(base64, 'base64').toString();
        const [user, pass] = decoded.split(':');

        if (user === BASIC_USER && pass === BASIC_PASS) {
            return next();
        }
    } catch (err) {
        // Invalid base64 or malformed header
    }

    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Unauthorized');
}

// Combined auth: JWT first, then fall back to Basic Auth
function auth(req, res, next) {
    const authHeader = req.headers.authorization;

    // Try JWT token first
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            jwt.verify(token, JWT_SECRET);
            return next(); // Token valid
        } catch (err) {
            // Token invalid/expired, try basic auth
        }
    }

    // Fall back to Basic Auth (for initial login)
    return basicAuth(req, res, next);
}

// ===== Storage (GitHub or Local) =====
let readState, writeState;
let readStateKlask4, writeStateKlask4;

if (LOCAL_MODE) {
    console.log('✅ Running in LOCAL_MODE (no GitHub auth required)');
    const localStore = await import('./localStore.js');
    const localStoreKlask4 = await import('./localStoreKlask4.js');
    readState = localStore.readState;
    writeState = localStore.writeState;
    readStateKlask4 = localStoreKlask4.readState;
    writeStateKlask4 = localStoreKlask4.writeState;
} else {
    console.log('✅ Running with GitHub storage');
    const githubStoreFactory = await import('./githubStore.js');

    // Validate required environment variables for GitHub mode
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO || !process.env.GITHUB_PATH) {
        console.error('❌ GitHub environment variables not set: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_PATH');
        process.exit(1);
    }

    const mainStore = githubStoreFactory.createGithubStore(process.env.GITHUB_PATH);
    const klask4Path = process.env.GITHUB_PATH_KLASK4 || 'klask-4-state.json';
    const klask4Store = githubStoreFactory.createGithubStore(klask4Path);
    readState = mainStore.readState;
    writeState = mainStore.writeState;
    readStateKlask4 = klask4Store.readState;
    writeStateKlask4 = klask4Store.writeState;
}

function registerStateRoutes(basePath, readStateFn, writeStateFn, initialState, statsFn, addMatchFn, initializeCause = 'Initialize') {
    app.get(basePath, async (req, res) => {
        try {
            const { data } = await readStateFn();
            const state = normalizeState(initialState, data);
            const stats = statsFn ? statsFn(state) : null;

            if (!data) {
                await writeStateFn(state, null, initializeCause);
            }

            res.json(stateForClient(state, stats));
        } catch (err) {
            console.error(`Failed to load state for ${basePath}`, err);
            return res.status(500).send(err.message);
        }
    });

    app.get(`${basePath}/stats`, async (req, res) => {
        try {
            const { data } = await readStateFn();
            const state = normalizeState(initialState, data);
            const stats = statsFn ? statsFn(state) : null;
            res.json(stats);
        } catch (err) {
            console.error(`Failed to load stats for ${basePath}`, err);
            return res.status(500).send(err.message);
        }
    });

    app.get(`${basePath}/matches`, async (req, res) => {
        try {
            const { data } = await readStateFn();
            const state = normalizeState(initialState, data);
            res.json(paginateGames(state, req.query.page, req.query.limit));
        } catch (err) {
            console.error(`Failed to load matches for ${basePath}`, err);
            return res.status(500).send(err.message);
        }
    });

    app.post(`${basePath}/matches`, async (req, res) => {
        try {
            const { data, sha } = await readStateFn();
            const { cause, ...payload } = req.body;
            const currentState = normalizeState(initialState, data);
            const result = addMatchFn(currentState, payload);
            const stats = statsFn ? statsFn(result.state) : null;

            await writeStateFn(result.state, sha, cause || 'New game');
            res.json({
                ok: true,
                match: result.match,
                state: stateForClient(result.state, stats),
                stats
            });
        } catch (err) {
            console.error(`Failed to save match for ${basePath}`, err);
            return res.status(500).send(err.message);
        }
    });

    app.post(`${basePath}/matches/remove`, async (req, res) => {
        try {
            const { data, sha } = await readStateFn();
            const { date, cause } = req.body;
            const currentState = normalizeState(initialState, data);
            const result = removeGameByDate(currentState, date);
            const stats = statsFn ? statsFn(result.state) : null;

            if (result.removed) {
                await writeStateFn(result.state, sha, cause || 'Remove match');
            }
            res.json({
                ok: true,
                removed: result.removed,
                state: stateForClient(result.state, stats),
                stats
            });
        } catch (err) {
            console.error(`Failed to remove match for ${basePath}`, err);
            return res.status(500).send(err.message);
        }
    });

    app.post(basePath, async (req, res) => {
        try {
            const { data, sha } = await readStateFn();
            const { cause, stats: _derivedStats, ...newState } = req.body;
            const currentState = normalizeState(initialState, data);

            // Merge newState with existing data (especially games)
            const mergedState = {
                ...currentState,
                ...newState,
                // Ensure games are preserved if they are not provided in the POST request
                games: Array.isArray(newState.games) ? newState.games : currentState.games
            };
            const stats = statsFn ? statsFn(mergedState) : null;

            await writeStateFn(mergedState, sha, cause);
            res.json({
                ok: true,
                state: stateForClient(mergedState, stats),
                stats
            });
        } catch (err) {
            console.error(`Failed to save state for ${basePath}`, err);
            return res.status(500).send(err.message);
        }
    });
}

function calculateKlaskStats(data) {
    const headToHead = Object.fromEntries(
        data.players.map((player) => [player.id, calculateHeadToHead(player.id, data)])
    );
    const championshipDurations = Object.fromEntries(
        data.championshipHistory.map((event, index) => {
            const nextEvent = data.championshipHistory[index + 1];
            const endDate = nextEvent ? new Date(nextEvent.date) : new Date();
            const days = event.newChampionId
                ? calculateChampionDaysForPeriod(event.newChampionId, new Date(event.date), endDate, data.games)
                : 0;
            return [event.date, days];
        })
    );

    return {
        playerStats: calculateStats(data),
        headToHead,
        championshipDurations
    };
}

function addKlaskMatch(state, payload) {
    const player1Id = Number(payload.player1Id);
    const player2Id = Number(payload.player2Id);
    const score1 = Number(payload.score1);
    const score2 = Number(payload.score2);

    if (player1Id === player2Id || !state.players.some((player) => player.id === player1Id) || !state.players.some((player) => player.id === player2Id)) {
        throw new Error('A match requires two different known players');
    }
    if (!Number.isInteger(score1) || !Number.isInteger(score2) || (score1 !== 6 && score2 !== 6) || score1 === score2) {
        throw new Error('Invalid match score');
    }

    state.championship = {
        ...state.championship,
        candidate: state.championship.candidate || (state.championship.challengerId
            ? { playerId: state.championship.challengerId, remainingGames: 2 }
            : null)
    };
    const { game } = processMatchResult(player1Id, player2Id, score1, score2, state);
    return { state, match: game };
}

function addKlask4Match(state, match) {
    if (!match || !Array.isArray(match.playerIds) || !Array.isArray(match.rounds) || !match.date) {
        throw new Error('Invalid completed match');
    }

    return {
        state: {
            ...state,
            games: [...state.games, match],
            activeGame: null
        },
        match
    };
}

// ===== Routes =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === BASIC_USER && password === BASIC_PASS) {
        const token = jwt.sign(
            { username, authenticated: true },
            JWT_SECRET,
            { expiresIn: '90d' } // Remember device for 90 days
        );
        return res.json({ token });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
});

app.use(auth);
registerStateRoutes(
    '/api/state',
    readState,
    writeState,
    {
        players: [],
        championship: {
            championId: null,
            challengerId: null
        },
        games: [],
        championshipHistory: []
    },
    calculateKlaskStats,
    addKlaskMatch
);

registerStateRoutes(
    '/api/klask4/state',
    readStateKlask4,
    writeStateKlask4,
    {
        players: [
            { id: 1, name: 'Maks' },
            { id: 2, name: 'Artem' },
            { id: 3, name: 'Vlad' },
            { id: 4, name: 'Dima' }
        ],
        games: [],
        activeGame: null,
        soloMode: {
            games: [],
            activeGame: null
        }
    },
    (data) => ({
        playerStats: calculatePlayerStats(data.players, data.games),
        pairStats: calculatePairStats(data.players, data.games)
    }),
    addKlask4Match
);

// Export app as default
export default app;
