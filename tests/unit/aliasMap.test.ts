import { describe, it, expect } from 'vitest';
import { assignAliases, applyAliasReplacement } from '@/services/aliasMap';

describe('assignAliases', () => {
  it('assigns A/B/C... to candidates in order', () => {
    const aliases = assignAliases(['claude-4.7-opus', 'gemini-3.1-pro', 'qwen3.7-max']);
    expect(aliases).toEqual({
      'claude-4.7-opus': '模型 A',
      'gemini-3.1-pro': '模型 B',
      'qwen3.7-max': '模型 C',
    });
  });

  it('returns empty for empty input', () => {
    expect(assignAliases([])).toEqual({});
  });

  it('extends past Z by repeating (AA, BB)', () => {
    const ids = Array.from({ length: 27 }, (_, i) => `m${i}`);
    const map = assignAliases(ids);
    expect(map['m0']).toBe('模型 A');
    expect(map['m25']).toBe('模型 Z');
    expect(map['m26']).toBe('模型 AA');
  });
});

describe('applyAliasReplacement', () => {
  const aliasToLabel: Record<string, string> = {
    '模型 A': 'Claude 4.7 Opus',
    '模型 B': 'Gemini 3.1 Pro',
  };

  it('replaces aliases with model labels in markdown', () => {
    const md = '## 模型 A\n模型 A 写得好。\n## 模型 B\n模型 B 一般。';
    expect(applyAliasReplacement(md, aliasToLabel)).toBe(
      '## Claude 4.7 Opus\nClaude 4.7 Opus 写得好。\n## Gemini 3.1 Pro\nGemini 3.1 Pro 一般。'
    );
  });

  it('does not match longer alias names like 模型 AB', () => {
    const md = '提到 模型 AB 不应被替换';
    const map = { '模型 A': 'Claude' };
    expect(applyAliasReplacement(md, map)).toBe('提到 模型 AB 不应被替换');
  });

  it('matches alias at end of string', () => {
    const map = { '模型 A': 'Claude' };
    expect(applyAliasReplacement('冠军：模型 A', map)).toBe('冠军：Claude');
  });

  it('returns input unchanged when no aliases match', () => {
    expect(applyAliasReplacement('hello world', { '模型 A': 'X' })).toBe('hello world');
  });
});
