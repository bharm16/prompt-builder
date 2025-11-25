import { logger } from '../../../../infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '../../../../utils/StructuredOutputEnforcer.js';
import { conflictsOutputSchema } from '../../../../utils/validation.js';
import {
  detectDescriptorCategory,
} from '../../config/descriptorCategories.js';

const SUBJECT_DESCRIPTOR_KEYS = ['subjectDescriptor1', 'subjectDescriptor2', 'subjectDescriptor3'];

/**
 * Service responsible for detecting conflicts and inconsistencies
 * between video elements, including descriptor category conflicts.
 */
export class ConflictDetectionService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Detect conflicts between elements
   */
  async detectConflicts({ elements }) {
    logger.info('Detecting element conflicts');

    const filledElements = Object.entries(elements).filter(([_, v]) => v);

    if (filledElements.length < 2) {
      return { conflicts: [] };
    }

    // Detect descriptor categories for enhanced conflict detection
    const descriptors = SUBJECT_DESCRIPTOR_KEYS
      .map(key => ({ key, value: elements[key] }))
      .filter(d => d.value);

    const descriptorCategories = descriptors.map(desc => ({
      ...desc,
      detection: detectDescriptorCategory(desc.value)
    }));

    // Build enhanced element list with descriptor categories
    const elementsList = filledElements.map(([k, v]) => {
      const descriptorInfo = descriptorCategories.find(d => d.key === k);
      if (descriptorInfo && descriptorInfo.detection.category) {
        return `${k} (${descriptorInfo.detection.category} category): ${v}`;
      }
      return `${k}: ${v}`;
    }).join('\n');

    const prompt = `Analyze these video elements for logical conflicts or inconsistencies.

Elements:
${elementsList}

Identify any:
1. Logical impossibilities (e.g., underwater + flying)
2. Stylistic clashes (e.g., vintage style + futuristic setting)
3. Thematic inconsistencies
4. Physical contradictions
5. Descriptor category conflicts (e.g., wardrobe + props that don't match era)

Return ONLY a JSON array of conflicts (empty array if none):
[
  {
    "elements": ["element1", "element2"],
    "severity": "high|medium|low",
    "message": "Description of conflict",
    "resolution": "Suggested fix"
  }
]`;

    try {
      const conflicts = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_conflict_detection',
          schema: conflictsOutputSchema,
          isArray: true,
          maxTokens: 512,
          temperature: 0.3,
        }
      );

      // Check for descriptor-specific conflicts
      const descriptorConflicts = this.checkDescriptorCategoryConflicts(descriptorCategories);

      // Combine all conflicts
      const allConflicts = [...conflicts, ...descriptorConflicts];

      return { conflicts: allConflicts };
    } catch (error) {
      logger.error('Failed to detect conflicts', { error });
      return { conflicts: [] };
    }
  }

  /**
   * Check for conflicts between descriptor categories
   * @private
   */
  checkDescriptorCategoryConflicts(descriptorCategories) {
    const conflicts = [];

    // Check for conflicting categories in descriptors
    for (let i = 0; i < descriptorCategories.length; i++) {
      for (let j = i + 1; j < descriptorCategories.length; j++) {
        const desc1 = descriptorCategories[i];
        const desc2 = descriptorCategories[j];

        if (!desc1.detection.category || !desc2.detection.category) continue;

        // Check for contradictions (e.g., "wearing formal tuxedo" + "barefoot")
        const value1Lower = desc1.value.toLowerCase();
        const value2Lower = desc2.value.toLowerCase();

        // Wardrobe conflicts
        if (desc1.detection.category === 'wardrobe' && desc2.detection.category === 'wardrobe') {
          if ((value1Lower.includes('formal') || value1Lower.includes('tuxedo') || value1Lower.includes('suit')) &&
              (value2Lower.includes('casual') || value2Lower.includes('torn') || value2Lower.includes('ragged'))) {
            conflicts.push({
              elements: [desc1.key, desc2.key],
              severity: 'medium',
              message: `Wardrobe style mismatch: formal clothing with casual/worn elements`,
              resolution: `Choose a consistent wardrobe style (all formal or all casual)`
            });
          }
        }

        // Era conflicts
        const hasModernTerms1 = value1Lower.includes('modern') || value1Lower.includes('contemporary') || value1Lower.includes('digital');
        const hasModernTerms2 = value2Lower.includes('modern') || value2Lower.includes('contemporary') || value2Lower.includes('digital');
        const hasVintageTerms1 = value1Lower.includes('vintage') || value1Lower.includes('antique') || value1Lower.includes('old-fashioned');
        const hasVintageTerms2 = value2Lower.includes('vintage') || value2Lower.includes('antique') || value2Lower.includes('old-fashioned');

        if ((hasModernTerms1 && hasVintageTerms2) || (hasVintageTerms1 && hasModernTerms2)) {
          conflicts.push({
            elements: [desc1.key, desc2.key],
            severity: 'low',
            message: `Era mismatch: mixing modern and vintage elements`,
            resolution: `Consider if the era mix is intentional (e.g., steampunk) or should be unified`
          });
        }
      }
    }

    return conflicts;
  }
}
