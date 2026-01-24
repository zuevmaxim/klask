import express from 'express';
import dotenv from 'dotenv';

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
app.get('/api/state', async (req, res) => {
    try {
        const data = await s3.send(new GetObjectCommand({Bucket: BUCKET, Key: KEY}));
        res.json(JSON.parse(data.Body.toString('utf-8')));
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
