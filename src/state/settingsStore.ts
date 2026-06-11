import { create } from 'zustand';
import type { Settings } from '@/types/settings';
import {
  DEFAULT_JUDGE_PROMPT,
  DEFAULT_WRITING_PROMPT,
} from '@/constants/defaultPrompts';
import { DEFAULT_JUDGE_MODEL, MODELS } from '@/constants/models';

const LS_KEY = 'writing-test:settings';

function readEnv(name: string, fallback: string): string {
  // Vite 的 import.meta.env 在测试环境也存在；缺失就 fallback
  return ((import.meta as any).env?.[name] as string | undefined) ?? fallback;
}

function loadInitial(): Settings {
  const fromEnvKey = readEnv('VITE_LLM_API_KEY', '');
  const fromEnvBase = readEnv('VITE_LLM_BASE_URL', '/api/v1');
  let stored: Partial<Settings> = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (raw) stored = JSON.parse(raw);
  } catch {
    // ignore
  }
  const validIds = new Set(MODELS.map((m) => m.id));
  // 已下线的模型 ID 从已存的设置中清掉，避免拿到不可用的模型
  const sanitizedSelected = (stored.defaultSelectedModels ?? []).filter((id) =>
    validIds.has(id)
  );
  const sanitizedJudge =
    stored.defaultJudgeModel && validIds.has(stored.defaultJudgeModel)
      ? stored.defaultJudgeModel
      : DEFAULT_JUDGE_MODEL;
  return {
    apiKey: stored.apiKey ?? fromEnvKey,
    apiBaseUrl: stored.apiBaseUrl ?? fromEnvBase,
    defaultWritingPrompt: stored.defaultWritingPrompt ?? DEFAULT_WRITING_PROMPT,
    defaultJudgePrompt: stored.defaultJudgePrompt ?? DEFAULT_JUDGE_PROMPT,
    defaultSelectedModels:
      sanitizedSelected.length > 0
        ? sanitizedSelected
        : MODELS.slice(0, 3).map((m) => m.id),
    defaultJudgeModel: sanitizedJudge,
    defaultAnonymize: stored.defaultAnonymize ?? true,
  };
}

function persist(s: Settings) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    }
  } catch {
    // ignore
  }
}

type SettingsStore = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resetJudgePrompt: () => void;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: loadInitial(),
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    persist(next);
    set({ settings: next });
  },
  resetJudgePrompt: () => {
    const next = { ...get().settings, defaultJudgePrompt: DEFAULT_JUDGE_PROMPT };
    persist(next);
    set({ settings: next });
  },
}));
