import type { CapabilitiesSchema } from '@shared/capabilities';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;

let dynamicRegistry: CapabilitiesRegistry = {};

export const getDynamicCapabilitiesRegistry = (): CapabilitiesRegistry => dynamicRegistry;

export const setDynamicCapabilitiesRegistry = (registry?: CapabilitiesRegistry | null): void => {
  dynamicRegistry = registry ?? {};
};
