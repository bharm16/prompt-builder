/**
 * Enhancement Service - Barrel Exports
 * Provides backward compatibility and clean imports
 */

export { EnhancementService } from './EnhancementService.js';

// Export specialized services for advanced usage
export { FallbackRegenerationService } from './services/FallbackRegenerationService.js';
export { SuggestionProcessor } from './services/SuggestionProcessor.js';
export { StyleTransferService } from './services/StyleTransferService.js';

// Export configuration
export * from './config/schemas.js';
export * from './config/styleDefinitions.js';

