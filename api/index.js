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

// ===== AWS S3 =====
import {S3Client, GetObjectCommand, PutObjectCommand} from '@aws-sdk/client-s3';

const s3 = new S3Client({
    region: process.env.AWS_REGION, credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});


const BUCKET = process.env.S3_BUCKET;
const KEY = 'data.json';

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
        const data = await s3.send(new GetObjectCommand({Bucket: BUCKET, Key: KEY}));
        const bodyString = await data.Body.transformToString();
        res.setHeader('Content-Type', 'application/json');
        res.send(bodyString);
    } catch (err) {
        console.error('Failed to load initial state', err);
        return res.status(500).send(err.message);
    }
});

app.post('/api/state', async (req, res) => {
    const body = JSON.stringify(req.body, null, 2);
    await s3.send(new PutObjectCommand({Bucket: BUCKET, Key: KEY, Body: body}));
    res.json({ok: true});
});

// Export app as default
export default app;
