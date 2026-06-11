export type TaskStatus =
  | 'idle'
  | 'writing'
  | 'writing_done'
  | 'judging'
  | 'done'
  | 'error';

export type CandidateStatus = 'pending' | 'streaming' | 'done' | 'error';

export type Candidate = {
  modelId: string;
  alias: string;
  status: CandidateStatus;
  article: string;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
};

export type JudgeResult = {
  rawMarkdown: string;
  renderedAt: number;
  durationMs: number;
  error?: string;
};

export type Task = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  status: TaskStatus;
  writingPrompt: string;
  judgePrompt: string;
  judgeModel: string;
  anonymize: boolean;
  candidates: Candidate[];
  judgeResult?: JudgeResult;
};
