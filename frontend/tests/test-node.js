// Node.js test runner for game logic
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and run in a way that makes functions available globally
const gameLogicCode = readFileSync(join(__dirname, '../js/game-logic.js'), 'utf8');
const testsCode = readFileSync(join(__dirname, 'game-logic.test.js'), 'utf8');

// Combine and evaluate in global context - return the result of runTests()
const combinedCode = `
${gameLogicCode}
${testsCode}
return runTests();
`;

// Use Function constructor to run in global scope
const testRunner = new Function(combinedCode);
try {
    const success = testRunner();
    process.exit(success ? 0 : 1);
} catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
}
