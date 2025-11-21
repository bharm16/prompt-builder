import { logger } from '../../../infrastructure/Logger.js';

/**
 * Repository for managing video concept templates.
 * Handles template saving, loading, and recommendations.
 * 
 * Renamed from TemplateManagerService to follow repository pattern naming.
 *
 * Future improvements:
 * - Add database persistence
 * - Implement template sharing between users
 * - Add template categorization and tagging
 * - Support template versioning
 */
export class VideoTemplateRepository {
  constructor(options = {}) {
    // Storage adapter - currently in-memory, easily swappable
    this.storage = options.storage || new InMemoryTemplateStorage();
  }

  /**
   * Save template for reuse
   */
  async saveTemplate({ name, elements, concept, userId }) {
    logger.info('Saving template', { name, userId });

    try {
      const template = {
        id: Date.now().toString(),
        name,
        elements,
        concept,
        userId,
        createdAt: new Date().toISOString(),
        usageCount: 0,
      };

      await this.storage.save(template);

      return { template, success: true };
    } catch (error) {
      logger.error('Failed to save template', { name, userId, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId) {
    try {
      return await this.storage.get(templateId);
    } catch (error) {
      logger.error('Failed to get template', { templateId, error });
      return null;
    }
  }

  /**
   * Get all templates for a user
   */
  async getUserTemplates(userId) {
    try {
      return await this.storage.getByUser(userId);
    } catch (error) {
      logger.error('Failed to get user templates', { userId, error });
      return [];
    }
  }

  /**
   * Get template recommendations based on usage
   */
  async getTemplateRecommendations({ userId, currentElements }) {
    logger.info('Getting template recommendations', { userId });

    try {
      const templates = await this.storage.getByUser(userId);

      // Sort by usage count and return top 5
      const recommendations = templates
        .filter(t => t.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5);

      return { recommendations };
    } catch (error) {
      logger.error('Failed to get template recommendations', { userId, error });
      return { recommendations: [] };
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsageCount(templateId) {
    try {
      await this.storage.incrementUsage(templateId);
      logger.info('Incremented template usage', { templateId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to increment usage', { templateId, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId, userId) {
    try {
      const template = await this.storage.get(templateId);

      // Verify ownership
      if (template && template.userId !== userId) {
        logger.warn('Unauthorized template deletion attempt', { templateId, userId });
        return { success: false, error: 'Unauthorized' };
      }

      await this.storage.delete(templateId);
      logger.info('Deleted template', { templateId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete template', { templateId, error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId, updates, userId) {
    try {
      const template = await this.storage.get(templateId);

      // Verify ownership
      if (template && template.userId !== userId) {
        logger.warn('Unauthorized template update attempt', { templateId, userId });
        return { success: false, error: 'Unauthorized' };
      }

      const updatedTemplate = {
        ...template,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await this.storage.update(templateId, updatedTemplate);
      logger.info('Updated template', { templateId });
      return { template: updatedTemplate, success: true };
    } catch (error) {
      logger.error('Failed to update template', { templateId, error });
      return { success: false, error: error.message };
    }
  }
}

/**
 * In-memory template storage adapter
 * Replace with DatabaseTemplateStorage when adding persistence
 */
class InMemoryTemplateStorage {
  constructor() {
    this.templates = new Map();
  }

  async save(template) {
    this.templates.set(template.id, template);
    return template;
  }

  async get(templateId) {
    return this.templates.get(templateId) || null;
  }

  async getByUser(userId) {
    return Array.from(this.templates.values())
      .filter(t => t.userId === userId);
  }

  async update(templateId, template) {
    this.templates.set(templateId, template);
    return template;
  }

  async delete(templateId) {
    this.templates.delete(templateId);
  }

  async incrementUsage(templateId) {
    const template = this.templates.get(templateId);
    if (template) {
      template.usageCount++;
      this.templates.set(templateId, template);
    }
  }
}

/**
 * Example database storage adapter (for future implementation)
 *
 * class DatabaseTemplateStorage {
 *   constructor(dbConnection) {
 *     this.db = dbConnection;
 *   }
 *
 *   async save(template) {
 *     const result = await this.db.query(
 *       'INSERT INTO templates (id, name, elements, concept, user_id, created_at, usage_count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
 *       [template.id, template.name, JSON.stringify(template.elements), template.concept, template.userId, template.createdAt, template.usageCount]
 *     );
 *     return result.rows[0];
 *   }
 *
 *   async get(templateId) {
 *     const result = await this.db.query('SELECT * FROM templates WHERE id = $1', [templateId]);
 *     return result.rows[0] || null;
 *   }
 *
 *   // ... other methods
 * }
 */

