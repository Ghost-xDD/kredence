import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

let _model: ChatOpenAI | null = null;

export function getLLM(options?: { temperature?: number }): ChatOpenAI {
  if (!process.env["OPENAI_API_KEY"]) {
    throw new Error("OPENAI_API_KEY env var is not set");
  }
  if (_model) return _model;
  _model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: options?.temperature ?? 0.1,
  });
  return _model;
}

/**
 * Call the LLM and parse the response into a Zod-typed structure.
 * Uses LangChain's withStructuredOutput for reliable JSON extraction.
 */
export async function structuredLLMCall<T extends z.ZodTypeAny>(params: {
  schema: T;
  schemaName: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<z.infer<T>> {
  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: params.temperature ?? 0.1,
    apiKey: process.env["OPENAI_API_KEY"],
  });

  const structured = llm.withStructuredOutput(params.schema, {
    name: params.schemaName,
  });

  return structured.invoke([
    { role: "system", content: params.system },
    { role: "user", content: params.user },
  ]);
}
