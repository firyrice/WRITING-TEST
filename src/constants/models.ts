import type { ModelInfo } from '@/types/llm';

export const MODELS: ModelInfo[] = [
  { id: 'claude-4.7-opus',    label: 'Claude 4.7 Opus',    family: 'claude' },
  { id: 'claude-4.6-sonnet',  label: 'Claude 4.6 Sonnet',  family: 'claude' },
  { id: 'gemini-3.1-pro',     label: 'Gemini 3.1 Pro',     family: 'gemini' },
  { id: 'qwen3.7-max',        label: 'Qwen 3.7 Max',       family: 'qwen' },
  { id: 'qwen3.7-plus',       label: 'Qwen 3.7 Plus',      family: 'qwen' },
  { id: 'deepseek-v4-pro',    label: 'DeepSeek V4 Pro',    family: 'deepseek' },
  { id: 'deepseek-v4-flash',  label: 'DeepSeek V4 Flash',  family: 'deepseek' },
  { id: 'glm-5.1',            label: 'GLM 5.1',            family: 'glm' },
  { id: 'kimi-k2.6',          label: 'Kimi K2.6',          family: 'kimi' },
  { id: 'MiniMax-M2.7',       label: 'MiniMax M2.7',       family: 'minimax' },
  { id: 'mimo-v2.5-pro',      label: 'MiMo V2.5 Pro',      family: 'mimo' },
];

export const DEFAULT_JUDGE_MODEL = 'claude-4.7-opus';

export const MODEL_BY_ID: Record<string, ModelInfo> =
  Object.fromEntries(MODELS.map(m => [m.id, m]));
