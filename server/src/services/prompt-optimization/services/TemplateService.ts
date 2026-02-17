import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '@infrastructure/Logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Service for loading and managing prompt templates
 * Centralizes template management and enables easy version control of prompts
 */
export class TemplateService {
  private readonly templateDir: string;
  private readonly templateCache: Map<string, string>;
  private cacheEnabled: boolean;

  constructor() {
    this.templateDir = join(__dirname, '../templates');
    this.templateCache = new Map();
    this.cacheEnabled = true;
  }

  /**
   * Load a template file and render it with variables
   */
  async load(templateName: string, variables: Record<string, string | number | null | undefined> = {}): Promise<string> {
    try {
      // Check cache first
      const cacheKey = templateName;
      if (this.cacheEnabled && this.templateCache.has(cacheKey)) {
        logger.debug('Template loaded from cache', { templateName });
        return this.render(this.templateCache.get(cacheKey)!, variables);
      }

      // Load template from file
      const templatePath = join(this.templateDir, `${templateName}.md`);
      logger.debug('Loading template from file', { templatePath });

      const templateContent = await fs.readFile(templatePath, 'utf-8');

      // Cache the template
      if (this.cacheEnabled) {
        this.templateCache.set(cacheKey, templateContent);
      }

      return this.render(templateContent, variables);
    } catch (error) {
      logger.error('Failed to load template', error as Error, {
        templateName,
      });
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  /**
   * Render a template with variables
   * Supports both ${variable} and {{variable}} syntax
   */
  render(template: string, variables: Record<string, string | number | null | undefined> = {}): string {
    let rendered = template;

    // Replace ${variable} syntax
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      rendered = rendered.replace(regex, String(value ?? ''));
    }

    // Replace {{variable}} syntax
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value ?? ''));
    }

    return rendered;
  }

  /**
   * Load a template section (for composable templates)
   */
  async loadSection(sectionName: string, variables: Record<string, string | number | null | undefined> = {}): Promise<string> {
    const sectionPath = join(this.templateDir, 'sections', `${sectionName}.md`);

    try {
      const sectionContent = await fs.readFile(sectionPath, 'utf-8');
      return this.render(sectionContent, variables);
    } catch (error) {
      logger.warn('Failed to load template section', {
        sectionName,
        error: (error as Error).message,
      });
      return '';
    }
  }

  /**
   * Clear the template cache (useful for development)
   */
  clearCache(): void {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }

  /**
   * Disable caching (useful for development)
   */
  disableCache(): void {
    this.cacheEnabled = false;
    this.clearCache();
  }

  /**
   * Enable caching (default)
   */
  enableCache(): void {
    this.cacheEnabled = true;
  }
}


