import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY env var is not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Call the LLM with a system + user prompt, returning a structured JSON response.
 * Uses gpt-4o with JSON mode for reliable structured output.
 */
export async function structuredLLMCall<T>(params: {
  system: string;
  user: string;
  model?: string;
}): Promise<T> {
  const client = getLLMClient();

  const response = await client.chat.completions.create({
    model: params.model ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: 0.1, // low temperature for consistent structured output
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");

  return JSON.parse(content) as T;
}
