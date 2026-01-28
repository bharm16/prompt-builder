# Requirements Document

## Introduction

This specification addresses bugs and issues identified in the AI suggestions workflow. The workflow handles fetching, processing, and displaying AI-powered enhancement suggestions when users highlight text in the prompt editor. The primary issues are race conditions causing stale results, poor error handling, and missing request management.

## Priority

Requirements are prioritized as follows:
- **P0 (Critical)**: Race conditions causing users to see wrong suggestions
- **P1 (High)**: Error handling and timeout issues
- **P2 (Medium)**: Request debouncing and UX improvements
- **P3 (Low)**: Code quality and maintainability

## Glossary

- **Suggestion_Fetch_Hook**: The `useSuggestionFetch` hook that orchestrates fetching enhancement suggestions from the API
- **Custom_Request_Hook**: The `useCustomRequest` hook that handles user-initiated custom suggestion requests
- **Suggestions_State_Hook**: The `useSuggestionsState` hook that manages category grouping and active category selection
- **Suggestions_Panel**: The main UI component that displays AI suggestions to users
- **Suggestions_List**: The component that renders individual suggestion items
- **Enhancement_API**: The client-side API layer for fetching enhancement suggestions
- **Custom_Suggestions_API**: The client-side API layer for fetching custom suggestions
- **Backend_API**: The server-side API that returns suggestions with unique identifiers

## Requirements

### Requirement 1: Request Cancellation and Stale Result Prevention (P0)

**User Story:** As a user, I want previous suggestion requests to be cancelled when I make a new selection, so that I always see suggestions for my current selection and never see stale results.

#### Acceptance Criteria

1. WHEN a new suggestion fetch is initiated WHILE a previous request is in-flight, THEN THE Suggestion_Fetch_Hook SHALL cancel the previous request
2. WHEN a request is cancelled, THEN THE Enhancement_API SHALL not propagate the cancellation as an error to the UI
3. WHEN a request is cancelled, THEN THE Suggestion_Fetch_Hook SHALL not update state with the cancelled request's results
4. THE Custom_Suggestions_API SHALL support request cancellation
5. THE Enhancement_API SHALL support request cancellation

### Requirement 2: Request Deduplication (P0)

**User Story:** As a user, I want duplicate requests to be prevented, so that the system doesn't waste resources and I don't see flickering UI states.

#### Acceptance Criteria

1. WHEN a request is made for the same highlighted text that is currently loading, THEN THE Suggestion_Fetch_Hook SHALL not initiate a duplicate request
2. THE deduplication check SHALL use a ref-based approach to access current in-flight request state rather than stale closure values
3. WHEN the highlighted text changes during a request, THEN THE Suggestion_Fetch_Hook SHALL allow the new request to proceed

### Requirement 3: Error Handling (P1)

**User Story:** As a user, I want clear error feedback when suggestions fail to load, so that I understand what went wrong and can retry.

#### Acceptance Criteria

1. WHEN an API error occurs, THEN THE Custom_Request_Hook SHALL set the isError state to true instead of displaying error text as a suggestion
2. WHEN an API error occurs, THEN THE Suggestions_Panel SHALL display the ErrorState component with appropriate messaging
3. WHEN an error is displayed, THEN THE ErrorState component SHALL include a "Retry" button that re-initiates the request
4. WHEN a network timeout occurs, THEN THE Enhancement_API SHALL throw a descriptive timeout error
5. THE Enhancement_API SHALL use a timeout of 3 seconds for suggestion requests
6. THE Custom_Suggestions_API SHALL use a timeout of 3 seconds for suggestion requests

### Requirement 4: Request Debouncing (P2)

**User Story:** As a user, I want rapid text selections to be debounced, so that the system waits for me to finish selecting before fetching suggestions.

#### Acceptance Criteria

1. THE Suggestion_Fetch_Hook SHALL debounce suggestion requests with a 150ms delay
2. WHEN multiple selections occur within the debounce window, THEN THE Suggestion_Fetch_Hook SHALL only execute the most recent request
3. THE debounce interval SHALL be configurable via API_CONFIG

### Requirement 5: Loading State UX (P2)

**User Story:** As a user, I want clear visual feedback while suggestions are loading, so that I know the system is working.

#### Acceptance Criteria

1. WHILE suggestions are loading, THEN THE Suggestions_Panel SHALL display a skeleton loading state
2. THE loading skeleton SHALL display a fixed count of 5 placeholder items
3. WHEN a new request starts while previous suggestions are displayed, THEN THE Suggestions_Panel SHALL show the skeleton loading state (replacing previous suggestions)

### Requirement 6: Suggestion Caching (P2)

**User Story:** As a user, I want previously fetched suggestions to be cached, so that re-selecting the same text shows instant results.

#### Acceptance Criteria

1. WHEN suggestions are successfully fetched, THEN THE Enhancement_API SHALL cache the results
2. THE cache key SHALL include: highlighted text, surrounding context (±100 chars before/after), and full prompt hash
3. WHEN the same cache key is requested within the cache TTL, THEN THE Suggestion_Fetch_Hook SHALL return cached results without an API call
4. THE cache TTL SHALL be 5 minutes as configured in API_CONFIG
5. WHEN any cache key component differs, THEN a cache miss SHALL occur and a fresh request SHALL be made

### Requirement 7: Unique Suggestion Identifiers (P2)

**User Story:** As a developer, I want each suggestion to have a unique identifier, so that React can properly reconcile the DOM and track user interactions.

#### Acceptance Criteria

1. THE Backend_API SHALL return a unique `id` field for each suggestion in the response
2. THE Suggestions_List SHALL use the suggestion `id` as the React key
3. WHEN the backend does not provide an id, THEN THE Suggestions_List SHALL generate a deterministic fallback key using a hash of text content and index

### Requirement 8: State Synchronization (P3)

**User Story:** As a user, I want the suggestions panel to always reflect the current suggestions data accurately.

#### Acceptance Criteria

1. WHEN the suggestions prop changes, THEN THE Suggestions_State_Hook SHALL synchronize internal state with the new prop value
2. WHEN suggestions are updated externally, THEN THE Suggestions_State_Hook SHALL preserve the active category if it still exists in the new data
3. WHEN the active category no longer exists in new suggestions, THEN THE Suggestions_State_Hook SHALL fall back to the first available category

### Requirement 9: Clipboard Feedback (P3)

**User Story:** As a user, I want visual feedback when I copy a suggestion, so that I know the copy succeeded.

#### Acceptance Criteria

1. WHEN clipboard write succeeds, THEN THE Suggestions_List SHALL display a brief "Copied!" toast or visual indicator
2. WHEN clipboard write fails, THEN THE Suggestions_List SHALL handle the error gracefully without crashing
3. THE Suggestions_List SHALL use proper async error handling for clipboard operations


## Testing Requirements

All P0 and P1 requirements SHALL have unit tests covering their acceptance criteria. Specifically:

1. Request cancellation (Req 1) SHALL have tests verifying cancelled requests don't update state
2. Request deduplication (Req 2) SHALL have tests verifying duplicate requests are prevented
3. Error handling (Req 3) SHALL have tests verifying error states are properly set and retry functionality works
