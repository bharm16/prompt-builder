import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@shared/types/asset";
import { StylesPanel } from "../StylesPanel";

vi.mock(
  "@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail",
  () => ({
    AssetThumbnail: ({
      asset,
      onInsert,
      onEdit,
    }: {
      asset: Asset;
      onInsert: () => void;
      onEdit: () => void;
    }) => (
      <div data-testid={`style-asset-${asset.id}`}>
        <span>{asset.name}</span>
        <button type="button" onClick={onInsert}>
          Insert {asset.name}
        </button>
        <button type="button" onClick={onEdit}>
          Edit {asset.name}
        </button>
      </div>
    ),
  }),
);

const buildStyleAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: "style-1",
  userId: "user-1",
  type: "style",
  trigger: "neo-noir",
  name: "Neo Noir",
  textDefinition: "contrast-heavy cinematic night lighting",
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

describe("StylesPanel", () => {
  it("renders style assets and forwards insert/edit actions", () => {
    const onInsertTrigger = vi.fn();
    const onEditAsset = vi.fn();

    render(
      <StylesPanel
        styleAssets={[buildStyleAsset()]}
        onInsertTrigger={onInsertTrigger}
        onEditAsset={onEditAsset}
      />,
    );

    expect(screen.getByText("Neo Noir")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Insert Neo Noir" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Neo Noir" }));

    expect(onInsertTrigger).toHaveBeenCalledWith("neo-noir");
    expect(onEditAsset).toHaveBeenCalledWith("style-1");
  });

  it("offers style creation when no style assets exist", () => {
    const onCreateAsset = vi.fn();

    render(<StylesPanel styleAssets={[]} onCreateAsset={onCreateAsset} />);

    expect(screen.getByText("No styles yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create style" }));

    expect(onCreateAsset).toHaveBeenCalledWith("style");
  });
});
