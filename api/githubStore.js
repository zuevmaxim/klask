import {Octokit} from '@octokit/rest';
import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const PATH = process.env.GITHUB_PATH;
const BRANCH = process.env.GITHUB_BRANCH || 'master';

export async function readState() {
    try {
        const res = await octokit.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: PATH,
            ref: BRANCH
        });

        const content = Buffer
            .from(res.data.content, 'base64')
            .toString('utf-8');

        return {
            data: JSON.parse(content),
            sha: res.data.sha
        };
    } catch (err) {
        if (err.status === 404) {
            return { data: null, sha: null };
        }
        throw err;
    }
}

export async function writeState(data, sha) {
    const content = Buffer
        .from(JSON.stringify(data, null, 2))
        .toString('base64');

    const payload = {
        owner: OWNER,
        repo: REPO,
        path: PATH,
        message: 'Update Klask state',
        content,
        branch: BRANCH
    };

    // Only include sha if it exists (for updates)
    if (sha) {
        payload.sha = sha;
    }

    await octokit.repos.createOrUpdateFileContents(payload);
}
