import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return readFileSync(path.resolve(here, '../..', relativePath), 'utf8');
}

describe('Design system config guardrails', () => {
  it('does not override PromptStudio token scales in Tailwind config', () => {
    const source = readRepoFile('config/build/tailwind.config.js');

    expect(source).toContain('presets: [promptStudioPreset]');
    expect(source).not.toContain('borderRadius:');
    expect(source).not.toContain('boxShadow:');
    expect(source).not.toContain('daisyui');
  });
});

