import { describe, it, expect } from "vitest";

import { getEnhancementSchema } from "../enhancement";

describe("getEnhancementSchema regression", () => {
  // Bug 2026-05-15: Sub-project B's Groq schema marked scene_summary as
  // required, but Groq's json_object mode (used by Qwen) does not honor
  // required-arrays the way OpenAI strict mode does. Our own
  // validateStructuredOutput rejected ~30% of valid suggestion arrays
  // because Qwen dropped the field. The invariant: Groq schema declares
  // scene_summary in properties (documentation) but NOT in required —
  // the prompt drives emission and the engine tolerates absence.
  it("does not require scene_summary in the Groq schema", () => {
    const groqSchema = getEnhancementSchema({ provider: "groq" });
    expect(groqSchema.type).toBe("object");
    expect(groqSchema.required).toEqual(["suggestions"]);
    expect(groqSchema.properties?.scene_summary).toBeDefined();
  });

  // OpenAI strict mode honors required-arrays via grammar-constrained
  // decoding — the model literally cannot emit output missing the field.
  // Sub-project B's mechanism (forcing scene_summary first) works as
  // designed for OpenAI, so the field stays required.
  it("requires scene_summary in the OpenAI strict schema", () => {
    const openaiSchema = getEnhancementSchema({ provider: "openai" });
    expect(openaiSchema.type).toBe("object");
    expect(openaiSchema.required).toEqual(["scene_summary", "suggestions"]);
    expect(openaiSchema.strict).toBe(true);
  });
});
