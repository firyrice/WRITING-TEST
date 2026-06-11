export class LLMError extends Error {
  constructor(
    public modelId: string,
    public status: number,
    public bodyExcerpt: string,
    message?: string
  ) {
    super(message ?? `LLM ${modelId} HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'LLMError';
  }
}
