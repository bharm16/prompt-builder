import { describe, it, expect } from "vitest";
import {
  extractInputContent,
  extractOutputContent,
  isJudgeable,
} from "../content-extractors.js";

describe("extractInputContent", () => {
  it("projects optimize input fields", () => {
    const event = {
      properties: {
        inputPrompt: "wide shot of a cat",
        targetModel: "sora",
        mode: "creative",
        hasContext: true,
        hasShotPlan: false,
        useConstitutionalAI: true,
        extraneous: "ignored",
      },
    };
    expect(extractInputContent(event, "optimize")).toEqual({
      inputPrompt: "wide shot of a cat",
      targetModel: "sora",
      mode: "creative",
      hasContext: true,
      hasShotPlan: false,
      useConstitutionalAI: true,
    });
  });

  it("projects suggestions input fields", () => {
    const event = {
      properties: {
        highlightedText: "cat",
        fullPrompt: "wide shot of a cat",
        highlightedCategory: "subject",
      },
    };
    expect(extractInputContent(event, "suggestions")).toEqual({
      highlightedText: "cat",
      fullPrompt: "wide shot of a cat",
      highlightedCategory: "subject",
    });
  });

  it("projects span-labeling input fields", () => {
    const event = { properties: { inputText: "wide shot of a cat" } };
    expect(extractInputContent(event, "span-labeling")).toEqual({
      inputText: "wide shot of a cat",
    });
  });
});

describe("extractOutputContent", () => {
  it("projects optimize output", () => {
    const event = { properties: { outputPrompt: "Wide shot, ginger cat..." } };
    expect(extractOutputContent(event, "optimize")).toEqual({
      outputPrompt: "Wide shot, ginger cat...",
    });
  });

  it("projects suggestions output", () => {
    const event = {
      properties: { suggestions: ["tabby cat", "kitten", "feline"] },
    };
    expect(extractOutputContent(event, "suggestions")).toEqual({
      suggestions: ["tabby cat", "kitten", "feline"],
    });
  });

  it("projects span-labeling output", () => {
    const event = {
      properties: {
        spans: [{ text: "wide shot", category: "shot" }],
      },
    };
    expect(extractOutputContent(event, "span-labeling")).toEqual({
      spans: [{ text: "wide shot", category: "shot" }],
    });
  });
});

describe("isJudgeable", () => {
  it("returns false for optimize with null outputPrompt", () => {
    expect(
      isJudgeable({ properties: { outputPrompt: null } }, "optimize"),
    ).toBe(false);
  });

  it("returns false for suggestions with empty array", () => {
    expect(
      isJudgeable({ properties: { suggestions: [] } }, "suggestions"),
    ).toBe(false);
  });

  it("returns false for span-labeling with empty spans", () => {
    expect(isJudgeable({ properties: { spans: [] } }, "span-labeling")).toBe(
      false,
    );
  });

  it("returns true for optimize with a non-empty outputPrompt", () => {
    expect(
      isJudgeable(
        { properties: { outputPrompt: "Wide shot, ginger cat" } },
        "optimize",
      ),
    ).toBe(true);
  });
});
