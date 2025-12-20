import { logger } from '@infrastructure/Logger';
import type { TemplateStorageAdapter, VideoTemplate } from '../types';

/**
 * In-memory template storage adapter
 * Replace with DatabaseTemplateStorage when adding persistence
 */
class InMemoryTemplateStorage implements TemplateStorageAdapter {
  private templates: Map<string, VideoTemplate> = new Map();

  async save(template: VideoTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  async get(templateId: string): Promise<VideoTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async getByUser(userId: string): Promise<VideoTemplate[]> {
    return Array.from(this.templates.values())
      .filter(t => t.userId === userId);
  }

  async getAll(): Promise<VideoTemplate[]> {
    return Array.from(this.templates.values());
  }

  async update(templateId: string, template: VideoTemplate): Promise<void> {
    this.templates.set(templateId, template);
  }

  async delete(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }

  async incrementUsage(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (template) {
      template.usageCount++;
      this.templates.set(templateId, template);
    }
  }
}

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
  private readonly storage: TemplateStorageAdapter & { incrementUsage?: (templateId: string) => Promise<void>; update?: (templateId: string, template: VideoTemplate) => Promise<void>; delete?: (templateId: string) => Promise<void> };

  constructor(options: { storage?: TemplateStorageAdapter | undefined } = {}) {
    // Storage adapter - currently in-memory, easily swappable
    this.storage = options.storage || new InMemoryTemplateStorage();
  }

  /**
   * Save template for reuse
   */
  async saveTemplate(params: {
    name: string;
    elements: Record<string, string>;
    concept: string;
    userId: string;
  }): Promise<{ template?: VideoTemplate; success: boolean; error?: string }> {
    logger.info('Saving template', { name: params.name, userId: params.userId });

    try {
      const template: VideoTemplate = {
        id: Date.now().toString(),
        name: params.name,
        elements: params.elements,
        concept: params.concept,
        userId: params.userId,
        createdAt: new Date().toISOString(),
        usageCount: 0,
      };

      await this.storage.save(template);

      return { template, success: true };
    } catch (error) {
      logger.error('Failed to save template', error as Error, { name: params.name, userId: params.userId });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<VideoTemplate | null> {
    try {
      return await this.storage.get(templateId);
    } catch (error) {
      logger.error('Failed to get template', error as Error, { templateId });
      return null;
    }
  }

  /**
   * Get all templates for a user
   */
  async getUserTemplates(userId: string): Promise<VideoTemplate[]> {
    try {
      return await this.storage.getByUser(userId);
    } catch (error) {
      logger.error('Failed to get user templates', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get template recommendations based on usage
   */
  async getTemplateRecommendations(params: {
    userId: string;
    currentElements?: Record<string, string>;
  }): Promise<{ recommendations: VideoTemplate[] }> {
    logger.info('Getting template recommendations', { userId: params.userId });

    try {
      const templates = await this.storage.getByUser(params.userId);

      // Sort by usage count and return top 5
      const recommendations = templates
        .filter(t => t.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5);

      return { recommendations };
    } catch (error) {
      logger.error('Failed to get template recommendations', error as Error, { userId: params.userId });
      return { recommendations: [] };
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsageCount(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.storage.incrementUsage) {
        await this.storage.incrementUsage(templateId);
      }
      logger.info('Incremented template usage', { templateId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to increment usage', error as Error, { templateId });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const template = await this.storage.get(templateId);

      // Verify ownership
      if (template && template.userId !== userId) {
        logger.warn('Unauthorized template deletion attempt', { templateId, userId });
        return { success: false, error: 'Unauthorized' };
      }

      if (this.storage.delete) {
        await this.storage.delete(templateId);
      }
      logger.info('Deleted template', { templateId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete template', error as Error, { templateId });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<VideoTemplate>,
    userId: string
  ): Promise<{ template?: VideoTemplate; success: boolean; error?: string }> {
    try {
      const template = await this.storage.get(templateId);

      // Verify ownership
      if (template && template.userId !== userId) {
        logger.warn('Unauthorized template update attempt', { templateId, userId });
        return { success: false, error: 'Unauthorized' };
      }

      const updatedTemplate: VideoTemplate = {
        ...template!,
        ...updates,
        updatedAt: new Date().toISOString(),
      } as VideoTemplate;

      if (this.storage.update) {
        await this.storage.update(templateId, updatedTemplate);
      }
      logger.info('Updated template', { templateId });
      return { template: updatedTemplate, success: true };
    } catch (error) {
      logger.error('Failed to update template', error as Error, { templateId });
      return { success: false, error: (error as Error).message };
    }
  }
}

