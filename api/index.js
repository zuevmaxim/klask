import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

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

if (LOCAL_MODE) {
    console.log('✅ Running in LOCAL_MODE (no GitHub auth required)');
    const localStore = await import('./localStore.js');
    readState = localStore.readState;
    writeState = localStore.writeState;
} else {
    console.log('✅ Running with GitHub storage');
    const githubStore = await import('./githubStore.js');
    readState = githubStore.readState;
    writeState = githubStore.writeState;

    // Validate required environment variables for GitHub mode
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO || !process.env.GITHUB_PATH) {
        console.error('❌ GitHub environment variables not set: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_PATH');
        process.exit(1);
    }
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
app.get('/api/state', async (req, res) => {
    try {
        const { data, sha } = await readState();

        if (!data) {
            const initial = {
                players: [],
                championship: {
                    championId: null,
                    challengerId: null,
                    winsInRow: 0
                }
            };

            await writeState(initial, null, 'Initialize');
            return res.json(initial);
        }

        res.json(data);
    } catch (err) {
        console.error('Failed to load state', err);
        return res.status(500).send(err.message);
    }
});

app.post('/api/state', async (req, res) => {
    try {
        const { sha } = await readState();
        const { cause, ...state } = req.body;
        await writeState(state, sha, cause);
        res.json({ ok: true });
    } catch (err) {
        console.error('Failed to save state', err);
        return res.status(500).send(err.message);
    }
});

// Export app as default
export default app;
