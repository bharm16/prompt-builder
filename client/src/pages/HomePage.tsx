import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingPage } from './MarketingPage';

export function HomePage(): React.ReactElement {
  return (
    <MarketingPage
      title="Vidra"
      subtitle="Better prompts, faster. Keep the app focused—keep the company navigation global."
    >
      <div className="mt-8 flex flex-col gap-4">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-geist-foreground">Prompt Builder</h2>
          <p className="mt-2 text-geist-accents-6">
            Jump into the app to create and optimize prompts.
          </p>
          <div className="mt-4">
            <Link to="/" className="btn-primary">
              Open app
            </Link>
          </div>
        </div>
      </div>
    </MarketingPage>
  );
}


