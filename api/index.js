require('dotenv').config();

const express = require('express');
const fs = require('fs');

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

// ===== Basic Auth =====
const BASIC_USER = process.env.BASIC_USER;
const BASIC_PASS = process.env.BASIC_PASS;

if (!BASIC_USER || !BASIC_PASS) {
    console.error('❌ BASIC_USER or BASIC_PASS not set.');
    process.exit(1);
}

function basicAuth(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Unauthorized');
    }

    const base64 = auth.split(' ')[1];
    const decoded = Buffer.from(base64, 'base64').toString();
    const [user, pass] = decoded.split(':');

    if (user === BASIC_USER && pass === BASIC_PASS) {
        return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Unauthorized');
}

app.use(basicAuth);

// ===== Data file =====
const DATA_FILE = './data.json';
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        players: [],
        championship: {championId: null, challengerId: null, winsInRow: 0}
    }, null, 2));
}

// ===== Routes =====
app.get('/api/state', (req, res) => {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
});

app.post('/api/state', (req, res) => {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(req.body, null, 2)
    );
    res.json({ok: true});
});

module.exports = app;
