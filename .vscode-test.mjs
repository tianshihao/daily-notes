import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@vscode/test-cli';

const workspaceFolder = realpathSync(mkdtempSync(join(tmpdir(), 'daily-notes-tests-')));
process.once('exit', () => rmSync(workspaceFolder, { recursive: true, force: true, maxRetries: 3 }));

export default defineConfig({
	workspaceFolder,
	version: '1.90.0',
	files: 'out/test/**/*.test.js',
});
