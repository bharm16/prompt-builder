/**
 * UNIFIED TECHNICAL TAXONOMY
 * The single source of truth for all Video Prompt Builder categories.
 * 
 * HIERARCHY PRINCIPLE:
 * 1. ENTITIES (Subject) - Have attributes (Wardrobe, Action, Appearance)
 * 2. SETTING (Environment, Lighting) - Global scene context
 * 3. TECHNICAL (Camera, Style) - Production parameters
 * 
 * This taxonomy structurally enforces parent-child relationships,
 * preventing "orphaned attributes" (e.g., wardrobe without subject).
 */

export const TAXONOMY = {
  // ============================================================================
  // GROUP 1: THE SUBJECT (ENTITIES)
  // ============================================================================
  
  /**
   * SUBJECT - The focal point of the shot (person, object, animal)
   * Parent category for all subject-related attributes
   */
  SUBJECT: {
    id: 'subject',
    label: 'Subject & Character',
    description: 'The focal point of the shot',
    group: 'entity',
    attributes: {
      /** Core identity: "A cowboy", "An alien" */
      IDENTITY: 'identity',
      
      /** Physical traits: "Weathered face", "Tall", "Athletic build" */
      APPEARANCE: 'appearance',
      
      /** Clothing: "Leather jacket", "Space suit", "Vintage attire" */
      WARDROBE: 'wardrobe',
      
      /** Movement/Activity: "Running", "Sitting", "Leaning against wall" */
      ACTION: 'action',
      
      /** Emotional state: "Stoic expression", "Joyful demeanor" */
      EMOTION: 'emotion',
    }
  },

  // ============================================================================
  // GROUP 2: THE SETTING
  // ============================================================================
  
  /**
   * ENVIRONMENT - Where the scene takes place
   * Spatial and contextual setting information
   */
  ENVIRONMENT: {
    id: 'environment',
    label: 'Environment',
    description: 'Where the scene takes place',
    group: 'setting',
    attributes: {
      /** Physical location: "Diner", "Mars", "Forest" */
      LOCATION: 'location',
      
      /** Weather conditions: "Rainy", "Foggy", "Sunny" */
      WEATHER: 'weather',
      
      /** Environmental context: "Crowded", "Empty", "Abandoned" */
      CONTEXT: 'context',
    }
  },

  /**
   * LIGHTING - Illumination and atmosphere
   * How the scene is lit and the quality of light
   */
  LIGHTING: {
    id: 'lighting',
    label: 'Lighting',
    description: 'Illumination and atmosphere',
    group: 'setting',
    attributes: {
      /** Light source: "Neon sign", "Sun", "Candles" */
      SOURCE: 'lighting_source',
      
      /** Light quality: "Soft", "Hard", "Diffused" */
      QUALITY: 'lighting_quality',
      
      /** Time of day: "Golden hour", "Night", "Dawn" */
      TIME: 'time_of_day',
    }
  },

  // ============================================================================
  // GROUP 3: TECHNICAL & CINEMATOGRAPHY
  // ============================================================================
  
  /**
   * CAMERA - Cinematography and framing
   * How the scene is captured and composed
   */
  CAMERA: {
    id: 'camera',
    label: 'Camera',
    description: 'Cinematography and framing',
    group: 'technical',
    attributes: {
      /** Shot type: "Close-up", "Wide shot", "Medium" */
      FRAMING: 'framing',
      
      /** Camera movement: "Dolly", "Pan", "Static", "Crane" */
      MOVEMENT: 'camera_move',
      
      /** Lens specs: "35mm", "Anamorphic", "Wide angle" */
      LENS: 'lens',
      
      /** Camera angle: "Low angle", "Overhead", "Eye level" */
      ANGLE: 'angle',
    }
  },

  /**
   * STYLE - Visual treatment and aesthetic
   * Overall look and feel of the video
   */
  STYLE: {
    id: 'style',
    label: 'Style & Aesthetic',
    description: 'Visual treatment and medium',
    group: 'technical',
    attributes: {
      /** Aesthetic style: "Cyberpunk", "Noir", "Vintage" */
      AESTHETIC: 'aesthetic',
      
      /** Film medium: "Kodak Portra", "35mm film", "Digital" */
      FILM_STOCK: 'film_stock',
    }
  },

  /**
   * TECHNICAL - Technical specifications
   * Video technical parameters
   */
  TECHNICAL: {
    id: 'technical',
    label: 'Technical Specs',
    description: 'Video technical parameters',
    group: 'technical',
    attributes: {
      /** Aspect ratio: "16:9", "2.39:1", "9:16" */
      ASPECT_RATIO: 'aspect_ratio',
      
      /** Frame rate: "24fps", "30fps", "60fps" */
      FPS: 'frame_rate',
      
      /** Resolution: "4K", "1080p", "8K" */
      RESOLUTION: 'resolution'
    }
  },

  /**
   * AUDIO - Audio and sound design
   * Sound elements in the video
   */
  AUDIO: {
    id: 'audio',
    label: 'Audio',
    description: 'Sound and music elements',
    group: 'technical',
    attributes: {
      /** Music/Score: "Orchestral score", "Ambient music" */
      SCORE: 'score',
      
      /** Sound effects: "Footsteps", "Wind", "Traffic" */
      SFX: 'sound_effect'
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the parent category ID from any category or attribute ID
 * 
 * @param {string} categoryId - Category or attribute ID to look up
 * @returns {string|null} Parent category ID, or null if not found or is top-level
 * 
 * @example
 * getParentCategory('wardrobe') // returns 'subject'
 * getParentCategory('subject') // returns 'subject' (is already parent)
 * getParentCategory('framing') // returns 'camera'
 */
export function getParentCategory(categoryId) {
  if (!categoryId) return null;

  // Check if it's already a top-level category
  for (const [parentKey, parentVal] of Object.entries(TAXONOMY)) {
    if (parentVal.id === categoryId) {
      return parentVal.id; // It's a parent, return itself
    }
  }

  // Search through attributes to find parent
  for (const [parentKey, parentVal] of Object.entries(TAXONOMY)) {
    if (parentVal.attributes) {
      const attributeValues = Object.values(parentVal.attributes);
      if (attributeValues.includes(categoryId)) {
        return parentVal.id; // Found the parent
      }
    }
  }

  return null; // Not found in taxonomy
}

/**
 * Check if a category ID is an attribute (child) rather than a parent
 * 
 * @param {string} categoryId - Category ID to check
 * @returns {boolean} True if it's an attribute, false if parent or not found
 * 
 * @example
 * isAttribute('wardrobe') // true
 * isAttribute('subject') // false
 */
export function isAttribute(categoryId) {
  if (!categoryId) return false;

  // Check if it's a top-level category (parent)
  for (const category of Object.values(TAXONOMY)) {
    if (category.id === categoryId) {
      return false; // It's a parent
    }
  }

  // Check if it's in any attributes
  for (const category of Object.values(TAXONOMY)) {
    if (category.attributes) {
      const attributeValues = Object.values(category.attributes);
      if (attributeValues.includes(categoryId)) {
        return true; // It's an attribute
      }
    }
  }

  return false; // Not found
}

/**
 * Get all attribute IDs across the entire taxonomy
 * 
 * @returns {string[]} Array of all attribute IDs
 * 
 * @example
 * getAllAttributes() // ['identity', 'appearance', 'wardrobe', ...]
 */
export function getAllAttributes() {
  const attributes = [];
  
  for (const category of Object.values(TAXONOMY)) {
    if (category.attributes) {
      attributes.push(...Object.values(category.attributes));
    }
  }
  
  return attributes;
}

/**
 * Get all parent category IDs
 * 
 * @returns {string[]} Array of all parent category IDs
 * 
 * @example
 * getAllParentCategories() // ['subject', 'environment', 'lighting', ...]
 */
export function getAllParentCategories() {
  return Object.values(TAXONOMY).map(cat => cat.id);
}

/**
 * Get category configuration by ID (parent or attribute)
 * 
 * @param {string} categoryId - Category or attribute ID
 * @returns {Object|null} Category config object or null if not found
 * 
 * @example
 * getCategoryById('subject') // { id: 'subject', label: '...', ... }
 * getCategoryById('wardrobe') // { id: 'wardrobe', parent: 'subject', ... }
 */
export function getCategoryById(categoryId) {
  if (!categoryId) return null;

  // Check if it's a parent category
  for (const category of Object.values(TAXONOMY)) {
    if (category.id === categoryId) {
      return category;
    }
  }

  // Check if it's an attribute
  for (const category of Object.values(TAXONOMY)) {
    if (category.attributes) {
      for (const [attrKey, attrValue] of Object.entries(category.attributes)) {
        if (attrValue === categoryId) {
          return {
            id: attrValue,
            parent: category.id,
            isAttribute: true
          };
        }
      }
    }
  }

  return null;
}

/**
 * Get all attributes for a given parent category
 * 
 * @param {string} parentId - Parent category ID
 * @returns {string[]} Array of attribute IDs for that parent
 * 
 * @example
 * getAttributesForParent('subject') // ['identity', 'appearance', 'wardrobe', ...]
 */
export function getAttributesForParent(parentId) {
  if (!parentId) return [];

  for (const category of Object.values(TAXONOMY)) {
    if (category.id === parentId && category.attributes) {
      return Object.values(category.attributes);
    }
  }

  return [];
}

/**
 * Get the group (entity, setting, technical) for a category
 * 
 * @param {string} categoryId - Category or attribute ID
 * @returns {string|null} Group name or null if not found
 * 
 * @example
 * getGroupForCategory('wardrobe') // 'entity'
 * getGroupForCategory('lighting') // 'setting'
 */
export function getGroupForCategory(categoryId) {
  if (!categoryId) return null;

  // If it's a parent, return its group directly
  for (const category of Object.values(TAXONOMY)) {
    if (category.id === categoryId) {
      return category.group;
    }
  }

  // If it's an attribute, find parent and return parent's group
  const parentId = getParentCategory(categoryId);
  if (parentId) {
    for (const category of Object.values(TAXONOMY)) {
      if (category.id === parentId) {
        return category.group;
      }
    }
  }

  return null;
}

