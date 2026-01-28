import React, { useState, useEffect } from 'react';
import { TrendingUp, Info, CheckCircle, AlertCircle } from '@promptstudio/system/components/ui';
import { useDebugLogger } from '@hooks/useDebugLogger';

type ScoreColor = 'success' | 'info' | 'warning' | 'error';

interface ScoreFactor {
  label: string;
  value: number;
  max: number;
  description: string;
}

interface QualityScoreProps {
  score: number;
  previousScore?: number | null;
  showDetails?: boolean;
  inputPrompt?: string;
  outputPrompt?: string;
  animated?: boolean;
}

// Get color based on score
const getScoreColor = (score: number): ScoreColor => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'info';
  if (score >= 40) return 'warning';
  return 'error';
};

// Get score label
const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
};

// Get score factors breakdown
const getScoreFactors = (
  inputLength: number,
  outputLength: number,
  sections: number,
  hasGoal: boolean,
  hasFormat: boolean,
  hasContext: boolean
): ScoreFactor[] => {
  return [
    {
      label: 'Length Improvement',
      value: outputLength > inputLength * 2 ? 25 : outputLength > inputLength ? 15 : 5,
      max: 25,
      description: 'Expanded from original input',
    },
    {
      label: 'Structure',
      value: Math.min(sections * 10, 30),
      max: 30,
      description: 'Well-organized sections',
    },
    {
      label: 'Clear Goal',
      value: hasGoal ? 15 : 0,
      max: 15,
      description: 'Defined objective',
    },
    {
      label: 'Output Format',
      value: hasFormat ? 15 : 0,
      max: 15,
      description: 'Specified format/structure',
    },
    {
      label: 'Context',
      value: hasContext ? 15 : 0,
      max: 15,
      description: 'Includes relevant context',
    },
  ];
};

export default function QualityScore({
  score,
  previousScore = null,
  showDetails = false,
  inputPrompt = '',
  outputPrompt = '',
  animated = true,
}: QualityScoreProps): React.ReactElement {
  const debug = useDebugLogger('QualityScore', { 
    score, 
    showDetails,
    improvement: previousScore !== null ? score - previousScore : null,
  });
  
  const [displayScore, setDisplayScore] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Animate score on mount or when score changes
  useEffect(() => {
    debug.logEffect('Score updated', { 
      score, 
      animated,
      previousScore,
    });
    
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    debug.startTimer('scoreAnimation');
    let currentScore = 0;
    const increment = score / 50; // Animate over ~50 frames
    const interval = setInterval(() => {
      currentScore += increment;
      if (currentScore >= score) {
        setDisplayScore(score);
        clearInterval(interval);
        debug.endTimer('scoreAnimation', 'Score animation complete');
      } else {
        setDisplayScore(Math.floor(currentScore));
      }
    }, 20);

    return () => clearInterval(interval);
  }, [score, animated, previousScore, debug]);

  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);
  const improvement = previousScore !== null ? score - previousScore : null;

  // Calculate score factors
  const inputWords = inputPrompt.split(/\s+/).length;
  const outputWords = outputPrompt.split(/\s+/).length;
  const sections = (outputPrompt.match(/\*\*/g) || []).length / 2;
  const hasGoal = outputPrompt.toLowerCase().includes('goal');
  const hasFormat =
    outputPrompt.toLowerCase().includes('format') || outputPrompt.toLowerCase().includes('research');
  const hasContext =
    outputPrompt.toLowerCase().includes('context') || outputPrompt.toLowerCase().includes('learning');

  const scoreFactors = showDetails
    ? getScoreFactors(inputWords, outputWords, sections, hasGoal, hasFormat, hasContext)
    : [];

  // Color classes for different states
  const colorClasses: Record<ScoreColor, { bg: string; border: string; text: string; ring: string; progress: string }> =
    {
      success: {
        bg: 'bg-success-50',
        border: 'border-success-300',
        text: 'text-success-700',
        ring: 'text-success-600',
        progress: 'text-success-600',
      },
      info: {
        bg: 'bg-info-50',
        border: 'border-info-300',
        text: 'text-info-700',
        ring: 'text-info-600',
        progress: 'text-info-600',
      },
      warning: {
        bg: 'bg-warning-50',
        border: 'border-warning-300',
        text: 'text-warning-700',
        ring: 'text-warning-600',
        progress: 'text-warning-600',
      },
      error: {
        bg: 'bg-error-50',
        border: 'border-error-300',
        text: 'text-error-700',
        ring: 'text-error-600',
        progress: 'text-error-600',
      },
    };

  const colors = colorClasses[scoreColor];
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="relative">
      {/* Compact Version */}
      {!showDetails && (
        <div
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg border-2 ${colors.bg} ${colors.border}
            transition-all duration-300 hover:shadow-md cursor-pointer
          `}
          onClick={() => {
            debug.logAction('toggleTooltip', { newState: !showTooltip });
            setShowTooltip(!showTooltip);
          }}
          role="button"
          tabIndex={0}
          aria-label={`Quality score: ${score}%. ${scoreLabel}. Click for details.`}
          onKeyPress={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              debug.logAction('toggleTooltipViaKeyboard', { newState: !showTooltip });
              setShowTooltip(!showTooltip);
            }
          }}
        >
          {/* Circular Progress */}
          <div className="relative flex-shrink-0">
            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-neutral-200"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={`${colors.progress} transition-all duration-1000 ease-out`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${colors.text}`}>{displayScore}</span>
            </div>
          </div>

          {/* Score Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${colors.text}`}>Quality Score</span>
              {improvement !== null && improvement !== 0 && (
                <span
                  className={`
                    inline-flex items-center gap-1 text-xs font-medium
                    ${improvement > 0 ? 'text-success-600' : 'text-error-600'}
                  `}
                >
                  <TrendingUp
                    className={`h-3 w-3 ${improvement < 0 ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  {improvement > 0 ? '+' : ''}
                  {improvement}%
                </span>
              )}
            </div>
            <p className={`text-xs ${colors.text} opacity-80`}>{scoreLabel}</p>
          </div>

          {/* Info Icon */}
          <Info className={`h-4 w-4 ${colors.text} opacity-60`} aria-hidden="true" />
        </div>
      )}

      {/* Detailed Version */}
      {showDetails && (
        <div
          className={`
            p-6 rounded-xl border-2 ${colors.bg} ${colors.border}
            transition-all duration-300 hover:shadow-lg
          `}
        >
          {/* Header with Circular Progress */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-shrink-0">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-neutral-200"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={`${colors.progress} transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${colors.text}`}>{displayScore}</span>
                <span className={`text-xs ${colors.text} opacity-70`}>/ 100</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`text-xl font-bold ${colors.text}`}>{scoreLabel}</h3>
                {score >= 80 && <CheckCircle className="h-5 w-5 text-success-600" aria-hidden="true" />}
                {score < 60 && <AlertCircle className="h-5 w-5 text-warning-600" aria-hidden="true" />}
              </div>
              <p className="text-sm text-neutral-600">Your prompt quality assessment</p>
              {improvement !== null && improvement !== 0 && (
                <div
                  className={`
                  inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-medium
                  ${improvement > 0 ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'}
                `}
                >
                  <TrendingUp
                    className={`h-3 w-3 ${improvement < 0 ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  {improvement > 0 ? '+' : ''}
                  {improvement}% from previous
                </div>
              )}
            </div>
          </div>

          {/* Score Factors */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-neutral-700 mb-3">Score Breakdown</h4>
            {scoreFactors.map((factor, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-700">{factor.label}</span>
                  <span className={`font-bold ${colors.text}`}>
                    {factor.value}/{factor.max}
                  </span>
                </div>
                <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.progress} bg-current transition-all duration-500`}
                    style={{ width: `${(factor.value / factor.max) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500">{factor.description}</p>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {score < 80 && (
            <div className="mt-6 p-4 rounded-lg bg-white border border-neutral-200">
              <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden="true" />
                Improvement Tips
              </h4>
              <ul className="text-xs text-neutral-600 space-y-1 list-disc list-inside">
                {score < 60 && <li>Add more specific details and context</li>}
                {!hasGoal && <li>Define a clear goal or objective</li>}
                {!hasFormat && <li>Specify the desired output format</li>}
                {!hasContext && <li>Include relevant background context</li>}
                {sections < 3 && <li>Break down into logical sections</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tooltip for compact version */}
      {!showDetails && showTooltip && (
        <div className="absolute top-full left-0 mt-2 z-tooltip w-64 p-3 bg-neutral-900 text-white text-xs rounded-lg shadow-xl animate-slide-down">
          <div className="space-y-2">
            <p className="font-semibold">Quality Score: {score}%</p>
            <p className="opacity-90">
              This score reflects how well-structured and detailed your optimized prompt is.
            </p>
            <div className="pt-2 border-t border-neutral-700">
              <p className="opacity-75">Click for detailed breakdown</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

