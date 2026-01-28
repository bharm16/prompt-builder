import { describe, it, expect } from 'vitest';
import { TriggerValidationService } from '../TriggerValidationService';

describe('TriggerValidationService', () => {
  const service = new TriggerValidationService();

  it('accepts valid triggers', () => {
    const result = service.validate('@Alice');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects triggers without @', () => {
    const result = service.validate('Alice');
    expect(result.isValid).toBe(false);
  });

  it('rejects reserved triggers', () => {
    const result = service.validate('@admin');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('reserved');
  });

  it('normalizes triggers to lowercase', () => {
    expect(service.normalize('@Alice')).toBe('@alice');
  });
});
