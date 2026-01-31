import {readFile, writeFile} from 'fs/promises';
import {existsSync} from 'fs';
import path from 'path';

const DATA_FILE = path.resolve(process.cwd(), 'data.json');

export async function readState() {
    try {
        if (!existsSync(DATA_FILE)) {
            return {data: null, sha: null};
        }

        const content = await readFile(DATA_FILE, 'utf-8');
        return {
            data: JSON.parse(content),
            sha: null // Not needed for local storage
        };
    } catch (err) {
        if (err.code === 'ENOENT') {
            return {data: null, sha: null};
        }
        throw err;
    }
}

export async function writeState(data, sha, cause) {
    const content = JSON.stringify(data, null, 2);
    await writeFile(DATA_FILE, content, 'utf-8');
    console.log(`✅ State saved locally: ${cause}`);
}
