import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetEditor } from "../AssetEditor";

/**
 * Regression: AssetEditor must respect preselectedType on mount.
 *
 * When opening "Create style" from the Styles panel, the dialog was showing
 * "Character" as the default type instead of "Style". The AssetEditor's useState
 * initializer was falling back to 'character' when preselectedType wasn't applied
 * on the initial render.
 *
 * Invariant: For any valid preselectedType, the AssetEditor must render with that
 * type selected on first mount, not fall back to 'character'.
 */

vi.mock("@promptstudio/system/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open !== false ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@promptstudio/system/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@promptstudio/system/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

vi.mock("@promptstudio/system/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

vi.mock("../AssetTypeSelector", () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="asset-type-selector" data-value={value}>
      {value}
    </div>
  ),
}));

vi.mock("../ReferenceImageUploader", () => ({
  default: () => <div data-testid="ref-uploader" />,
}));

vi.mock("../ReferenceImageGrid", () => ({
  default: () => <div data-testid="ref-grid" />,
}));

const defaultHandlers = {
  onClose: vi.fn(),
  onCreate: vi.fn().mockResolvedValue({
    id: "1",
    type: "style",
    name: "",
    trigger: "",
    textDefinition: "",
  }),
  onUpdate: vi.fn().mockResolvedValue({
    id: "1",
    type: "style",
    name: "",
    trigger: "",
    textDefinition: "",
  }),
  onAddImage: vi.fn().mockResolvedValue(undefined),
  onDeleteImage: vi.fn().mockResolvedValue(undefined),
  onSetPrimaryImage: vi.fn().mockResolvedValue(undefined),
};

describe("regression: AssetEditor respects preselectedType on mount", () => {
  it("initializes with style type when preselectedType is style", () => {
    render(
      <AssetEditor
        mode="create"
        preselectedType="style"
        {...defaultHandlers}
      />,
    );

    const selector = screen.getByTestId("asset-type-selector");
    expect(selector).toHaveAttribute("data-value", "style");
  });

  it("initializes with character type when no preselectedType is provided", () => {
    render(<AssetEditor mode="create" {...defaultHandlers} />);

    const selector = screen.getByTestId("asset-type-selector");
    expect(selector).toHaveAttribute("data-value", "character");
  });
});
