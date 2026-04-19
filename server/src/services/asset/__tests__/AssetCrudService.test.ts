import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetCrudService } from "../services/AssetCrudService";

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

function createMockAsset(overrides = {}) {
  return {
    id: "asset-1",
    userId: "user-1",
    type: "character" as const,
    trigger: "hero",
    name: "Hero Character",
    textDefinition: "A brave hero",
    negativePrompt: "",
    referenceImages: [{ url: "https://example.com/img.jpg", isPrimary: true }],
    faceEmbedding: null,
    usageCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createMockRepository() {
  return {
    create: vi.fn().mockResolvedValue(createMockAsset()),
    getById: vi.fn().mockResolvedValue(createMockAsset()),
    getAll: vi.fn().mockResolvedValue([createMockAsset()]),
    getByType: vi
      .fn()
      .mockResolvedValue({ items: [createMockAsset()], hasMore: false }),
    update: vi.fn().mockResolvedValue(createMockAsset()),
    delete: vi.fn().mockResolvedValue(true),
    triggerExists: vi.fn().mockResolvedValue(false),
    incrementUsage: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockTriggerValidation() {
  return {
    validate: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
    normalize: vi.fn().mockImplementation((t: string) => t.toLowerCase()),
  };
}

describe("AssetCrudService", () => {
  let service: AssetCrudService;
  let repository: ReturnType<typeof createMockRepository>;
  let triggerValidation: ReturnType<typeof createMockTriggerValidation>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createMockRepository();
    triggerValidation = createMockTriggerValidation();
    service = new AssetCrudService(
      repository as unknown as ConstructorParameters<
        typeof AssetCrudService
      >[0],
      triggerValidation as unknown as ConstructorParameters<
        typeof AssetCrudService
      >[1],
    );
  });

  describe("createAsset", () => {
    const validPayload = {
      type: "style" as const,
      trigger: "neon",
      name: "Neon Style",
      textDefinition: "Vibrant neon color palette",
    };

    it("creates asset with valid payload", async () => {
      const result = await service.createAsset("user-1", validPayload);

      expect(result).toBeDefined();
      expect(repository.create).toHaveBeenCalledWith("user-1", {
        type: "style",
        trigger: "neon",
        name: "Neon Style",
        textDefinition: "Vibrant neon color palette",
        negativePrompt: "",
      });
    });

    it("rejects invalid asset type", async () => {
      await expect(
        service.createAsset("user-1", {
          ...validPayload,
          type: "invalid" as "style",
        }),
      ).rejects.toThrow("Invalid asset type");
    });

    it("rejects invalid trigger", async () => {
      triggerValidation.validate.mockReturnValue({
        isValid: false,
        errors: ["Trigger must be alphanumeric"],
      });

      await expect(service.createAsset("user-1", validPayload)).rejects.toThrow(
        "Invalid trigger",
      );
    });

    it("rejects duplicate trigger", async () => {
      repository.triggerExists.mockResolvedValue(true);

      await expect(service.createAsset("user-1", validPayload)).rejects.toThrow(
        "already in use",
      );
    });

    it("rejects empty name", async () => {
      await expect(
        service.createAsset("user-1", { ...validPayload, name: "" }),
      ).rejects.toThrow("Asset name is required");
    });

    it("rejects name over 50 characters", async () => {
      await expect(
        service.createAsset("user-1", {
          ...validPayload,
          name: "x".repeat(51),
        }),
      ).rejects.toThrow("50 characters or less");
    });

    it("requires textDefinition for non-character types", async () => {
      await expect(
        service.createAsset("user-1", {
          ...validPayload,
          type: "style",
          textDefinition: "",
        }),
      ).rejects.toThrow("Text definition is required");
    });

    it("allows empty textDefinition for character type", async () => {
      const result = await service.createAsset("user-1", {
        ...validPayload,
        type: "character",
        textDefinition: "",
      });
      expect(result).toBeDefined();
    });

    it("rejects textDefinition over 1000 characters", async () => {
      await expect(
        service.createAsset("user-1", {
          ...validPayload,
          textDefinition: "x".repeat(1001),
        }),
      ).rejects.toThrow("1000 characters or less");
    });

    it("trims name and textDefinition", async () => {
      await service.createAsset("user-1", {
        ...validPayload,
        name: "  Neon Style  ",
        textDefinition: "  Vibrant neon  ",
      });

      expect(repository.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          name: "Neon Style",
          textDefinition: "Vibrant neon",
        }),
      );
    });
  });

  describe("getAsset", () => {
    it("returns asset when found", async () => {
      const result = await service.getAsset("user-1", "asset-1");
      expect(result.id).toBe("asset-1");
    });

    it("throws when asset not found", async () => {
      repository.getById.mockResolvedValue(null);

      await expect(service.getAsset("user-1", "nonexistent")).rejects.toThrow(
        "Asset not found",
      );
    });
  });

  describe("listAssets", () => {
    it("returns assets with type counts", async () => {
      repository.getAll.mockResolvedValue([
        createMockAsset({ type: "character" }),
        createMockAsset({ type: "style", id: "asset-2" }),
        createMockAsset({ type: "character", id: "asset-3" }),
      ]);

      const result = await service.listAssets("user-1");

      expect(result.total).toBe(3);
      expect(result.byType.character).toBe(2);
      expect(result.byType.style).toBe(1);
      expect(result.byType.location).toBe(0);
      expect(result.byType.object).toBe(0);
    });

    it("passes filter options to repository", async () => {
      await service.listAssets("user-1", { limit: 10, type: "style" });

      expect(repository.getAll).toHaveBeenCalledWith("user-1", {
        limit: 10,
        type: "style",
      });
    });
  });

  describe("listAssetsByType", () => {
    it("delegates to repository getByType and returns structured result", async () => {
      const result = await service.listAssetsByType("user-1", "character");

      expect(repository.getByType).toHaveBeenCalledWith(
        "user-1",
        "character",
        200,
      );
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("updateAsset", () => {
    it("updates allowed fields", async () => {
      await service.updateAsset("user-1", "asset-1", {
        name: "Updated Name",
        textDefinition: "Updated definition",
      });

      expect(repository.update).toHaveBeenCalledWith(
        "user-1",
        "asset-1",
        expect.objectContaining({
          name: "Updated Name",
          textDefinition: "Updated definition",
        }),
      );
    });

    it("validates trigger on update", async () => {
      triggerValidation.validate.mockReturnValue({
        isValid: false,
        errors: ["Invalid format"],
      });

      await expect(
        service.updateAsset("user-1", "asset-1", { trigger: "bad!" }),
      ).rejects.toThrow("Invalid trigger");
    });

    it("checks for duplicate trigger on update", async () => {
      repository.triggerExists.mockResolvedValue(true);

      await expect(
        service.updateAsset("user-1", "asset-1", { trigger: "taken" }),
      ).rejects.toThrow("already in use");
    });

    it("rejects empty name on update", async () => {
      await expect(
        service.updateAsset("user-1", "asset-1", { name: "   " }),
      ).rejects.toThrow("cannot be empty");
    });

    it("rejects empty textDefinition for non-character type", async () => {
      repository.getById.mockResolvedValue(createMockAsset({ type: "style" }));

      await expect(
        service.updateAsset("user-1", "asset-1", { textDefinition: "" }),
      ).rejects.toThrow("cannot be empty");
    });

    it("allows empty textDefinition for character type", async () => {
      repository.getById.mockResolvedValue(
        createMockAsset({ type: "character" }),
      );

      await service.updateAsset("user-1", "asset-1", { textDefinition: "" });
      // Should not throw
    });
  });

  describe("deleteAsset", () => {
    it("deletes existing asset", async () => {
      const result = await service.deleteAsset("user-1", "asset-1");
      expect(result).toBe(true);
      expect(repository.delete).toHaveBeenCalledWith("user-1", "asset-1");
    });

    it("throws when asset not found", async () => {
      repository.getById.mockResolvedValue(null);

      await expect(
        service.deleteAsset("user-1", "nonexistent"),
      ).rejects.toThrow("Asset not found");
    });
  });

  describe("getAssetForGeneration", () => {
    it("returns generation data for character with reference images", async () => {
      const result = await service.getAssetForGeneration("user-1", "asset-1");

      expect(result.id).toBe("asset-1");
      expect(result.primaryImageUrl).toBe("https://example.com/img.jpg");
      expect(result.referenceImages).toHaveLength(1);
      expect(repository.incrementUsage).toHaveBeenCalledWith(
        "user-1",
        "asset-1",
      );
    });

    it("throws when character has no reference images", async () => {
      repository.getById.mockResolvedValue(
        createMockAsset({ type: "character", referenceImages: [] }),
      );

      await expect(
        service.getAssetForGeneration("user-1", "asset-1"),
      ).rejects.toThrow("no reference images");
    });

    it("returns null primaryImageUrl when no images exist for non-character", async () => {
      repository.getById.mockResolvedValue(
        createMockAsset({ type: "style", referenceImages: [] }),
      );

      const result = await service.getAssetForGeneration("user-1", "asset-1");
      expect(result.primaryImageUrl).toBeNull();
    });

    it("selects primary image when multiple exist", async () => {
      repository.getById.mockResolvedValue(
        createMockAsset({
          referenceImages: [
            { url: "https://example.com/secondary.jpg", isPrimary: false },
            { url: "https://example.com/primary.jpg", isPrimary: true },
          ],
        }),
      );

      const result = await service.getAssetForGeneration("user-1", "asset-1");
      expect(result.primaryImageUrl).toBe("https://example.com/primary.jpg");
    });
  });
});
