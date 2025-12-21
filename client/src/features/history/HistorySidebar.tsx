import React from 'react';
import {
  LogIn,
  PanelLeft,
  PanelRight,
  Plus,
  History,
  User as UserIcon,
} from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { HistoryEmptyState } from '@components/EmptyState';
import { useToast } from '@components/Toast';
import { Button } from '@components/Button';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { User, PromptHistoryEntry } from '@hooks/types';
import type { Mode } from '../prompt-optimizer/context/types';
import { HistoryItem } from './components/HistoryItem';
import { AuthMenu } from './components/AuthMenu';

export interface HistorySidebarProps {
  showHistory: boolean; // true = expanded, false = collapsed
  setShowHistory: (show: boolean) => void;
  user: User | null;
  history: PromptHistoryEntry[];
  filteredHistory: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLoadFromHistory: (entry: PromptHistoryEntry) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
  modes: Mode[];
}

const INITIAL_HISTORY_LIMIT = 5;

/**
 * History sidebar component with collapsed/expanded states
 */
export function HistorySidebar({
  showHistory,
  setShowHistory,
  user,
  history,
  filteredHistory,
  isLoadingHistory,
  searchQuery,
  onSearchChange,
  onCreateNew,
  onLoadFromHistory,
  onDelete,
  modes
}: HistorySidebarProps): React.ReactElement {
  const debug = useDebugLogger('HistorySidebar', {
    historyCount: history.length,
    isExpanded: showHistory,
    isAuthenticated: !!user
  });
  const toast = useToast();
  const [showAllHistory, setShowAllHistory] = React.useState<boolean>(false);

  // Determine which history items to display
  const displayedHistory = showAllHistory 
    ? filteredHistory 
    : filteredHistory.slice(0, INITIAL_HISTORY_LIMIT);

  const handleSignIn = async (): Promise<void> => {
    debug.logAction('signIn');
    debug.startTimer('signIn');
    try {
      const authRepository = getAuthRepository();
      const signedInUser = await authRepository.signInWithGoogle();
      const displayName = typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'User';
      debug.endTimer('signIn', 'Sign in successful');
      toast.success(`Welcome, ${displayName}!`);
    } catch (error) {
      debug.endTimer('signIn');
      debug.logError('Sign in failed', error as Error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async (): Promise<void> => {
    debug.logAction('signOut');
    try {
      const authRepository = getAuthRepository();
      await authRepository.signOut();
      debug.logAction('signOutComplete');
      toast.success('Signed out successfully');
    } catch (error) {
      debug.logError('Sign out failed', error as Error);
      toast.error('Failed to sign out');
    }
  };

  const isCollapsed = !showHistory;

  return (
    <aside
      id="history-sidebar"
      className="h-screen overflow-y-auto border-r border-geist-accents-2 bg-geist-background transition-all duration-300"
      style={{
        width: 'var(--sidebar-width)',
      }}
      aria-label="Prompt history"
    >
      {isCollapsed ? (
        // Collapsed state - icon-only sidebar
        <div className="flex h-screen max-h-screen flex-col overflow-hidden">
          {/* Header with expand button */}
          <header className="flex-shrink-0 px-geist-2 py-geist-3">
            <Button
              onClick={() => setShowHistory(true)}
              svgOnly
              variant="ghost"
              prefix={<PanelRight className="h-5 w-5 text-geist-accents-6" />}
              className="w-full"
              aria-label="Expand sidebar"
            />
          </header>

          {/* New Prompt button - icon only */}
          <div className="flex-shrink-0 px-geist-2 py-geist-2">
            <Button
              onClick={onCreateNew}
              svgOnly
              variant="ghost"
              prefix={<Plus className="h-5 w-5 text-orange-500" />}
              className="w-full hover:bg-orange-50"
              aria-label="Create new prompt"
              title="New Prompt"
            />
          </div>

          {/* History icon - shows recent count */}
          <div className="flex-shrink-0 px-geist-2 py-geist-2">
            <div className="relative">
              <Button
                onClick={() => setShowHistory(true)}
                svgOnly
                variant="ghost"
                prefix={<History className="h-5 w-5 text-geist-accents-6" />}
                className="w-full"
                aria-label="Show history"
                title="History"
              />
              {filteredHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 h-geist-4 w-geist-4 bg-orange-500 text-white text-label-12 rounded-full flex items-center justify-center">
                  {filteredHistory.length > 9 ? '9+' : filteredHistory.length}
                </span>
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Auth Section - icon only */}
          <footer className="flex-shrink-0 border-t border-geist-accents-1 p-geist-2">
            {!user ? (
              <Button
                onClick={handleSignIn}
                svgOnly
                variant="ghost"
                prefix={<LogIn className="h-5 w-5 text-geist-accents-6" />}
                className="w-full"
                aria-label="Sign in"
                title="Sign in"
              />
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-full p-geist-2 hover:bg-geist-accents-1 rounded-geist-lg transition-colors flex items-center justify-center"
                  aria-label="User menu"
                  title={typeof user.displayName === 'string' ? user.displayName : 'User'}
                >
                  {typeof user.photoURL === 'string' && user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <UserIcon className="h-5 w-5 text-geist-accents-6" />
                  )}
                </button>
              </div>
            )}
          </footer>
        </div>
      ) : (
        // Expanded state - full sidebar
        <div className="flex h-screen max-h-screen flex-col overflow-hidden">
          {/* Header with toggle + title */}
          <header className="flex-shrink-0 px-geist-4 py-geist-3">
            <div className="flex items-center gap-geist-3">
              <Button
                onClick={() => setShowHistory(false)}
                svgOnly
                variant="ghost"
                prefix={<PanelLeft className="h-5 w-5 text-geist-accents-6" />}
                aria-label="Collapse sidebar"
              />
              <h1 className="text-heading-20 text-geist-foreground">Prompt Builder</h1>
            </div>
          </header>

          {/* New Prompt button */}
          <div className="flex-shrink-0 px-geist-4 py-geist-3">
            <Button
              onClick={onCreateNew}
              size="small"
              variant="primary"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              aria-label="Create new prompt"
            >
              New Prompt
            </Button>
          </div>

          {/* Sign-in message */}
          {!user && (
            <div className="flex-shrink-0 px-geist-4 pb-geist-2">
              <p className="text-label-12 text-geist-accents-5">
                Sign in to sync across devices
              </p>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pt-5 pb-2">
            <h2 className="px-geist-2 mb-geist-2 text-label-12 text-geist-foreground tracking-wide">
              Recent
            </h2>
            {isLoadingHistory ? (
              <div className="p-geist-4 text-center">
                <div className="spinner-sm mx-auto mb-geist-2" />
                <p className="text-label-12 text-geist-accents-5">
                  Loading...
                </p>
              </div>
            ) : filteredHistory.length === 0 && searchQuery ? (
              <div className="p-geist-4 text-center">
                <p className="text-label-12 text-geist-accents-5">
                  No results for &quot;{searchQuery}&quot;
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <HistoryEmptyState onCreateNew={onCreateNew} />
            ) : (
              <>
                <nav aria-label="Recent prompts list">
                  <ul className="space-y-geist-1">
                    {displayedHistory.map((entry) => (
                      <HistoryItem
                        key={entry.id || entry.uuid || Math.random()}
                        entry={entry}
                        modes={modes}
                        onLoad={onLoadFromHistory}
                        onDelete={onDelete}
                      />
                    ))}
                  </ul>
                </nav>
                {filteredHistory.length > INITIAL_HISTORY_LIMIT && (
                  <Button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    variant="ghost"
                    size="small"
                    className="w-full text-left text-geist-accents-5 hover:text-geist-accents-7"
                  >
                    {showAllHistory ? 'See less' : 'See more...'}
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Auth Section */}
          <footer className="flex-shrink-0 border-t border-geist-accents-1 p-geist-3">
            <AuthMenu
              user={user}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          </footer>
        </div>
      )}
    </aside>
  );
}
