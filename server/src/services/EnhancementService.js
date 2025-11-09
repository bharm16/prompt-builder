/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a folder structure.
 * The original implementation has been split into:
 * - services/FallbackRegenerationService.js
 * - services/SuggestionProcessor.js
 * - services/StyleTransferService.js
 * - config/schemas.js
 * - config/styleDefinitions.js
 * - EnhancementService.js (main orchestrator)
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { EnhancementService } from './enhancement/index.js';
