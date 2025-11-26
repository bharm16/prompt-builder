import React, { memo, useRef, useEffect } from 'react';
import {
  FileText,
  LogIn,
  LogOut,
  PanelLeft,
  PanelRight,
  Trash2,
  Plus,
  History,
  User as UserIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAuthRepository } from '../../repositories';
import { HistoryEmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import type { User, PromptHistoryEntry } from '../../hooks/types';
import type { Mode } from '../prompt-optimizer/context/types';

interface HistoryItemProps {
  entry: PromptHistoryEntry;
  modes: Mode[];
  onLoad: (entry: PromptHistoryEntry) => void;
  onDelete: (id: string) => void;
}

// Memoized history item component with delete functionality
const HistoryItem = memo<HistoryItemProps>(({ entry, modes, onLoad, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<boolean>(false);
  const modeInfo = modes.find((m) => m.id === entry.mode);
  const ModeIcon: LucideIcon = modeInfo?.icon || FileText;

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (showDeleteConfirm) {
      // Confirmed - actually delete
      if (entry.id) {
        onDelete(entry.id);
      }
      setShowDeleteConfirm(false);
    } else {
      // Show confirmation
      setShowDeleteConfirm(true);
    }
  };

  const handleCancel = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleLoad = (): void => {
    if (!showDeleteConfirm) {
      onLoad(entry);
    }
  };

  if (showDeleteConfirm) {
    return (
      <li>
        <div className="group w-full rounded-geist-lg p-geist-3 bg-red-50 border border-red-200">
          <p className="text-label-12 text-red-900 mb-geist-2">Delete this prompt?</p>
          <div className="flex gap-geist-2">
            <Button
              onClick={handleDelete}
              size="small"
              variant="primary"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
            <Button
              onClick={handleCancel}
              size="small"
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="group relative w-full rounded-geist-lg transition-colors hover:bg-geist-accents-1">
        <button
          onClick={handleLoad}
          className="w-full p-geist-3 text-left"
          aria-label={`Load prompt: ${entry.input.substring(0, 50)}...`}
        >
          <div className="flex items-start gap-geist-3">
            <ModeIcon
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-geist-accents-4"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-label-12 text-geist-foreground line-clamp-1 leading-relaxed">
                {entry.input}
              </p>
              <div className="mt-geist-2 flex items-center gap-geist-2 text-label-12 text-geist-accents-5">
                <time dateTime={entry.timestamp || ''}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                </time>
              </div>
            </div>
          </div>
        </button>
        
        {/* Delete button - shows on hover */}
        <button
          onClick={handleDelete}
          className="absolute right-geist-2 top-geist-2 p-geist-2 opacity-0 group-hover:opacity-100 rounded-geist hover:bg-red-50 transition-all"
          aria-label="Delete prompt"
          title="Delete prompt"
        >
          <Trash2 className="h-3.5 w-3.5 text-geist-accents-4 hover:text-red-600" />
        </button>
      </div>
    </li>
  );
}, (prevProps, nextProps) => {
  return prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.input === nextProps.entry.input &&
    prevProps.entry.score === nextProps.entry.score;
});

HistoryItem.displayName = 'HistoryItem';

interface AuthMenuProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

// Auth Menu Component
function AuthMenu({ user, onSignIn, onSignOut }: AuthMenuProps): React.ReactElement {
  const [showAuthMenu, setShowAuthMenu] = React.useState<boolean>(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target as Node)) {
        setShowAuthMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <Button
        onClick={onSignIn}
        size="small"
        variant="primary"
        prefix={<LogIn className="h-3.5 w-3.5" />}
        className="w-full"
        aria-label="Sign in with Google"
      >
        Sign in
      </Button>
    );
  }

  const photoURL = typeof user.photoURL === 'string' ? user.photoURL : '';
  const displayName = typeof user.displayName === 'string' ? user.displayName : '';
  const email = typeof user.email === 'string' ? user.email : '';

  return (
    <div className="relative" ref={authMenuRef}>
      <button
        onClick={() => setShowAuthMenu(!showAuthMenu)}
        className="flex w-full items-center gap-geist-2 rounded-geist-lg p-geist-2 transition-colors hover:bg-geist-accents-1"
        aria-expanded={showAuthMenu}
        aria-label="User menu"
      >
        {photoURL && (
          <img
            src={photoURL}
            alt=""
            className="h-7 w-7 flex-shrink-0 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-label-12 text-geist-foreground">
            {displayName}
          </p>
          <p className="truncate text-label-12 text-geist-accents-5">
            {email}
          </p>
        </div>
      </button>

      {showAuthMenu && (
        <div className="absolute bottom-full mb-geist-2 left-0 w-full bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-medium py-geist-1">
          <Button
            onClick={onSignOut}
            size="small"
            variant="ghost"
            prefix={<LogOut className="h-3.5 w-3.5" />}
            className="w-full"
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

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

// Main History Sidebar Component
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
  const toast = useToast();
  const [showAllHistory, setShowAllHistory] = React.useState<boolean>(false);
  const INITIAL_HISTORY_LIMIT = 5;

  // Determine which history items to display
  const displayedHistory = showAllHistory 
    ? filteredHistory 
    : filteredHistory.slice(0, INITIAL_HISTORY_LIMIT);

  const handleSignIn = async (): Promise<void> => {
    try {
      const authRepository = getAuthRepository();
      const signedInUser = await authRepository.signInWithGoogle();
      const displayName = typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'User';
      toast.success(`Welcome, ${displayName}!`);
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      const authRepository = getAuthRepository();
      await authRepository.signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out');
    }
  };

  const isCollapsed = !showHistory;

  return (
    <aside
      id="history-sidebar"
      className={`${showHistory ? 'w-72' : 'w-16'} fixed left-0 top-0 z-sticky h-screen max-h-screen overflow-hidden border-r border-geist-accents-2 bg-geist-background transition-all duration-300`}
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

