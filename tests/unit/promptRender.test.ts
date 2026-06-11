import { describe, it, expect } from 'vitest';
import { renderJudgePrompt, renderArticlesBlock } from '@/services/promptRender';
import type { Candidate } from '@/types/task';

const baseCandidate = (over: Partial<Candidate>): Candidate => ({
  modelId: 'm',
  alias: '模型 X',
  status: 'done',
  article: '',
  ...over,
});

describe('renderArticlesBlock', () => {
  it('formats successful candidates with alias', () => {
    const cands: Candidate[] = [
      baseCandidate({ alias: '模型 A', article: '文章一' }),
      baseCandidate({ alias: '模型 B', article: '文章二' }),
    ];
    const out = renderArticlesBlock(cands);
    expect(out).toContain('## 模型 A 的作品');
    expect(out).toContain('文章一');
    expect(out).toContain('## 模型 B 的作品');
    expect(out).toContain('文章二');
    expect(out.indexOf('模型 A')).toBeLessThan(out.indexOf('模型 B'));
  });

  it('marks failed candidates explicitly', () => {
    const cands: Candidate[] = [
      baseCandidate({ alias: '模型 A', status: 'error', errorMessage: 'HTTP 500', article: '' }),
    ];
    const out = renderArticlesBlock(cands);
    expect(out).toContain('## 模型 A 的作品');
    expect(out).toContain('（生成失败：HTTP 500）');
  });

  it('marks done-but-empty candidates as failed too', () => {
    const cands: Candidate[] = [
      baseCandidate({ alias: '模型 A', status: 'done', article: '' }),
    ];
    expect(renderArticlesBlock(cands)).toContain('（生成失败');
  });
});

describe('renderJudgePrompt', () => {
  const tpl = '题目：{{writing_prompt}}\n作品：\n{{articles}}\n请评分。';

  it('replaces both placeholders', () => {
    const cands: Candidate[] = [baseCandidate({ alias: '模型 A', article: 'foo' })];
    const out = renderJudgePrompt(tpl, '老去的城市', cands);
    expect(out).toContain('题目：老去的城市');
    expect(out).toContain('## 模型 A 的作品');
    expect(out).toContain('foo');
    expect(out).not.toContain('{{writing_prompt}}');
    expect(out).not.toContain('{{articles}}');
  });

  it('replaces every occurrence of placeholders', () => {
    const t = '{{writing_prompt}} {{writing_prompt}}';
    const out = renderJudgePrompt(t, 'X', []);
    expect(out).toBe('X X');
  });
});
