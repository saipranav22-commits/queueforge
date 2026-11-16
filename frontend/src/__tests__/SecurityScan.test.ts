import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Security Scan: Zero Secrets in Client Bundle', () => {
  it('ensures no hardcoded ADMIN_API_KEY values exist in src files', () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const srcDir = path.resolve(currentDir, '..');
    const files: string[] = [];

    function collectFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
          collectFiles(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    }

    collectFiles(srcDir);
    expect(files.length).toBeGreaterThan(5);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Verify no hardcoded API keys exist
      expect(content).not.toContain('qf_dev_admin_secret_key_change_in_prod');
      expect(content).not.toContain('qf_admin_secret_key_');
      expect(content).not.toContain('VITE_ADMIN_API_KEY');
    }
  });
});
