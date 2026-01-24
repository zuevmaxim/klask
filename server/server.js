require('dotenv').config();

const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

// ===== НАСТРОЙКИ ИЗ ENV =====
const PORT = process.env.PORT || 3000;
const DATA_FILE = './data.json';

const BASIC_USER = process.env.BASIC_USER;
const BASIC_PASS = process.env.BASIC_PASS;

if (!BASIC_USER || !BASIC_PASS) {
    console.error('❌ BASIC_USER или BASIC_PASS не заданы в .env');
    process.exit(1);
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        players: [],
        championship: {
            championId: null,
            challengerId: null,
            winsInRow: 0
        }
    }, null, 2));
    console.log('Created initial data.json');
}

// ===== CORS =====
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // allow any origin
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); // allow headers used by fetch + Basic Auth
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // allow GET/POST
    if (req.method === 'OPTIONS') return res.sendStatus(200); // preflight
    next();
});

// ===== BASIC AUTH =====
function basicAuth(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.sendStatus(401);
    }

    const base64 = auth.split(' ')[1];
    const decoded = Buffer.from(base64, 'base64').toString();
    const [user, pass] = decoded.split(':');

    if (user === BASIC_USER && pass === BASIC_PASS) {
        return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic');
    res.sendStatus(401);
}

// защищаем всё
app.use(basicAuth);

// ===== API =====
app.get('/state', (req, res) => {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
});

app.post('/state', (req, res) => {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(req.body, null, 2)
    );
    res.json({ok: true});
});

// ===== СТАРТ =====
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
