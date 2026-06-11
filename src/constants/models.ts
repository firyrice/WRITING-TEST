import type { ModelInfo } from '@/types/llm';

export const MODELS: ModelInfo[] = [
  { id: 'claude-4.7-opus',    label: 'Claude 4.7 Opus',    family: 'claude' },
  { id: 'claude-4.6-sonnet',  label: 'Claude 4.6 Sonnet',  family: 'claude' },
  { id: 'gemini-3.1-pro',     label: 'Gemini 3.1 Pro',     family: 'gemini' },
  { id: 'qwen3.7-max',        label: 'Qwen 3.7 Max',       family: 'qwen' },
  { id: 'deepseek-v4-pro',    label: 'DeepSeek V4 Pro',    family: 'deepseek' },
  { id: 'glm-5.1',            label: 'GLM 5.1',            family: 'glm' },
  { id: 'kimi-k2.6',          label: 'Kimi K2.6',          family: 'kimi' },
];

export const DEFAULT_JUDGE_MODEL = 'claude-4.7-opus';

export const MODEL_BY_ID: Record<string, ModelInfo> =
  Object.fromEntries(MODELS.map(m => [m.id, m]));
