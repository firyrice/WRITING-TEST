import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/state/settingsStore';
import { useTaskStore } from '@/state/taskStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { PromptEditor } from '@/components/PromptEditor';
import { ModelCheckboxGrid } from '@/components/ModelCheckboxGrid';
import { MODELS, DEFAULT_JUDGE_MODEL } from '@/constants/models';
import { DEFAULT_JUDGE_PROMPT } from '@/constants/defaultPrompts';
import { assignAliases } from '@/services/aliasMap';
import { uuid } from '@/lib/id';
import type { Task, Candidate } from '@/types/task';

export function NewTaskPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const saveNew = useTaskStore((s) => s.saveNew);

  const [writingPrompt, setWritingPrompt] = useState(settings.defaultWritingPrompt);
  const [selected, setSelected] = useState<string[]>(settings.defaultSelectedModels);
  const [judgeModel, setJudgeModel] = useState(settings.defaultJudgeModel || DEFAULT_JUDGE_MODEL);
  const [anonymize, setAnonymize] = useState(settings.defaultAnonymize);
  const [judgePrompt, setJudgePrompt] = useState(settings.defaultJudgePrompt);
  const [showJudgePrompt, setShowJudgePrompt] = useState(false);

  const canStart =
    writingPrompt.trim().length > 0 &&
    selected.length > 0 &&
    Boolean(settings.apiKey);

  async function start() {
    const aliases = assignAliases(selected);
    const candidates: Candidate[] = selected.map((id) => ({
      modelId: id,
      alias: aliases[id],
      status: 'pending',
      article: '',
    }));

    const task: Task = {
      id: uuid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: writingPrompt.slice(0, 30),
      status: 'idle',
      writingPrompt,
      judgePrompt,
      judgeModel,
      anonymize,
      candidates,
    };

    updateSettings({
      defaultWritingPrompt: writingPrompt,
      defaultSelectedModels: selected,
      defaultJudgeModel: judgeModel,
      defaultAnonymize: anonymize,
      defaultJudgePrompt: judgePrompt,
    });

    await saveNew(task);
    navigate(`/task/${task.id}?autostart=1`);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold">新建写作测试任务</h1>

      <PromptEditor
        label="写作 Prompt（每个测试者拿到的题目）"
        value={writingPrompt}
        onChange={setWritingPrompt}
        rows={6}
      />

      <section>
        <div className="text-sm font-medium mb-2">选择测试者模型</div>
        <ModelCheckboxGrid selected={selected} onChange={setSelected} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">评测者模型</label>
          <Select
            className="mt-1 w-full"
            value={judgeModel}
            onChange={(e) => setJudgeModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Checkbox
            label="匿名评测（评测者看不到模型真名）"
            checked={anonymize}
            onChange={(e) => setAnonymize(e.target.checked)}
          />
        </div>
      </section>

      <section>
        <button
          className="text-sm text-brand hover:underline"
          onClick={() => setShowJudgePrompt((v) => !v)}
        >
          {showJudgePrompt ? '▾' : '▸'} 评测 Prompt（可自定义）
        </button>
        {showJudgePrompt && (
          <div className="mt-2">
            <PromptEditor
              value={judgePrompt}
              onChange={setJudgePrompt}
              rows={12}
              onResetDefault={() => setJudgePrompt(DEFAULT_JUDGE_PROMPT)}
            />
            <p className="text-xs text-gray-500 mt-1">
              使用 {'{{writing_prompt}}'} 和 {'{{articles}}'} 作为占位符。
            </p>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canStart} onClick={start}>
          开始测试
        </Button>
      </div>
    </div>
  );
}
