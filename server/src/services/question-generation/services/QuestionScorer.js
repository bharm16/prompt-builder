/**
 * QuestionScorer - Scores and ranks questions by relevance
 * 
 * Evaluates question quality based on multiple factors:
 * - Ambiguity reduction potential
 * - Information gain
 * - User effort required
 * - Criticality to the task
 */
export class QuestionScorer {
  /**
   * Scoring weights for relevance calculation
   */
  static RELEVANCE_WEIGHTS = {
    ambiguityReduction: 0.35,
    informationGain: 0.35,
    userEffort: 0.15,
    criticalityScore: 0.15,
  };

  static SPECIFICITY_KEYWORDS = ['exactly', 'specific', 'particular', 'precise', 'which'];
  static CRITICAL_TERMS = ['must', 'require', 'constrain', 'limit', 'restrict', 'need'];

  /**
   * Score question relevance to the prompt
   * @param {Object} question - Question object
   * @param {string} prompt - Original prompt
   * @returns {Promise<number>} Relevance score (0-1)
   */
  async scoreQuestionRelevance(question, prompt) {
    const factors = {
      ambiguityReduction: await this.measureAmbiguityReduction(question, prompt),
      informationGain: await this.calculateInfoGain(question, prompt),
      userEffort: await this.estimateAnswerEffort(question),
      criticalityScore: await this.assessCriticality(question, prompt),
    };

    // Apply weights to factors
    const score =
      factors.ambiguityReduction * QuestionScorer.RELEVANCE_WEIGHTS.ambiguityReduction +
      factors.informationGain * QuestionScorer.RELEVANCE_WEIGHTS.informationGain +
      (1 - factors.userEffort) * QuestionScorer.RELEVANCE_WEIGHTS.userEffort +
      factors.criticalityScore * QuestionScorer.RELEVANCE_WEIGHTS.criticalityScore;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Measure how much a question reduces ambiguity
   * @param {Object} question - Question object
   * @param {string} prompt - Original prompt
   * @returns {Promise<number>} Ambiguity reduction score (0-1)
   */
  async measureAmbiguityReduction(question, prompt) {
    let score = 0;
    const titleLower = question.title.toLowerCase();

    // Check for specificity-enhancing keywords
    QuestionScorer.SPECIFICITY_KEYWORDS.forEach(keyword => {
      if (titleLower.includes(keyword)) {
        score += 0.2;
      }
    });

    // Questions with examples typically reduce ambiguity
    if (question.examples && question.examples.length > 3) {
      score += 0.3;
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate information gain from a question
   * @param {Object} question - Question object
   * @param {string} prompt - Original prompt
   * @returns {Promise<number>} Information gain score (0-1)
   */
  async calculateInfoGain(question, prompt) {
    const promptLower = prompt.toLowerCase();
    const questionLower = question.title.toLowerCase();
    let score = 0;

    // Check if question addresses something not in prompt
    const questionKeywords = questionLower.split(/\s+/);
    questionKeywords.forEach(keyword => {
      if (keyword.length > 4 && !promptLower.includes(keyword)) {
        score += 0.1;
      }
    });

    // Questions with clear structure have higher info gain
    if (question.description && question.description.length > 50) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * Estimate effort required to answer a question
   * @param {Object} question - Question object
   * @returns {Promise<number>} Effort score (0-1, higher = more effort)
   */
  async estimateAnswerEffort(question) {
    let effort = 0;
    const titleLower = question.title.toLowerCase();

    // Open-ended questions require more effort
    if (titleLower.includes('describe') || titleLower.includes('explain')) {
      effort += 0.3;
    }

    // Questions requiring lists or multiple items
    if (titleLower.includes('list') || titleLower.includes('all')) {
      effort += 0.2;
    }

    // Questions with many examples are easier to answer
    if (question.examples && question.examples.length >= 4) {
      effort -= 0.2;
    }

    return Math.min(Math.max(effort, 0), 1);
  }

  /**
   * Assess how critical a question is for the task
   * @param {Object} question - Question object
   * @param {string} prompt - Original prompt
   * @returns {Promise<number>} Criticality score (0-1)
   */
  async assessCriticality(question, prompt) {
    let score = 0;
    const titleLower = question.title.toLowerCase();

    // Questions about constraints and requirements are critical
    QuestionScorer.CRITICAL_TERMS.forEach(term => {
      if (titleLower.includes(term)) {
        score += 0.2;
      }
    });

    // First question is typically most critical (by design)
    if (question.id === 1) {
      score += 0.3;
    }

    return Math.min(score, 1);
  }

  /**
   * Rank questions by relevance scores
   * @param {Array} questions - Array of questions
   * @param {string} prompt - Original prompt
   * @returns {Promise<Array>} Ranked questions with relevance scores
   */
  async rankQuestionsByRelevance(questions, prompt) {
    // Score all questions
    const scoredQuestions = await Promise.all(
      questions.map(async (question) => ({
        ...question,
        relevanceScore: await this.scoreQuestionRelevance(question, prompt),
      }))
    );

    // Sort by relevance score (descending)
    return scoredQuestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

