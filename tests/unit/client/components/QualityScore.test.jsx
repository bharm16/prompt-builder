import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import QualityScore from '../QualityScore.jsx';

describe('QualityScore', () => {
  it('renders compact score with label and aria', () => {
    render(<QualityScore score={85} previousScore={70} showDetails={false} animated={false} />);
    const btn = screen.getByRole('button', { name: /quality score: 85%/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText(/Quality Score/i)).toBeInTheDocument();
  });

  it('renders detailed view with factors when showDetails', () => {
    const input = 'short input';
    const output = '**Goal**\ntext\n\n**Return Format**\njson\n\n**Context** details';
    render(
      <QualityScore
        score={72}
        previousScore={65}
        showDetails
        inputPrompt={input}
        outputPrompt={output}
        animated={false}
      />
    );
    expect(screen.getByText(/Score Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Length Improvement/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Format/i)).toBeInTheDocument();
  });
});
