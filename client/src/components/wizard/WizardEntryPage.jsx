import React from 'react';
import PropTypes from 'prop-types';

/**
 * WizardEntryPage - Authentic Airbnb-style Landing Page
 *
 * Inspired by Airbnb's 2025 host onboarding design:
 * - Grid-based layout (12-column system)
 * - Clean typography with precise spacing
 * - Minimal illustrations aligned right
 * - Fixed bottom CTA bar
 * - Simple, approachable design
 */

const WizardEntryPage = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 px-6 h-20 flex items-center justify-between">
        <div className="w-10 h-10 flex items-center justify-center">
          {/* Logo placeholder */}
          <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          Exit
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1128px] mx-auto px-6 pt-32 pb-24">
        <div className="grid grid-cols-12 gap-8">

          {/* Left heading column (6/12) */}
          <section className="col-span-12 md:col-span-6">
            <h1 className="text-5xl md:text-6xl font-semibold text-[#222] leading-tight mb-6">
              Creating a brilliant video prompt is easy.
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              We'll guide you through the process, from a simple idea to a detailed, ready-to-use prompt.
            </p>
          </section>

          {/* Right steps column (6/12) */}
          <section className="col-span-12 md:col-span-6 pt-5">
            <Step
              number={1}
              title="Define your Core Concept"
              description="First, you'll tell us the 'who, what, and where' of your video. This is the only required part!"
              illustrationVariant="video"
            />
            <Divider />
            <Step
              number={2}
              title="Set the Vibe (Optional)"
              description="Next, you can add atmosphere and style. This is where you make your idea stand out with details like mood, time of day, and visual style."
              illustrationVariant="style"
            />
            <Divider />
            <Step
              number={3}
              title="Review & Generate"
              description="We'll assemble all your ideas into a complete, polished prompt, ready to generate your video."
              illustrationVariant="check"
            />
          </section>
        </div>

        {/* Reassurance text */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Don't worry, you can't get this wrong. We'll provide AI-powered suggestions to help you at every step.
          </p>
        </div>
      </main>

      {/* Bottom fixed bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-[1128px] mx-auto px-6 h-[68px] flex items-center justify-end">
          <button
            onClick={onGetStarted}
            className="h-11 px-5 rounded-lg text-white text-base font-medium shadow-sm hover:opacity-95 transition"
            style={{ backgroundColor: '#FF385C' }}
          >
            Get started
          </button>
        </div>
      </footer>
    </div>
  );
};

WizardEntryPage.propTypes = {
  onGetStarted: PropTypes.func.isRequired
};

export default WizardEntryPage;

// --- Helper Components ---

function Divider() {
  return <div className="my-6 h-px bg-gray-200" />;
}

function Step({
  number,
  title,
  description,
  illustrationVariant,
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Number */}
      <div className="w-6 text-base leading-6 font-medium text-[#222] pt-1">
        {number}
      </div>

      {/* Text */}
      <div className="flex-1 pr-3">
        <div className="text-xl leading-6 font-semibold text-[#222]">{title}</div>
        <p className="text-base leading-6 text-gray-600 mt-2 max-w-[520px]">{description}</p>
      </div>

      {/* Illustration aligned to the right */}
      <div className="hidden md:block ml-auto">
        <IllustrationScaffold variant={illustrationVariant} />
      </div>
    </div>
  );
}

Step.propTypes = {
  number: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  illustrationVariant: PropTypes.string.isRequired
};

// --- Illustration Scaffold ---
// 112x84 neutral placeholder used on the right side of each step
function IllustrationScaffold({ variant = 'video', className = '' }) {
  return (
    <div
      aria-hidden
      className={[
        'relative w-28 h-21 rounded-xl overflow-hidden',
        'border border-gray-200 bg-gradient-to-tr from-gray-50 to-gray-100',
        'shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
        className,
      ].join(' ')}
    >
      {/* Ground / shelf */}
      <div className="absolute inset-x-2 bottom-2 h-3 bg-gray-200 rounded-md" />

      {variant === 'video' && (
        <>
          {/* Camera/screen */}
          <div className="absolute right-3 bottom-4 w-14 h-7 bg-gray-200 rounded-md" />
          {/* Lens */}
          <div className="absolute right-5 bottom-5 w-3 h-3 bg-gray-300 rounded-full" />
          {/* Accent */}
          <div className="absolute right-8 bottom-7 w-2 h-2 bg-gray-300 rounded-full" />
        </>
      )}

      {variant === 'style' && (
        <>
          {/* Palette / console */}
          <div className="absolute left-3 bottom-4 w-13 h-3 bg-gray-200 rounded-md" />
          <div className="absolute left-5 bottom-4 w-3 h-5 bg-gray-300 rounded-sm" />
          {/* Frame / art */}
          <div className="absolute right-3 top-2 w-7 h-9 bg-gray-200 rounded-sm" />
          <div className="absolute right-5 top-3 w-5 h-7 bg-gray-300 rounded-sm" />
        </>
      )}

      {variant === 'check' && (
        <>
          {/* Document */}
          <div className="absolute right-3 top-2 w-8 h-12 bg-gray-200 rounded-md" />
          <div className="absolute right-5 top-6 w-1 h-1 bg-gray-300 rounded-full" />
          {/* Checkmark circle */}
          <div className="absolute right-5 bottom-3 w-4 h-4 bg-gray-300 rounded-full" />
          {/* Accent */}
          <div className="absolute left-2 top-3 w-3 h-3 bg-gray-300 rounded-full" />
        </>
      )}
    </div>
  );
}

IllustrationScaffold.propTypes = {
  variant: PropTypes.string,
  className: PropTypes.string
};
