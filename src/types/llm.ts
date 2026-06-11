export type ModelInfo = {
  id: string;
  label: string;
  family: string;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StreamOptions = {
  modelId: string;
  messages: ChatMessage[];
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
  onChunk: (delta: string) => void;
};
