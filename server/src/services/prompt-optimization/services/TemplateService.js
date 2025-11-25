import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '@infrastructure/Logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Service for loading and managing prompt templates
 * Centralizes template management and enables easy version control of prompts
 */
export class TemplateService {
  constructor() {
    this.templateDir = join(__dirname, '../templates');
    this.templateCache = new Map();
    this.cacheEnabled = true;
  }

  /**
   * Load a template file and render it with variables
   * @param {string} templateName - Name of the template file (without .md extension)
   * @param {Object} variables - Variables to inject into the template
   * @returns {Promise<string>} Rendered template
   */
  async load(templateName, variables = {}) {
    try {
      // Check cache first
      const cacheKey = templateName;
      if (this.cacheEnabled && this.templateCache.has(cacheKey)) {
        logger.debug('Template loaded from cache', { templateName });
        return this.render(this.templateCache.get(cacheKey), variables);
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
      logger.error('Failed to load template', {
        templateName,
        error: error.message,
      });
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  /**
   * Render a template with variables
   * Supports both ${variable} and {{variable}} syntax
   * @param {string} template - Template string
   * @param {Object} variables - Variables to inject
   * @returns {string} Rendered template
   */
  render(template, variables = {}) {
    let rendered = template;

    // Replace ${variable} syntax
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      rendered = rendered.replace(regex, value ?? '');
    }

    // Replace {{variable}} syntax
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, value ?? '');
    }

    return rendered;
  }

  /**
   * Load a template section (for composable templates)
   * @param {string} sectionName - Name of the section file
   * @param {Object} variables - Variables to inject
   * @returns {Promise<string>} Rendered section
   */
  async loadSection(sectionName, variables = {}) {
    const sectionPath = join(this.templateDir, 'sections', `${sectionName}.md`);

    try {
      const sectionContent = await fs.readFile(sectionPath, 'utf-8');
      return this.render(sectionContent, variables);
    } catch (error) {
      logger.warn('Failed to load template section', {
        sectionName,
        error: error.message,
      });
      return '';
    }
  }

  /**
   * Clear the template cache (useful for development)
   */
  clearCache() {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }

  /**
   * Disable caching (useful for development)
   */
  disableCache() {
    this.cacheEnabled = false;
    this.clearCache();
  }

  /**
   * Enable caching (default)
   */
  enableCache() {
    this.cacheEnabled = true;
  }
}

export const templateService = new TemplateService();
export default templateService;

