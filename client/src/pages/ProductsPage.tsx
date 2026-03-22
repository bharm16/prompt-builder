import React from 'react';
import { MarketingPage } from './MarketingPage';
import { AUTH_COLORS } from './auth/auth-styles';

const CARD: React.CSSProperties = {
  background: AUTH_COLORS.card,
  border: `1px solid ${AUTH_COLORS.cardBorder}`,
  borderRadius: '10px',
};

export function ProductsPage(): React.ReactElement {
  return (
    <MarketingPage
      title="Products"
      eyebrow="PRODUCTS"
    >
      <div className="flex flex-col gap-2.5">
        <div className="p-4" style={CARD}>
          <h3 className="text-[13px] font-semibold text-white">Prompt Builder</h3>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
            Optimize prompts with structured improvements and history.
          </p>
        </div>
        <div className="p-4" style={CARD}>
          <h3 className="text-[13px] font-semibold text-white">Docs / API</h3>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
            Integrate prompt optimization into your own tools.
          </p>
        </div>
      </div>
    </MarketingPage>
  );
}
