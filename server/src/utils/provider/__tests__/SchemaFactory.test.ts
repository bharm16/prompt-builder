import { describe, expect, it, vi } from 'vitest';

const { enhancementMock, customMock, spanMock, videoMock, shotMock } = vi.hoisted(() => ({
  enhancementMock: vi.fn(() => ({ name: 'enhancement', type: 'object' })),
  customMock: vi.fn(() => ({ name: 'custom', type: 'object' })),
  spanMock: vi.fn(() => ({ name: 'span', type: 'object' })),
  videoMock: vi.fn(() => ({ name: 'video', type: 'object' })),
  shotMock: vi.fn(() => ({ name: 'shot', type: 'object' })),
}));

vi.mock('../schemas/enhancement', () => ({ getEnhancementSchema: enhancementMock }));
vi.mock('../schemas/customSuggestion', () => ({ getCustomSuggestionSchema: customMock }));
vi.mock('../schemas/spanLabeling', () => ({ getSpanLabelingSchema: spanMock }));
vi.mock('../schemas/videoOptimization', () => ({ getVideoOptimizationSchema: videoMock }));
vi.mock('../schemas/shotInterpreter', () => ({ getShotInterpreterSchema: shotMock }));

import SchemaFactory, {
  getCustomSuggestionSchema,
  getEnhancementSchema,
  getShotInterpreterSchema,
  getSpanLabelingSchema,
  getVideoOptimizationSchema,
} from '../SchemaFactory';

describe('SchemaFactory', () => {
  it('re-exports all schema builders', () => {
    expect(getEnhancementSchema).toBe(enhancementMock);
    expect(getCustomSuggestionSchema).toBe(customMock);
    expect(getSpanLabelingSchema).toBe(spanMock);
    expect(getVideoOptimizationSchema).toBe(videoMock);
    expect(getShotInterpreterSchema).toBe(shotMock);
  });

  it('provides default export with same schema builder references', () => {
    expect(SchemaFactory.getEnhancementSchema).toBe(getEnhancementSchema);
    expect(SchemaFactory.getCustomSuggestionSchema).toBe(getCustomSuggestionSchema);
    expect(SchemaFactory.getSpanLabelingSchema).toBe(getSpanLabelingSchema);
    expect(SchemaFactory.getVideoOptimizationSchema).toBe(getVideoOptimizationSchema);
    expect(SchemaFactory.getShotInterpreterSchema).toBe(getShotInterpreterSchema);
  });

  it('invokes wrapped schema builders', () => {
    expect(getEnhancementSchema()).toEqual({ name: 'enhancement', type: 'object' });
    expect(getCustomSuggestionSchema()).toEqual({ name: 'custom', type: 'object' });
    expect(getSpanLabelingSchema()).toEqual({ name: 'span', type: 'object' });
    expect(getVideoOptimizationSchema()).toEqual({ name: 'video', type: 'object' });
    expect(getShotInterpreterSchema()).toEqual({ name: 'shot', type: 'object' });
  });
});
