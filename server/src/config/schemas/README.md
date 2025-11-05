# Validation Schemas

This directory contains all Joi validation schemas and LLM output schema expectations, organized by domain.

## Organization

### promptSchemas.js
Validation schemas for prompt optimization and parsing requests:
- `promptSchema` - Main prompt optimization request
- `generateQuestionsSchema` - Question generation request
- `semanticParseSchema` - Semantic text parsing request

### suggestionSchemas.js
Validation schemas for enhancement suggestion requests:
- `suggestionSchema` - Main enhancement suggestion request
- `customSuggestionSchema` - Custom suggestion request
- `sceneChangeSchema` - Scene change detection request

### videoSchemas.js
Validation schemas for video concept and creative workflow requests:
- `creativeSuggestionSchema` - Creative element suggestions
- `videoValidationSchema` - Video element validation
- `completeSceneSchema` - Scene completion request
- `variationsSchema` - Variation generation request
- `parseConceptSchema` - Concept parsing request
- `saveTemplateSchema` - Template saving request
- `templateRecommendationsSchema` - Template recommendations request
- `recordUserChoiceSchema` - User choice tracking
- `alternativePhrasingsSchema` - Alternative phrasing request

### outputSchemas.js
Lightweight JSON Schema-inspired shapes for LLM response expectations:
- `compatibilityOutputSchema` - Compatibility check response
- `variationsOutputSchema` - Variations response
- `parseConceptOutputSchema` - Concept parsing response
- `conflictsOutputSchema` - Conflicts detection response
- `technicalParamsOutputSchema` - Technical parameters response
- `validatePromptOutputSchema` - Prompt validation response
- And more...

## Usage

### Importing Schemas

**Recommended (direct import from organized files):**
```javascript
import { promptSchema, suggestionSchema } from '../../config/schemas/index.js';
```

**Legacy (backward compatible):**
```javascript
import { promptSchema, suggestionSchema } from '../../utils/validation.js';
```

### Adding New Schemas

1. Add the schema to the appropriate file (promptSchemas.js, suggestionSchemas.js, etc.)
2. Export it from that file
3. Re-export it from `index.js` in this directory
4. (Optional) Add it to the backward compatibility exports in `utils/validation.js`

### Example

```javascript
// In promptSchemas.js
export const myNewSchema = Joi.object({
  field: Joi.string().required(),
});

// In index.js
export { myNewSchema } from './promptSchemas.js';

// In utils/validation.js (for backward compatibility)
export { myNewSchema } from '../config/schemas/index.js';
```

## Migration Notes

Schemas were moved from `server/src/utils/validation.js` to this organized structure for:
- **Better organization** - Schemas grouped by domain
- **Easier maintenance** - Find and update related schemas together
- **Clear separation** - Configuration (schemas) separated from utils
- **Backward compatibility** - Old imports still work via re-exports

The original `utils/validation.js` file now acts as a re-export shim for backward compatibility.

