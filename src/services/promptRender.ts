import type { Candidate } from '@/types/task';

/**
 * Render the `## <alias> 的作品` block for all candidates, in declaration order.
 * Failed or empty-output candidates are emitted with an explicit "生成失败" marker.
 */
export function renderArticlesBlock(candidates: Candidate[]): string {
  return candidates
    .map((c) => {
      const heading = `## ${c.alias} 的作品`;
      const body =
        c.status === 'error' || c.article.trim() === ''
          ? `（生成失败：${c.errorMessage ?? '无内容输出'}）`
          : `<article>\n${c.article}\n</article>`;
      return `${heading}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Render the full judge prompt by substituting {{writing_prompt}} and
 * {{articles}}. Both placeholders are replaced in every occurrence.
 */
export function renderJudgePrompt(
  template: string,
  writingPrompt: string,
  candidates: Candidate[]
): string {
  return template
    .split('{{writing_prompt}}')
    .join(writingPrompt)
    .split('{{articles}}')
    .join(renderArticlesBlock(candidates));
}
