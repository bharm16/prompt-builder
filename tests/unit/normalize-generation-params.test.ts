import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getCapabilitiesMock,
  resolveModelIdMock,
  resolveProviderForModelMock,
  validateCapabilityValuesMock,
  loggerMock,
} = vi.hoisted(() => ({
  getCapabilitiesMock: vi.fn(),
  resolveModelIdMock: vi.fn(),
  resolveProviderForModelMock: vi.fn(),
  validateCapabilityValuesMock: vi.fn(),
  loggerMock: {
    warn: vi.fn(),
  },
}));

vi.mock('@services/capabilities', () => ({
  getCapabilities: getCapabilitiesMock,
  resolveModelId: resolveModelIdMock,
  resolveProviderForModel: resolveProviderForModelMock,
  validateCapabilityValues: validateCapabilityValuesMock,
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: loggerMock,
}));

import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';

describe('normalizeGenerationParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveModelIdMock.mockReturnValue('sora-2');
    resolveProviderForModelMock.mockReturnValue('openai');
    getCapabilitiesMock.mockReturnValue({ id: 'schema' });
    validateCapabilityValuesMock.mockReturnValue({
      ok: true,
      values: { fps: 24 },
      errors: [],
    });
  });

  it('returns null params for non-object payloads', () => {
    const result = normalizeGenerationParams({
      generationParams: 'invalid',
      targetModel: 'sora-2',
      operation: 'optimize',
      requestId: 'req-1',
    });

    expect(result).toEqual({ normalizedGenerationParams: null });
    expect(resolveModelIdMock).not.toHaveBeenCalled();
  });

  it('uses resolved model schema when available', () => {
    const result = normalizeGenerationParams({
      generationParams: { fps: 24 },
      targetModel: 'sora-2',
      operation: 'optimize',
      requestId: 'req-2',
      userId: 'user-1',
    });

    expect(resolveModelIdMock).toHaveBeenCalledWith('sora-2');
    expect(resolveProviderForModelMock).toHaveBeenCalledWith('sora-2');
    expect(getCapabilitiesMock).toHaveBeenNthCalledWith(1, 'openai', 'sora-2');
    expect(getCapabilitiesMock).toHaveBeenNthCalledWith(2, 'openai', 'sora-2');
    expect(validateCapabilityValuesMock).toHaveBeenCalledWith({ id: 'schema' }, { fps: 24 });
    expect(result).toEqual({
      normalizedGenerationParams: { fps: 24 },
    });
  });

  it('falls back to auto capabilities when resolved model is missing', () => {
    getCapabilitiesMock.mockImplementation((provider: string, model: string) => {
      if (provider === 'openai' && model === 'auto') {
        return { id: 'auto-schema' };
      }
      return null;
    });
    validateCapabilityValuesMock.mockReturnValue({
      ok: true,
      values: { duration_s: 6 },
      errors: [],
    });

    const result = normalizeGenerationParams({
      generationParams: { duration_s: 6 },
      targetModel: 'unknown-model',
      operation: 'optimize',
      requestId: 'req-3',
    });

    expect(getCapabilitiesMock).toHaveBeenNthCalledWith(1, 'openai', 'sora-2');
    expect(getCapabilitiesMock).toHaveBeenNthCalledWith(2, 'openai', 'auto');
    expect(result).toEqual({
      normalizedGenerationParams: { duration_s: 6 },
    });
  });

  it('returns a 400 error when no capability schema exists', () => {
    getCapabilitiesMock.mockReturnValue(null);

    const result = normalizeGenerationParams({
      generationParams: { fps: 24 },
      targetModel: 'missing-model',
      operation: 'optimize',
      requestId: 'req-4',
    });

    expect(result).toEqual({
      normalizedGenerationParams: null,
      error: {
        status: 400,
        error: 'Capabilities not found',
        details: 'No registry entry for openai/auto',
      },
    });
    expect(validateCapabilityValuesMock).not.toHaveBeenCalled();
  });

  it('logs validation warnings and returns sanitized values for invalid params', () => {
    validateCapabilityValuesMock.mockReturnValue({
      ok: false,
      values: { fps: 30 },
      errors: ['fps above max'],
    });

    const result = normalizeGenerationParams({
      generationParams: { fps: 999 },
      targetModel: 'sora-2',
      operation: 'optimize',
      requestId: 'req-5',
      userId: 'user-5',
    });

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Invalid generation parameters; falling back to sanitized defaults',
      expect.objectContaining({
        operation: 'optimize',
        requestId: 'req-5',
        userId: 'user-5',
        errors: ['fps above max'],
      })
    );
    expect(result).toEqual({
      normalizedGenerationParams: { fps: 30 },
    });
  });

  it('uses generic provider when model provider cannot be resolved', () => {
    resolveProviderForModelMock.mockReturnValue(null);
    getCapabilitiesMock.mockImplementation((provider: string, model: string) => {
      if (provider === 'generic' && model === 'auto') {
        return { id: 'generic-auto' };
      }
      return null;
    });

    const result = normalizeGenerationParams({
      generationParams: { quality: 'high' },
      operation: 'optimize',
      requestId: 'req-6',
    });

    expect(getCapabilitiesMock).toHaveBeenNthCalledWith(1, 'generic', 'sora-2');
    expect(getCapabilitiesMock).toHaveBeenNthCalledWith(2, 'generic', 'auto');
    expect(result).toEqual({
      normalizedGenerationParams: { fps: 24 },
    });
  });
});
