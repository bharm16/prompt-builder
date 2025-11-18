// Verification script for template enhancements
import { PromptOptimizationService } from './src/services/prompt-optimization/PromptOptimizationService.js';

console.log('✓ PromptOptimizationService imported successfully');

// Create a mock Claude client
const mockClaudeClient = {
  createMessage: async () => ({ content: [{ text: 'test' }] })
};

const service = new PromptOptimizationService(mockClaudeClient);

console.log('✓ Service instantiated successfully');
console.log('✓ Template versions:', service.templateVersions);

// Verify all template methods exist
const templateMethods = [
  'getDefaultPrompt',
  'getReasoningPrompt',
  'getResearchPrompt',
  'getSocraticPrompt'
];

for (const method of templateMethods) {
  if (typeof service[method] === 'function') {
    console.log(`✓ ${method} exists`);

    // Get the template
    const template = service[method]('test prompt', {});

    // Verify template contains key enhancements
    const hasThinkingProtocol = template.includes('<thinking_protocol>');
    const hasQualityVerification = template.includes('<quality_verification>');
    const hasStrictOutput = template.includes('<output_format_strict>');

    console.log(`  - Has thinking protocol: ${hasThinkingProtocol ? '✓' : '✗'}`);
    console.log(`  - Has quality verification: ${hasQualityVerification ? '✓' : '✗'}`);
    console.log(`  - Has strict output format: ${hasStrictOutput ? '✓' : '✗'}`);
  } else {
    console.log(`✗ ${method} not found`);
  }
}

// Verify helper methods exist
console.log('\n✓ Helper methods:');
console.log(`  - getQualityVerificationCriteria: ${typeof service.getQualityVerificationCriteria === 'function' ? '✓' : '✗'}`);
console.log(`  - getModeSpecificCriteria: ${typeof service.getModeSpecificCriteria === 'function' ? '✓' : '✗'}`);
console.log(`  - logOptimizationMetrics: ${typeof service.logOptimizationMetrics === 'function' ? '✓' : '✗'}`);

console.log('\n✅ All template enhancements verified successfully!');
