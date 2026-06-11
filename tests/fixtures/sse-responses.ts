/** Build a Server-Sent Events response body that streams the given chunks. */
export function buildSSEBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const json = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${json}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

export function buildSSEResponse(chunks: string[]): Response {
  return new Response(buildSSEBody(chunks), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
