import { useState } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { PromptEditor } from '@/components/PromptEditor';
import { MODELS } from '@/constants/models';
import { DEFAULT_JUDGE_PROMPT } from '@/constants/defaultPrompts';
import { maskApiKey } from '@/lib/format';

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [reveal, setReveal] = useState(false);
  const [draft, setDraft] = useState(settings);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold">设置</h1>

      <section>
        <label className="text-sm font-medium">API Key</label>
        <div className="flex gap-2 mt-1">
          <input
            type={reveal ? 'text' : 'password'}
            className="flex-1 h-10 rounded border border-gray-300 px-3 text-sm font-mono"
            value={reveal ? draft.apiKey : maskApiKey(draft.apiKey)}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder="bsk-xxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <Button variant="secondary" onClick={() => setReveal((v) => !v)}>
            {reveal ? '隐藏' : '显示'}
          </Button>
          <Button variant="ghost" onClick={() => setDraft({ ...draft, apiKey: '' })}>清除</Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          留空则使用环境变量 VITE_LLM_API_KEY。本字段会保存到浏览器 localStorage。
        </p>
      </section>

      <section>
        <label className="text-sm font-medium">API Base URL</label>
        <input
          className="w-full h-10 rounded border border-gray-300 px-3 text-sm font-mono mt-1"
          value={draft.apiBaseUrl}
          onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
        />
      </section>

      <section>
        <PromptEditor
          label="默认评测 Prompt"
          value={draft.defaultJudgePrompt}
          onChange={(v) => setDraft({ ...draft, defaultJudgePrompt: v })}
          rows={12}
          onResetDefault={() => setDraft({ ...draft, defaultJudgePrompt: DEFAULT_JUDGE_PROMPT })}
        />
      </section>

      <section>
        <label className="text-sm font-medium">默认评测者模型</label>
        <Select
          className="mt-1"
          value={draft.defaultJudgeModel}
          onChange={(e) => setDraft({ ...draft, defaultJudgeModel: e.target.value })}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </Select>
      </section>

      <section>
        <Checkbox
          label="默认开启匿名评测"
          checked={draft.defaultAnonymize}
          onChange={(e) => setDraft({ ...draft, defaultAnonymize: e.target.checked })}
        />
      </section>

      <div className="flex gap-2">
        <Button onClick={() => update(draft)}>保存</Button>
        <Button variant="ghost" onClick={() => setDraft(settings)}>重置</Button>
      </div>
    </div>
  );
}
