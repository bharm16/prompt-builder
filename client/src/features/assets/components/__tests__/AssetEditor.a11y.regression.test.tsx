/**
 * Regression test: Create style dialog accessibility defects.
 *
 * 1. DialogContent was missing a DialogDescription, triggering
 *    "Missing Description or aria-describedby" warning from Radix UI.
 * 2. Asset type buttons lacked aria-pressed, making selected state
 *    invisible to assistive technology.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetEditor } from "../AssetEditor";
import { AssetTypeSelector } from "../AssetTypeSelector";

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
  DialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <p data-testid="dialog-description" className={className}>
      {children}
    </p>
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

vi.mock("@promptstudio/system/components/ui", () => ({
  User: ({ className }: { className?: string }) => (
    <span className={className}>User</span>
  ),
  Palette: ({ className }: { className?: string }) => (
    <span className={className}>Palette</span>
  ),
  MapPin: ({ className }: { className?: string }) => (
    <span className={className}>MapPin</span>
  ),
  Box: ({ className }: { className?: string }) => (
    <span className={className}>Box</span>
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
    type: "character",
    name: "",
    trigger: "",
    textDefinition: "",
  }),
  onUpdate: vi.fn().mockResolvedValue({
    id: "1",
    type: "character",
    name: "",
    trigger: "",
    textDefinition: "",
  }),
  onAddImage: vi.fn().mockResolvedValue(undefined),
  onDeleteImage: vi.fn().mockResolvedValue(undefined),
  onSetPrimaryImage: vi.fn().mockResolvedValue(undefined),
};

describe("regression: AssetEditor dialog accessibility", () => {
  it("renders a DialogDescription for screen readers", () => {
    render(<AssetEditor mode="create" {...defaultHandlers} />);

    const description = screen.getByTestId("dialog-description");
    expect(description).toBeTruthy();
    expect(description.className).toContain("sr-only");
  });
});

describe("regression: AssetTypeSelector aria-pressed", () => {
  it("sets aria-pressed on the active button", () => {
    render(<AssetTypeSelector value="style" onChange={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    const styleButton = buttons.find((b) => b.textContent?.includes("Style"));
    const characterButton = buttons.find((b) =>
      b.textContent?.includes("Character"),
    );

    expect(styleButton).toHaveAttribute("aria-pressed", "true");
    expect(characterButton).toHaveAttribute("aria-pressed", "false");
  });

  it("wraps buttons in a group with label", () => {
    render(<AssetTypeSelector value="character" onChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Asset type" });
    expect(group).toBeTruthy();
  });
});
