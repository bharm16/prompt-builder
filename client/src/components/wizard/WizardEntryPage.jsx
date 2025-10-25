import React from 'react';
import PropTypes from 'prop-types';

/**
 * WizardEntryPage - Airbnb-style Landing Page
 *
 * Inspired by Airbnb's 2025 design principles:
 * - Clean, dimensional interface with depth
 * - Vibrant 3D illustrations
 * - Simple, intuitive layout
 * - High contrast and readability
 * - Fun, alive, and approachable
 */
const WizardEntryPage = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
        <div className="w-10 h-10 flex items-center justify-center">
          {/* Logo placeholder - you can replace with your actual logo */}
          <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          Exit
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left Side - Main Heading */}
          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Creating a brilliant video prompt is easy.
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              We'll guide you through the process, from a simple idea to a detailed, ready-to-use prompt.
            </p>
          </div>

          {/* Right Side - Steps */}
          <div className="space-y-8">

            {/* Step 1 */}
            <div className="flex gap-6 items-start group">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 pt-2">
                <div className="text-sm font-semibold text-gray-500 mb-1">1</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Define your Core Concept
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  First, you'll tell us the "who, what, and where" of your video. This is the only required part!
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6 items-start group">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 pt-2">
                <div className="text-sm font-semibold text-gray-500 mb-1">2</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Set the Vibe (Optional)
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Next, you can add atmosphere and style. This is where you make your idea stand out with details like mood, time of day, and visual style.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6 items-start group">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 pt-2">
                <div className="text-sm font-semibold text-gray-500 mb-1">3</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Review & Generate
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  We'll assemble all your ideas into a complete, polished prompt, ready to generate your video.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Bottom Section - CTA */}
      <div className="pb-16 px-6 flex flex-col items-center gap-6">
        <p className="text-sm text-gray-500 text-center max-w-md">
          Don't worry, you can't get this wrong. We'll provide AI-powered suggestions to help you at every step.
        </p>
        <button
          onClick={onGetStarted}
          className="px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-pink-300"
        >
          Let's get started
        </button>
      </div>
    </div>
  );
};

WizardEntryPage.propTypes = {
  onGetStarted: PropTypes.func.isRequired
};

export default WizardEntryPage;
