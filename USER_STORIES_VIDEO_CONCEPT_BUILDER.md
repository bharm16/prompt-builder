# Video Concept Builder - User Stories

**Project:** Video Concept Builder UX Redesign
**Date:** October 25, 2025
**Status:** Ready for Sprint Planning

---

## Table of Contents
1. [Epic 1: Guided Workflow & Clear Navigation](#epic-1-guided-workflow--clear-navigation)
2. [Epic 2: Mobile-First Experience](#epic-2-mobile-first-experience)
3. [Epic 3: Inline AI Suggestions](#epic-3-inline-ai-suggestions)
4. [Epic 4: Simplified Information Architecture](#epic-4-simplified-information-architecture)
5. [Epic 5: Accessibility Improvements](#epic-5-accessibility-improvements)
6. [Epic 6: Performance Optimization](#epic-6-performance-optimization)
7. [Epic 7: Enhanced Validation & Feedback](#epic-7-enhanced-validation--feedback)
8. [Epic 8: Component Refactoring](#epic-8-component-refactoring)
9. [Epic 9: Visual Design System](#epic-9-visual-design-system)
10. [Epic 10: Feature Enhancements](#epic-10-feature-enhancements)

---

# Epic 1: Guided Workflow & Clear Navigation

**Epic Goal:** Eliminate user confusion by providing a clear, step-by-step workflow that guides users from start to finish.

**Business Value:** Increase completion rate from 45% to 75%, reduce time-to-first-prompt by 50%

---

## Story 1.1: Wizard Mode - Linear Step Flow
**Priority:** 🔴 CRITICAL | **Story Points:** 13

**As a** first-time user
**I want** to be guided through the video concept creation step-by-step
**So that** I don't feel overwhelmed and know exactly what to do next

### Acceptance Criteria
- [ ] Workflow displays one primary step at a time (Subject → Action → Location)
- [ ] Clear visual progress indicator shows current step (Step 1 of 3)
- [ ] Progress bar displays percentage (33%, 66%, 100%)
- [ ] "Next" button only enabled when current step is valid
- [ ] "Back" button allows returning to previous step without losing data
- [ ] Optional fields shown after completing required fields
- [ ] User can see preview of next step before advancing
- [ ] Keyboard shortcuts work: Enter = Next, Esc = Back

### Definition of Done
- User testing shows 80%+ understand where to start
- Average time to first prompt < 5 minutes
- Mobile and desktop both functional
- All accessibility requirements met

---

## Story 1.2: Remove Mode Selection Confusion
**Priority:** 🔴 CRITICAL | **Story Points:** 5

**As a** new user
**I want** a single clear path to create my video concept
**So that** I don't waste time figuring out which mode to use

### Acceptance Criteria
- [ ] Remove "Element Builder" vs "Describe Concept" mode tabs
- [ ] Default to guided step-by-step workflow
- [ ] Add "Describe full concept" as quick action option (not primary mode)
- [ ] Provide clear recommendation: "New users: Start with guided mode"
- [ ] Allow switching to free-form if user prefers (with confirmation)

### Definition of Done
- Mode selection A/B test shows wizard mode has 2x completion rate
- Support tickets about "which mode to use" reduced to zero

---

## Story 1.3: Visual Progress Tracking
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user in the middle of the workflow
**I want** to see how much progress I've made
**So that** I know how much work remains and stay motivated

### Acceptance Criteria
- [ ] Single progress bar replaces 4 progress cards
- [ ] Shows percentage: "70% complete"
- [ ] Displays current step: "Step 2 of 3: Core Elements"
- [ ] Optional fields shown as separate section: "3 optional fields remaining"
- [ ] Visual checkmarks show completed required fields
- [ ] Sticky header keeps progress visible while scrolling
- [ ] Smooth animation when progress updates

### Definition of Done
- Progress bar visible on all screen sizes
- Users can accurately estimate completion time
- Analytics show reduced abandonment rate

---

## Story 1.4: Numbered Step Indicators
**Priority:** 🟠 HIGH | **Story Points:** 3

**As a** user
**I want** to see numbered steps with clear labels
**So that** I understand the sequence and can navigate easily

### Acceptance Criteria
- [ ] Step indicator displays: ① Subject → ② Action → ③ Location
- [ ] Current step highlighted with color/bold
- [ ] Completed steps show checkmark ✓
- [ ] Future steps grayed out
- [ ] Click on completed step to return to it
- [ ] Mobile: Horizontal stepper with dots or numbers
- [ ] Desktop: Horizontal stepper with full labels

### Definition of Done
- 90%+ users correctly identify current step in testing
- Navigation between steps is intuitive

---

## Story 1.5: Contextual Guidance
**Priority:** 🟡 MEDIUM | **Story Points:** 5

**As a** confused user
**I want** helpful tips that appear when I need them
**So that** I can get unstuck without leaving the page

### Acceptance Criteria
- [ ] Each step shows brief contextual help text
- [ ] "?" icon in top-right provides detailed guidance
- [ ] Examples shown inline with each field
- [ ] Tips appear based on user behavior (e.g., 30 seconds on empty field)
- [ ] Help content is dismissible and doesn't return
- [ ] Video tutorial available (optional, not blocking)
- [ ] Guidance adapts to user level (first-time vs returning)

### Definition of Done
- Support tickets reduced by 40%
- Help content shown doesn't annoy experienced users

---

# Epic 2: Mobile-First Experience

**Epic Goal:** Make the video concept builder fully functional and delightful on mobile devices

**Business Value:** Reduce mobile bounce rate from 75% to <30%, enable 50% more mobile users to complete workflow

---

## Story 2.1: Mobile Wizard Layout
**Priority:** 🔴 CRITICAL | **Story Points:** 8

**As a** mobile user
**I want** a mobile-optimized interface that doesn't require zooming or horizontal scrolling
**So that** I can create video concepts on my phone easily

### Acceptance Criteria
- [ ] One field visible per screen (vertical stack)
- [ ] Large touch targets (48px minimum)
- [ ] Header condensed to single progress bar (not 4 cards)
- [ ] Sticky "Next" button at bottom of viewport
- [ ] No horizontal scrolling required
- [ ] Text inputs sized appropriately (16px font to prevent zoom)
- [ ] Form fits in viewport without requiring scroll to see buttons
- [ ] Works on iPhone SE (375px) and larger

### Definition of Done
- Mobile usability score improves from 3/10 to 7/10
- Touch target accessibility test passes (all elements 44x44px minimum)
- Works on iOS Safari, Chrome Mobile, Samsung Internet

---

## Story 2.2: Bottom Sheet Suggestions Panel
**Priority:** 🔴 CRITICAL | **Story Points:** 8

**As a** mobile user
**I want** AI suggestions in a native bottom sheet
**So that** I can easily see and select suggestions without the form disappearing

### Acceptance Criteria
- [ ] Suggestions appear in iOS/Android-style bottom sheet
- [ ] Sheet slides up from bottom with animation
- [ ] Background dimmed but form visible
- [ ] Swipe down to dismiss
- [ ] Tap outside sheet to close
- [ ] Sheet height adapts to content (max 60% of viewport)
- [ ] Scroll enabled if suggestions exceed sheet height
- [ ] Selected suggestion closes sheet and updates input

### Definition of Done
- Mobile suggestion adoption rate increases by 100%
- No complaints about form being hidden
- Works smoothly on all mobile browsers

---

## Story 2.3: Touch-Optimized Inputs
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** mobile user
**I want** large, easy-to-tap buttons and inputs
**So that** I don't accidentally tap the wrong thing

### Acceptance Criteria
- [ ] All buttons minimum 44x44px (Apple) or 48x48px (Material)
- [ ] Input fields minimum 48px height
- [ ] Example chips minimum 44px tap area
- [ ] Adequate spacing between tappable elements (8px minimum)
- [ ] No hover states (inappropriate for touch)
- [ ] Active/pressed states visible on touch
- [ ] No double-tap zoom issues

### Definition of Done
- Touch target accessibility audit passes
- Error rate on mobile buttons < 5%
- User testing shows no accidental taps

---

## Story 2.4: Condensed Mobile Header
**Priority:** 🟠 HIGH | **Story Points:** 3

**As a** mobile user
**I want** a compact header that doesn't dominate my screen
**So that** I can see the actual form fields

### Acceptance Criteria
- [ ] Header maximum 120px height (currently 400-500px)
- [ ] Single progress bar (no 4-card grid)
- [ ] Title + progress bar only
- [ ] Hamburger menu for secondary actions (templates, help)
- [ ] Sticky header collapses on scroll (shows progress only)
- [ ] No wasted whitespace
- [ ] Logo/branding minimal or removed on mobile

### Definition of Done
- First input field visible without scrolling on iPhone SE
- Header takes <20% of viewport
- Core functionality still accessible

---

## Story 2.5: Mobile Keyboard Handling
**Priority:** 🟡 MEDIUM | **Story Points:** 5

**As a** mobile user typing in an input
**I want** the form to adjust when keyboard appears
**So that** I can see what I'm typing and the suggestions

### Acceptance Criteria
- [ ] Form scrolls to keep active input visible when keyboard opens
- [ ] Suggestions panel appears above keyboard
- [ ] "Next" button remains accessible (above keyboard)
- [ ] No content hidden behind keyboard
- [ ] Smooth transition when keyboard appears/disappears
- [ ] Input retains focus when scrolling
- [ ] "Done" on keyboard triggers "Next" button

### Definition of Done
- Works on iOS and Android native keyboards
- No visual glitches during keyboard transitions
- Users can always see input and suggestions simultaneously

---

# Epic 3: Inline AI Suggestions

**Epic Goal:** Reduce context switching by showing AI suggestions directly below the active input field

**Business Value:** Increase suggestion adoption by 100%, reduce eye travel by 80%

---

## Story 3.1: Inline Dropdown Suggestions
**Priority:** 🔴 CRITICAL | **Story Points:** 13

**As a** user typing in an input field
**I want** AI suggestions to appear directly below my input
**So that** I don't have to look away to a distant sidebar

### Acceptance Criteria
- [ ] Suggestions appear in dropdown below active input (like Google search)
- [ ] Max 80px distance from input to first suggestion
- [ ] Dropdown overlays content below (doesn't push it down)
- [ ] Arrow keys navigate suggestions
- [ ] Number keys (1-8) select suggestions
- [ ] Enter selects highlighted suggestion
- [ ] Escape closes dropdown
- [ ] Click outside closes dropdown
- [ ] Suggestions visible with max 8 items, scroll if more
- [ ] Loading spinner shows in dropdown while fetching

### Definition of Done
- Suggestion adoption increases from 30% to 65%
- Eye tracking shows 80% reduction in eye travel
- Keyboard navigation fully functional
- Desktop and tablet both supported

---

## Story 3.2: Remove Suggestions Sidebar
**Priority:** 🔴 CRITICAL | **Story Points:** 5

**As a** user
**I want** a simpler layout without a distracting sidebar
**So that** I can focus on the main form

### Acceptance Criteria
- [ ] Sidebar completely removed from layout
- [ ] Main content takes full width (or centered with max-width)
- [ ] No visual gap where sidebar was
- [ ] Refinement suggestions merged into main flow (inline cards)
- [ ] All sidebar functionality moved to inline dropdowns
- [ ] Responsive layout simplified (no sidebar breakpoint logic)

### Definition of Done
- Layout feels more spacious and focused
- No user confusion about where suggestions went
- Component bundle size reduced by 25KB

---

## Story 3.3: Visual Connection Between Input and Suggestions
**Priority:** 🟠 HIGH | **Story Points:** 3

**As a** user
**I want** to clearly see which input the suggestions are for
**So that** I don't accidentally apply a suggestion to the wrong field

### Acceptance Criteria
- [ ] Input field highlighted when suggestions visible
- [ ] Subtle connecting line or arrow between input and dropdown
- [ ] Dropdown positioned exactly below input (aligned left)
- [ ] Input border color changes when suggestions active
- [ ] Other inputs dimmed slightly when one has active suggestions
- [ ] Clear visual hierarchy (input → suggestions obvious)

### Definition of Done
- User testing shows zero confusion about which field suggestions apply to
- Visual design approved by design team
- Accessible with sufficient color contrast

---

## Story 3.4: Persistent Keyboard Shortcuts Hint
**Priority:** 🟠 HIGH | **Story Points:** 3

**As a** keyboard user
**I want** to know I can use number keys to select suggestions
**So that** I can work faster without reaching for the mouse

### Acceptance Criteria
- [ ] Numbered badges (1-8) always visible on suggestions (not just hover)
- [ ] Small hint text: "Press 1-8 to select, ↑↓ to navigate, Enter to confirm"
- [ ] Hint appears above or below suggestion list
- [ ] Hint dismissible with "Got it" button (stores in localStorage)
- [ ] Hint reappears for new users
- [ ] ARIA labels describe keyboard shortcuts to screen readers
- [ ] Keyboard shortcuts listed in help documentation

### Definition of Done
- 70%+ users discover keyboard shortcuts in user testing
- Screen reader users hear shortcuts announcement
- No performance impact from numbered badges

---

## Story 3.5: Suggestion Application with Focus Management
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** keyboard user
**I want** focus to return to the input after applying a suggestion
**So that** I can continue editing or move to the next field

### Acceptance Criteria
- [ ] After clicking suggestion, focus returns to the input
- [ ] After pressing number key, focus returns to input
- [ ] Screen reader announces: "Applied: [suggestion text]"
- [ ] User can immediately press Tab to next field
- [ ] User can continue typing to refine suggestion
- [ ] No focus trap (can Escape to close suggestions)
- [ ] Focus visible with clear outline

### Definition of Done
- Keyboard navigation flows smoothly through entire form
- WCAG 2.1 AA focus management compliance
- Zero complaints about lost focus

---

# Epic 4: Simplified Information Architecture

**Epic Goal:** Reduce cognitive load by removing 60% of visible UI elements and showing only what's necessary

**Business Value:** Reduce screen elements from 45-65 to <20, improve comprehension and completion rates

---

## Story 4.1: Remove Redundant Progress Cards
**Priority:** 🔴 CRITICAL | **Story Points:** 3

**As a** user
**I want** to see my progress without visual clutter
**So that** I can focus on the actual form

### Acceptance Criteria
- [ ] Remove 4-card progress grid (Overall, Core, Atmosphere, Style)
- [ ] Replace with single progress bar
- [ ] Progress bar shows percentage (e.g., "70% complete")
- [ ] Detailed breakdown available in collapsed panel (optional)
- [ ] Save 200-300px of vertical space
- [ ] Mobile: Save 400px of space

### Definition of Done
- User testing shows progress is still clear
- Completion rate improves (less intimidating)
- First input field moves 300px higher on page

---

## Story 4.2: Hide Advanced Features Initially
**Priority:** 🔴 CRITICAL | **Story Points:** 5

**As a** new user
**I want** to see only essential fields first
**So that** I'm not overwhelmed by advanced options

### Acceptance Criteria
- [ ] Technical parameters hidden in "Advanced" accordion/tab
- [ ] Refinement suggestions shown only after 3 elements filled
- [ ] Templates accessible via button, not always visible
- [ ] Guidance panel collapsed by default
- [ ] "Show advanced options" toggle for power users
- [ ] User preference remembered in localStorage
- [ ] Advanced options clearly labeled ("Advanced" badge)

### Definition of Done
- New users see maximum 3 fields on initial load
- Advanced users can expand all features
- Preference persists across sessions

---

## Story 4.3: Consolidate Action Buttons
**Priority:** 🟠 HIGH | **Story Points:** 3

**As a** user
**I want** clear primary and secondary actions
**So that** I know what to do next

### Acceptance Criteria
- [ ] One primary action: "Generate Prompt" (large, prominent)
- [ ] Secondary actions in menu: [Templates] [Save Draft] [Help]
- [ ] "Generate Prompt" button always visible (sticky on mobile)
- [ ] Button states: disabled (incomplete), enabled (ready), loading (processing)
- [ ] Clear visual hierarchy (primary button stands out)
- [ ] No more than 3 visible buttons at once

### Definition of Done
- User testing shows 95%+ know which button to click next
- Primary action obvious to first-time users
- Click-through rate on "Generate" increases

---

## Story 4.4: Simplified Subject Descriptors
**Priority:** 🟠 HIGH | **Story Points:** 8

**As a** user
**I want** to add visual details to my subject easily
**So that** I don't need to understand complex parsing logic

### Acceptance Criteria
- [ ] Single subject input field (no auto-splitting)
- [ ] Visual details added as removable tag chips below subject
- [ ] "[+ Add visual detail]" button adds new tag
- [ ] Tags displayed as pills with X to remove
- [ ] No hidden connector word parsing logic
- [ ] User explicitly controls what goes where
- [ ] Example: "elderly man" + tags ["weathered hands", "silver harmonica"]
- [ ] Backend combines subject + tags on submission

### Definition of Done
- Zero user confusion about descriptor splitting
- 216 lines of complex parsing logic removed
- User testing shows intuitive tag management

---

## Story 4.5: Collapse Empty Optional Sections
**Priority:** 🟡 MEDIUM | **Story Points:** 3

**As a** user focused on required fields
**I want** optional sections hidden until I'm ready
**So that** I can complete the essentials first

### Acceptance Criteria
- [ ] Optional fields (Mood, Style, Event) collapsed in accordion
- [ ] Accordion header shows: "Optional fields (0/4 filled)"
- [ ] One click expands to show all optional fields
- [ ] Filled optional fields always visible
- [ ] Visual distinction: required (blue border) vs optional (neutral)
- [ ] Can collapse optional section after opening

### Definition of Done
- Page height reduced by 400px for new users
- Optional fields easy to discover when ready
- Completion of required fields increases

---

# Epic 5: Accessibility Improvements

**Epic Goal:** Achieve 95% WCAG 2.1 AA compliance and make the builder usable for all users

**Business Value:** Meet legal requirements, expand user base to include users with disabilities

---

## Story 5.1: Keyboard Shortcut Discoverability
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** keyboard-only user
**I want** to know which keyboard shortcuts are available
**So that** I can work efficiently without a mouse

### Acceptance Criteria
- [ ] Keyboard shortcuts listed in help panel
- [ ] Visual hints on interactive elements (e.g., numbered badges always visible)
- [ ] "?" icon shows keyboard shortcut cheat sheet
- [ ] Common shortcuts: Enter (next), Esc (close), 1-8 (select), Tab (navigate)
- [ ] `aria-keyshortcuts` attribute on relevant elements
- [ ] Shortcuts announced to screen readers
- [ ] Shortcuts work consistently across all browsers

### Definition of Done
- 70%+ keyboard users discover at least 2 shortcuts
- Screen reader users hear shortcut descriptions
- Help panel documents all shortcuts

---

## Story 5.2: Focus Management System
**Priority:** 🔴 CRITICAL | **Story Points:** 8

**As a** keyboard user
**I want** focus to move logically through the interface
**So that** I'm never lost or stuck

### Acceptance Criteria
- [ ] Focus returns to input after suggestion application
- [ ] Focus moves to next field after "Next" button
- [ ] Focus trapped in modal/dropdown when open
- [ ] Focus visible with high-contrast outline (3:1 minimum)
- [ ] Skip links allow jumping to main content
- [ ] Focus never lost (always on a valid element)
- [ ] Tab order follows visual order
- [ ] Shift+Tab works in reverse

### Definition of Done
- WCAG 2.4.3 Focus Order passes
- WCAG 2.4.7 Focus Visible passes
- Keyboard-only users complete workflow without mouse

---

## Story 5.3: Screen Reader Announcements
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** screen reader user
**I want** important changes announced to me
**So that** I know what's happening on the page

### Acceptance Criteria
- [ ] `aria-live="polite"` region for non-critical updates
- [ ] `aria-live="assertive"` for conflicts/errors
- [ ] Loading states announced: "Loading suggestions..."
- [ ] Success announced: "Applied: elderly street musician"
- [ ] Validation errors announced immediately
- [ ] Progress updates announced: "Step 2 of 3"
- [ ] Dynamic content changes communicated

### Definition of Done
- WCAG 4.1.3 Status Messages passes
- Screen reader testing with NVDA, JAWS, VoiceOver
- All dynamic updates announced appropriately

---

## Story 5.4: Form Label Improvements
**Priority:** 🟡 MEDIUM | **Story Points:** 3

**As a** screen reader user
**I want** clear labels for every form field
**So that** I understand what each input is for

### Acceptance Criteria
- [ ] Every input has associated `<label>` element
- [ ] Labels use `for` attribute pointing to input ID
- [ ] Required fields indicated with "required" in label
- [ ] Optional fields indicated with "(optional)" in label
- [ ] Descriptor fields have clear relationships explained
- [ ] `aria-describedby` links to help text
- [ ] No placeholder-only labels

### Definition of Done
- WCAG 1.3.1 Info and Relationships passes
- WCAG 3.3.2 Labels or Instructions passes
- Screen reader reads all labels correctly

---

## Story 5.5: Error Identification and Suggestions
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user who made an error
**I want** clear error messages with suggestions to fix
**So that** I can correct mistakes easily

### Acceptance Criteria
- [ ] Error messages in `role="alert"` for immediate announcement
- [ ] Errors linked to specific fields with `aria-describedby`
- [ ] Error text explains what's wrong and how to fix
- [ ] Errors visible inline (not just in summary)
- [ ] Color not the only indicator (icon + text required)
- [ ] Focus moves to first error on submit
- [ ] Errors cleared when field corrected

### Definition of Done
- WCAG 3.3.1 Error Identification passes
- WCAG 3.3.3 Error Suggestion passes
- Users with color blindness can identify errors

---

## Story 5.6: Color Contrast Compliance
**Priority:** 🟡 MEDIUM | **Story Points:** 3

**As a** user with low vision
**I want** sufficient color contrast
**So that** I can read all text and see all controls

### Acceptance Criteria
- [ ] All text meets 4.5:1 contrast ratio (AA standard)
- [ ] Large text (18pt+) meets 3:1 contrast ratio
- [ ] UI components meet 3:1 contrast ratio
- [ ] Focus indicators meet 3:1 contrast ratio
- [ ] Placeholders meet minimum contrast
- [ ] Disabled states still readable
- [ ] Works in dark mode (if applicable)

### Definition of Done
- WCAG 1.4.3 Contrast Minimum passes
- WCAG 1.4.11 Non-text Contrast passes
- Automated contrast checker shows no failures

---

# Epic 6: Performance Optimization

**Epic Goal:** Reduce API calls by 80% and improve response time for better user experience

**Business Value:** Reduce server costs, improve perceived performance, enable offline-first features

---

## Story 6.1: Unified API Endpoint
**Priority:** 🔴 CRITICAL | **Story Points:** 13

**As a** developer
**I want** a single API endpoint that returns all validation data
**So that** we reduce network overhead and improve performance

### Acceptance Criteria
- [ ] New endpoint: `POST /api/video/analyze`
- [ ] Accepts: `{ elements, analysisTypes: ['conflicts', 'refinements', 'technical', 'compatibility'] }`
- [ ] Returns all requested analyses in single response
- [ ] Replaces 4 separate endpoints (conflicts, refinements, technical, compatibility)
- [ ] Response cached server-side for 30 seconds (same elements)
- [ ] Client deduplicates identical requests
- [ ] Backward compatible (old endpoints still work during migration)
- [ ] Error handling for partial failures

### Definition of Done
- API calls per session reduced from 150 to ~30
- Response time <500ms for combined endpoint
- Server load reduced by 70%
- All tests passing

---

## Story 6.2: Smarter Debouncing Strategy
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user typing quickly
**I want** the system to wait until I finish typing
**So that** I see relevant suggestions without unnecessary API calls

### Acceptance Criteria
- [ ] Debounce increased from 300ms to 1000ms for typing
- [ ] Validation triggers on blur (not keystroke)
- [ ] First character types immediately shows cached suggestions
- [ ] API calls only after 1 second of no typing
- [ ] Loading indicator appears after 800ms (not immediately)
- [ ] User can press Enter to trigger immediate search
- [ ] Debounce canceled on field change

### Definition of Done
- API calls reduced by 60% during typing
- User testing shows no perceived lag
- Suggestions still feel responsive

---

## Story 6.3: Request Cancellation with AbortController
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user making rapid changes
**I want** outdated requests to be canceled
**So that** I don't see stale suggestions

### Acceptance Criteria
- [ ] AbortController implemented for all fetch requests
- [ ] Previous request aborted when new request starts
- [ ] Race conditions prevented (only latest response used)
- [ ] Cleanup on component unmount
- [ ] Error handling for aborted requests (silent)
- [ ] Works with debouncing system
- [ ] No memory leaks

### Definition of Done
- Zero race condition bugs in testing
- No console errors from aborted requests
- Memory profiling shows proper cleanup

---

## Story 6.4: Optimistic UI Updates
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** user
**I want** immediate feedback when I make changes
**So that** the interface feels fast and responsive

### Acceptance Criteria
- [ ] Local compatibility estimation before API call
- [ ] Estimated score shown immediately (marked as "estimating...")
- [ ] Real score replaces estimate when API returns
- [ ] Smooth transition from estimate to real value
- [ ] Conflict detection runs locally first (basic rules)
- [ ] API verifies and enhances local results
- [ ] Rollback if API contradicts optimistic update

### Definition of Done
- Perceived performance improves (feels instant)
- Estimates accurate within 20% of real scores
- No jarring visual changes when real data arrives

---

## Story 6.5: Aggressive Suggestion Caching
**Priority:** 🟡 MEDIUM | **Story Points:** 5

**As a** user
**I want** previously seen suggestions to appear instantly
**So that** I don't wait for the same data twice

### Acceptance Criteria
- [ ] Suggestions cached in memory for 5 minutes
- [ ] Cache key: element type + partial value (first 3 words)
- [ ] Cache hit returns results in <10ms
- [ ] Cache miss triggers API call
- [ ] Cache cleared on page refresh
- [ ] Cache size limited to 100 entries (LRU eviction)
- [ ] Cache shared across form fields (same subject suggestions everywhere)

### Definition of Done
- 60%+ suggestion requests served from cache
- No memory issues with cache
- Cache hit rate tracked in analytics

---

## Story 6.6: Component Code Splitting
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** user loading the page
**I want** fast initial page load
**So that** I can start working immediately

### Acceptance Criteria
- [ ] Lazy load technical parameters panel (dynamic import)
- [ ] Lazy load refinement suggestions panel
- [ ] Lazy load template library
- [ ] Core workflow loads immediately (<50KB)
- [ ] Secondary features load on demand
- [ ] Loading states for lazy components
- [ ] Preload on hover (anticipate user need)
- [ ] Bundle size reduced by 40%

### Definition of Done
- Initial bundle size <100KB (gzipped)
- Time to interactive <2 seconds
- Lighthouse performance score >90

---

# Epic 7: Enhanced Validation & Feedback

**Epic Goal:** Make validation helpful instead of anxiety-inducing, show all calculated scores to users

**Business Value:** Increase user confidence, reduce errors, improve prompt quality

---

## Story 7.1: Display Compatibility Scores
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user
**I want** to see compatibility scores for my elements
**So that** I know if my choices work well together

### Acceptance Criteria
- [ ] Compatibility score shown below each input: ●●●●○ 85%
- [ ] Color coding: >80% green, 60-80% yellow, <60% red
- [ ] Text description: "✓ Works well with your concept"
- [ ] Scores update in real-time as elements change
- [ ] Tooltip explains what compatibility means
- [ ] Overall concept compatibility shown in header
- [ ] Low scores suggest alternatives

### Definition of Done
- Wasted API calls now provide user value
- User testing shows scores help decision-making
- High scores correlate with better prompts (validated)

---

## Story 7.2: Inline Conflict Resolution
**Priority:** 🔴 CRITICAL | **Story Points:** 8

**As a** user with conflicting elements
**I want** conflicts shown inline with quick fixes
**So that** I can resolve issues without anxiety

### Acceptance Criteria
- [ ] Conflicts shown directly on the problematic field (not separate panel)
- [ ] Gentle info color (blue, not amber warning)
- [ ] Message: "ℹ️ Tip: 'racing' may conflict with underwater physics"
- [ ] Quick fix buttons: [Use "gliding"] [Use "navigating"] [Keep "racing"]
- [ ] One-click application of suggested fix
- [ ] No scary loading spinner
- [ ] Conflicts resolved dismiss automatically
- [ ] Can ignore conflicts (not blocking)

### Definition of Done
- User anxiety reduced (measured in user testing)
- 80%+ users apply suggested fixes
- No complaints about "error" messages

---

## Story 7.3: Prompt Quality Score Display
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user
**I want** to see the quality score of my prompt
**So that** I can improve it before generating

### Acceptance Criteria
- [ ] Quality score shown: "Your Prompt Quality: 78/100"
- [ ] Breakdown panel expandable
- [ ] Checklist format:
  - ✓ Core elements complete
  - ✓ Good specificity
  - ⚠ Add mood for better results
  - ○ Style field empty
- [ ] Score updates in real-time
- [ ] Visual indicator: >85 = excellent, 70-85 = good, <70 = needs work
- [ ] Tips to improve score

### Definition of Done
- Validation score visible to all users
- Score accurately predicts prompt success
- Users act on improvement suggestions

---

## Story 7.4: Better Loading States
**Priority:** 🟡 MEDIUM | **Story Points:** 5

**As a** user waiting for AI suggestions
**I want** clear feedback that something is happening
**So that** I don't think the app is broken

### Acceptance Criteria
- [ ] Consistent loading pattern across all panels
- [ ] Skeleton loaders instead of spinners
- [ ] Estimated wait time shown (e.g., "~2 seconds")
- [ ] Progress indication for long operations
- [ ] Loading state in suggestions dropdown
- [ ] No jarring color changes (amber vs neutral)
- [ ] Graceful degradation if API is slow

### Definition of Done
- All loading states use same visual pattern
- User testing shows reduced anxiety during loading
- Perceived performance improves

---

## Story 7.5: Error Handling with Retry
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user experiencing network issues
**I want** clear error messages with retry options
**So that** I can recover from failures easily

### Acceptance Criteria
- [ ] Network errors shown inline (not console only)
- [ ] Friendly message: "Couldn't load suggestions. Check your connection."
- [ ] [Try again] button prominent
- [ ] Offline detection: "You're offline. Work saved locally."
- [ ] Exponential backoff for retries (3 attempts)
- [ ] Different messages for different error types
- [ ] Error doesn't block other fields (partial failure OK)

### Definition of Done
- Zero silent failures
- 90%+ users successfully retry after error
- Offline mode gracefully degrades features

---

# Epic 8: Component Refactoring

**Epic Goal:** Break down the 1,924-line monolith into maintainable, testable components

**Business Value:** Improve developer productivity, reduce bugs, enable faster feature development

---

## Story 8.1: Extract WorkflowHeader Component
**Priority:** 🟡 MEDIUM | **Story Points:** 5

**As a** developer
**I want** the header logic separated into its own component
**So that** it's easier to maintain and test

### Acceptance Criteria
- [ ] New file: `components/WorkflowHeader.jsx` (~150 lines)
- [ ] Props: progress, currentStep, onStepChange
- [ ] Self-contained state for UI (collapse/expand)
- [ ] Unit tests for progress calculation
- [ ] Storybook story for all states
- [ ] No business logic (pure presentation)
- [ ] Fully typed with PropTypes or TypeScript

### Definition of Done
- Component extracted and working
- Tests achieve 90%+ coverage
- Main file reduced by 150 lines

---

## Story 8.2: Extract ElementInputCard Component
**Priority:** 🟡 MEDIUM | **Story Points:** 5

**As a** developer
**I want** a reusable input card component
**So that** all 10 element inputs use the same code

### Acceptance Criteria
- [ ] New file: `components/ElementInputCard.jsx` (~100 lines)
- [ ] Props: elementType, value, onChange, suggestions, isRequired, examples
- [ ] Handles own suggestion dropdown
- [ ] Manages focus state
- [ ] Accessibility built-in
- [ ] Visual variants: required (blue) vs optional (neutral)
- [ ] Reused 10 times (no duplication)

### Definition of Done
- All element inputs use same component
- DRY principle followed
- Main file reduced by 400+ lines

---

## Story 8.3: Create Custom Hooks for Logic
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** developer
**I want** complex logic in custom hooks
**So that** it's reusable and testable

### Acceptance Criteria
- [ ] `useElementValidation.js` - validation logic
- [ ] `useSuggestions.js` - suggestion fetching and caching
- [ ] `useConflictDetection.js` - conflict analysis
- [ ] `useSubjectComposition.js` - subject descriptor logic
- [ ] Each hook <200 lines
- [ ] Unit tests for each hook
- [ ] Documentation with usage examples
- [ ] Hooks composable (can use together)

### Definition of Done
- Main component uses custom hooks
- Hooks testable in isolation
- Logic reusable across components

---

## Story 8.4: Split Into Feature Modules
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** developer
**I want** the component organized by feature
**So that** I can find and modify code easily

### Acceptance Criteria
- [ ] Directory structure:
  ```
  VideoConceptBuilder/
  ├── index.jsx (orchestrator, 100 lines)
  ├── components/
  ├── hooks/
  ├── utils/
  └── constants/
  ```
- [ ] Main file imports and composes sub-components
- [ ] No circular dependencies
- [ ] Each module single responsibility
- [ ] Barrel exports for clean imports
- [ ] README documenting structure

### Definition of Done
- Main file <200 lines
- All features still working
- Build size same or smaller
- Developer onboarding improved

---

## Story 8.5: Improve Test Coverage
**Priority:** 🟡 MEDIUM | **Story Points:** 13

**As a** developer
**I want** comprehensive tests
**So that** I can refactor with confidence

### Acceptance Criteria
- [ ] Unit tests for all hooks
- [ ] Component tests for all sub-components
- [ ] Integration test for full workflow
- [ ] Test coverage >80%
- [ ] Tests run in <10 seconds
- [ ] Mock API calls properly
- [ ] Test accessibility (jest-axe)
- [ ] Test keyboard navigation

### Definition of Done
- Coverage report shows >80% for all files
- All edge cases covered
- CI/CD pipeline enforces coverage threshold

---

# Epic 9: Visual Design System

**Epic Goal:** Implement consistent visual language across the component

**Business Value:** Professional appearance, improved usability, easier maintenance

---

## Story 9.1: Typography Scale Standardization
**Priority:** 🟡 MEDIUM | **Story Points:** 3

**As a** designer
**I want** a consistent typography system
**So that** hierarchy is clear and maintainable

### Acceptance Criteria
- [ ] Define 5-level type scale (display, h1, h2, h3, body, small)
- [ ] Remove duplicate sizes (H2 and H3 currently identical)
- [ ] Font weights: bold (700), semibold (600), medium (500), normal (400)
- [ ] Update all text to use scale
- [ ] Document in design system file
- [ ] Tailwind config updated with custom scale

### Definition of Done
- Only 5 font sizes used (down from 7)
- Visual hierarchy improved
- Design system documented

---

## Story 9.2: Color Palette Simplification
**Priority:** 🟡 MEDIUM | **Story Points:** 3

**As a** designer
**I want** a focused color palette
**So that** the UI feels cohesive

### Acceptance Criteria
- [ ] Define palette: Primary (blue), Success (green), Warning (amber), Neutral (gray), Accent (violet)
- [ ] Remove unused colors
- [ ] Consistent color meaning: blue = primary action, green = success, amber = caution
- [ ] Update all elements to use palette
- [ ] Remove gradients (dated aesthetic)
- [ ] Document color usage guidelines

### Definition of Done
- Only 5 color families used
- Color usage consistent throughout
- No random color values in code

---

## Story 9.3: Spacing System Implementation
**Priority:** 🟡 MEDIUM | **Story Points:** 3

**As a** developer
**I want** consistent spacing
**So that** layout is predictable

### Acceptance Criteria
- [ ] Use 8px base unit consistently
- [ ] Spacing scale: xs=8px, sm=16px, md=24px, lg=32px, xl=48px
- [ ] Replace random gap values (gap-2, gap-3, gap-4, gap-6) with scale
- [ ] Consistent padding on cards (px-6 py-6)
- [ ] Vertical rhythm throughout
- [ ] Document spacing rules

### Definition of Done
- All spacing uses defined scale
- Visual balance improved
- CSS reduced (fewer unique values)

---

## Story 9.4: Component Visual Variants
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user
**I want** visual distinction between element priorities
**So that** I know what's required vs optional

### Acceptance Criteria
- [ ] Required fields: Blue accent border, larger size, "★ REQUIRED" badge
- [ ] Optional fields: Neutral border, smaller size, "Optional" badge
- [ ] Completed fields: Green checkmark, subtle background
- [ ] Active field: Highlighted border, subtle shadow
- [ ] Disabled/locked fields: Grayed out, lock icon
- [ ] Consistent across all element types

### Definition of Done
- User testing shows 95%+ can identify required fields
- Visual hierarchy clear
- Works in all states (empty, filled, error, disabled)

---

## Story 9.5: Icon System Standardization
**Priority:** ⚪ LOW | **Story Points:** 3

**As a** developer
**I want** consistent icon usage
**So that** visual language is coherent

### Acceptance Criteria
- [ ] Use single icon library (lucide-react)
- [ ] Tree-shake unused icons
- [ ] Consistent icon size: 16px (small), 20px (medium), 24px (large)
- [ ] Icons always have text labels (accessibility)
- [ ] Icon color inherits from parent (not hardcoded)
- [ ] Document icon usage guidelines

### Definition of Done
- Only used icons in bundle
- Bundle size reduced by 20KB
- Icons accessible to screen readers

---

# Epic 10: Feature Enhancements

**Epic Goal:** Add value-adding features that improve user experience and productivity

**Business Value:** Competitive differentiation, user satisfaction, reduced data loss

---

## Story 10.1: Auto-Save to LocalStorage
**Priority:** 🟠 HIGH | **Story Points:** 5

**As a** user
**I want** my work automatically saved
**So that** I don't lose progress if I refresh or close the browser

### Acceptance Criteria
- [ ] Auto-save every 10 seconds if changes detected
- [ ] Save to localStorage with unique key
- [ ] Restore on page load with confirmation: "Restore draft from [time]?"
- [ ] Clear draft after successful prompt generation
- [ ] Multiple drafts supported (list of recent drafts)
- [ ] Storage limit handled gracefully (clear oldest)
- [ ] Privacy-conscious (localStorage only, no server)

### Definition of Done
- Zero reports of lost work
- User testing shows auto-save discovered and trusted
- Edge cases handled (storage full, corrupted data)

---

## Story 10.2: Template Gallery Expansion
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** new user
**I want** many pre-built templates to start from
**So that** I can learn by example and work faster

### Acceptance Criteria
- [ ] Expand from 3 to 20+ templates
- [ ] Categories: Product Demo, Nature Documentary, Urban Action, etc.
- [ ] Template preview modal before loading
- [ ] Search/filter templates by category or keyword
- [ ] Template includes example output preview
- [ ] Templates tagged by difficulty (beginner, advanced)
- [ ] "Start from scratch" still available

### Definition of Done
- 20+ high-quality templates available
- 60%+ users start with template (vs 20% currently)
- Template adoption tracked in analytics

---

## Story 10.3: Undo/Redo Functionality
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** user experimenting with ideas
**I want** to undo and redo changes
**So that** I can explore options without fear

### Acceptance Criteria
- [ ] Undo/redo stack implemented (max 50 actions)
- [ ] Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
- [ ] Undo/redo buttons visible in header
- [ ] Buttons disabled when stack empty
- [ ] Actions tracked: element changes, template loads, descriptor adds/removes
- [ ] Visual feedback when undoing/redoing
- [ ] Works with auto-save

### Definition of Done
- Undo/redo works reliably
- No performance issues with history stack
- User testing shows feature discovery and use

---

## Story 10.4: Share Concept via URL
**Priority:** 🟡 MEDIUM | **Story Points:** 8

**As a** user who created a great concept
**I want** to share it with collaborators
**So that** they can use or remix it

### Acceptance Criteria
- [ ] "Share" button generates shareable URL
- [ ] URL encodes all element values (query params or hash)
- [ ] Loading shared URL populates form automatically
- [ ] Confirmation: "Open shared concept from [creator]?"
- [ ] URL length handled (compress if needed)
- [ ] Works with templates (share template + modifications)
- [ ] Privacy: no data sent to server (client-side only)

### Definition of Done
- Shared URLs work reliably
- URL length <2000 characters
- Feature used by 10%+ users

---

## Story 10.5: Concept Variation Generator
**Priority:** ⚪ LOW | **Story Points:** 13

**As a** user with a good concept
**I want** AI to generate variations
**So that** I can explore different creative directions

### Acceptance Criteria
- [ ] "Generate variations" button after concept complete
- [ ] AI suggests 5 variations: lighting, mood, style, perspective
- [ ] Each variation previewed side-by-side
- [ ] One-click to load variation into builder
- [ ] Compare variations feature
- [ ] Export multiple variations at once
- [ ] Uses existing AI endpoint (no new infrastructure)

### Definition of Done
- Variations are creative and useful
- 30%+ users try variation feature
- Variation quality validated by users

---

# Summary & Prioritization

## Sprint 1 (2 weeks) - Critical Foundation
**Focus:** Remove blockers, implement wizard mode, inline suggestions

| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| 1.1 | Wizard Mode - Linear Step Flow | 13 | 🔴 Critical |
| 1.2 | Remove Mode Selection Confusion | 5 | 🔴 Critical |
| 3.1 | Inline Dropdown Suggestions | 13 | 🔴 Critical |
| 3.2 | Remove Suggestions Sidebar | 5 | 🔴 Critical |
| 4.1 | Remove Redundant Progress Cards | 3 | 🔴 Critical |
| **Total** | | **39 points** | |

## Sprint 2 (2 weeks) - Mobile & Accessibility
**Focus:** Make mobile usable, fix critical accessibility issues

| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| 2.1 | Mobile Wizard Layout | 8 | 🔴 Critical |
| 2.2 | Bottom Sheet Suggestions Panel | 8 | 🔴 Critical |
| 5.2 | Focus Management System | 8 | 🔴 Critical |
| 7.2 | Inline Conflict Resolution | 8 | 🔴 Critical |
| 4.2 | Hide Advanced Features Initially | 5 | 🔴 Critical |
| 1.3 | Visual Progress Tracking | 5 | 🟠 High |
| **Total** | | **42 points** | |

## Sprint 3 (2 weeks) - Performance & Polish
**Focus:** Optimize API calls, improve feedback systems

| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| 6.1 | Unified API Endpoint | 13 | 🔴 Critical |
| 7.1 | Display Compatibility Scores | 5 | 🟠 High |
| 7.3 | Prompt Quality Score Display | 5 | 🟠 High |
| 6.2 | Smarter Debouncing Strategy | 5 | 🟠 High |
| 6.3 | Request Cancellation | 5 | 🟠 High |
| 5.1 | Keyboard Shortcut Discoverability | 5 | 🟠 High |
| **Total** | | **38 points** | |

## Sprint 4 (2 weeks) - Feature Enhancements
**Focus:** Add value-adding features, improve design system

| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| 10.1 | Auto-Save to LocalStorage | 5 | 🟠 High |
| 10.2 | Template Gallery Expansion | 8 | 🟡 Medium |
| 10.3 | Undo/Redo Functionality | 8 | 🟡 Medium |
| 8.1-8.4 | Component Refactoring (all) | 26 | 🟡 Medium |
| **Total** | | **47 points** | |

---

## Total Story Count by Priority

- 🔴 **Critical:** 12 stories, 96 points
- 🟠 **High:** 15 stories, 91 points
- 🟡 **Medium:** 20 stories, 130 points
- ⚪ **Low:** 5 stories, 18 points

**Grand Total:** 52 user stories, 335 story points (~8-10 sprints of work)

---

## Recommended Rollout Strategy

### Phase 1: MVP (Sprints 1-2) - 6 weeks
- Wizard mode working
- Mobile usable
- Inline suggestions
- Critical accessibility fixes
- **Goal:** Achieve 60% completion rate

### Phase 2: Optimization (Sprints 3-4) - 4 weeks
- Performance improvements
- Better feedback systems
- Auto-save
- Enhanced validation
- **Goal:** Reduce API calls 80%, improve perceived performance

### Phase 3: Enhancement (Sprints 5-6) - 4 weeks
- Template expansion
- Undo/redo
- Component refactoring
- Design system polish
- **Goal:** Professional polish, developer experience improved

### Phase 4: Advanced Features (Sprints 7-8) - 4 weeks
- Share via URL
- Variation generator
- Advanced customization
- Full test coverage
- **Goal:** Competitive differentiation

---

**Ready for sprint planning!** Export to Jira, Linear, or your project management tool.
