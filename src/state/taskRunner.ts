import { streamWriting, streamJudging } from '@/services/llmClient';
import { renderJudgePrompt } from '@/services/promptRender';
import { DEFAULT_WRITING_SYSTEM_PROMPT } from '@/constants/defaultPrompts';
import { useSettingsStore } from './settingsStore';
import { useTaskStore } from './taskStore';

export class TaskRunner {
  private writingControllers = new Map<string, AbortController>();
  private judgingControllers = new Map<string, AbortController>();

  async runWriting(taskId: string): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.current;
    if (!task || task.id !== taskId) {
      throw new Error(`task ${taskId} not loaded`);
    }
    const settings = useSettingsStore.getState().settings;

    const ac = new AbortController();
    this.writingControllers.set(taskId, ac);
    store.setStatus(taskId, 'writing');

    await Promise.allSettled(
      task.candidates.map((c) =>
        this.runOneCandidate(taskId, c.modelId, ac.signal, settings)
      )
    );

    this.writingControllers.delete(taskId);
    useTaskStore.getState().setStatus(taskId, 'writing_done');
    await useTaskStore.getState().flushNow(taskId);
  }

  async retryCandidate(taskId: string, modelId: string): Promise<void> {
    const settings = useSettingsStore.getState().settings;
    const ac = new AbortController();
    // Reuse the same controller key; if a writing run is in progress, this
    // retry rides alongside it (rare, but harmless).
    this.writingControllers.set(taskId + ':' + modelId, ac);
    await this.runOneCandidate(taskId, modelId, ac.signal, settings);
    this.writingControllers.delete(taskId + ':' + modelId);
  }

  private async runOneCandidate(
    taskId: string,
    modelId: string,
    signal: AbortSignal,
    settings: ReturnType<typeof useSettingsStore.getState>['settings']
  ): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.current;
    if (!task) return;
    store.setCandidateStreaming(taskId, modelId);

    try {
      const { fullText } = await streamWriting({
        modelId,
        systemPrompt: DEFAULT_WRITING_SYSTEM_PROMPT,
        userPrompt: task.writingPrompt,
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        signal,
        onChunk: (delta) =>
          useTaskStore.getState().appendDelta(taskId, modelId, delta),
      });
      useTaskStore.getState().markCandidateDone(taskId, modelId, fullText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useTaskStore.getState().markCandidateError(taskId, modelId, msg);
    }
  }

  cancelWriting(taskId: string): void {
    this.writingControllers.get(taskId)?.abort();
  }

  async runJudging(taskId: string): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.current;
    if (!task || task.id !== taskId) throw new Error(`task ${taskId} not loaded`);
    const settings = useSettingsStore.getState().settings;

    const ac = new AbortController();
    this.judgingControllers.set(taskId, ac);
    const startedAt = Date.now();
    store.startJudgeStream(taskId);

    const renderedPrompt = renderJudgePrompt(
      task.judgePrompt,
      task.writingPrompt,
      task.candidates
    );

    try {
      const { fullText } = await streamJudging({
        judgeModelId: task.judgeModel,
        judgePrompt: renderedPrompt,
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        signal: ac.signal,
        onChunk: (delta) =>
          useTaskStore.getState().appendJudgeDelta(taskId, delta),
      });
      useTaskStore.getState().setJudgeResult(taskId, {
        rawMarkdown: fullText,
        renderedAt: startedAt,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useTaskStore.getState().setJudgeResult(taskId, {
        rawMarkdown: useTaskStore.getState().current?.judgeResult?.rawMarkdown ?? '',
        renderedAt: startedAt,
        durationMs: Date.now() - startedAt,
        error: msg,
      });
    } finally {
      this.judgingControllers.delete(taskId);
    }
  }

  cancelJudging(taskId: string): void {
    this.judgingControllers.get(taskId)?.abort();
  }
}

/** Singleton: only one runner across the app. */
export const taskRunner = new TaskRunner();
