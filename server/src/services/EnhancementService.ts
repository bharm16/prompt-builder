/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a folder structure.
 * The original implementation has been split into:
 * - services/FallbackRegenerationService.ts
 * - services/SuggestionProcessor.ts
 * - services/StyleTransferService.ts
 * - config/schemas.ts
 * - config/styleDefinitions.ts
 * - EnhancementService.ts (main orchestrator)
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { EnhancementService } from './enhancement/index.js';

