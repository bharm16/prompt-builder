import React, { memo, useRef, useEffect } from 'react';
import {
  FileText,
  LogIn,
  LogOut,
  PanelLeft,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAuthRepository } from '../../repositories';
import { HistoryEmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
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
        <div className="group w-full rounded-lg p-3 bg-red-50 border border-red-200">
          <p className="text-xs text-red-900 mb-2">Delete this prompt?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="flex-1 px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-2 py-1 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="group relative w-full rounded-lg transition-colors hover:bg-neutral-100">
        <button
          onClick={handleLoad}
          className="w-full p-3 text-left"
          aria-label={`Load prompt: ${entry.input.substring(0, 50)}...`}
        >
          <div className="flex items-start gap-2.5">
            <ModeIcon
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-neutral-400"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-900 line-clamp-1 leading-relaxed">
                {entry.input}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
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
          className="absolute right-2 top-2 p-1.5 opacity-0 group-hover:opacity-100 rounded hover:bg-red-50 transition-all"
          aria-label="Delete prompt"
          title="Delete prompt"
        >
          <Trash2 className="h-3.5 w-3.5 text-neutral-400 hover:text-red-600" />
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
      <button
        onClick={onSignIn}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
        aria-label="Sign in with Google"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign in</span>
      </button>
    );
  }

  const photoURL = typeof user.photoURL === 'string' ? user.photoURL : '';
  const displayName = typeof user.displayName === 'string' ? user.displayName : '';
  const email = typeof user.email === 'string' ? user.email : '';

  return (
    <div className="relative" ref={authMenuRef}>
      <button
        onClick={() => setShowAuthMenu(!showAuthMenu)}
        className="flex w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-neutral-100"
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
          <p className="truncate text-xs font-medium text-neutral-900">
            {displayName}
          </p>
          <p className="truncate text-[11px] text-neutral-500">
            {email}
          </p>
        </div>
      </button>

      {showAuthMenu && (
        <div className="absolute bottom-full mb-2 left-0 w-full bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export interface HistorySidebarProps {
  showHistory: boolean;
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

  return (
    <aside
      id="history-sidebar"
      className={`${showHistory ? 'w-72' : 'w-0'} fixed left-0 top-0 z-sticky h-screen max-h-screen overflow-hidden border-r border-neutral-200 bg-white transition-all duration-300`}
      aria-label="Prompt history"
      aria-hidden={!showHistory}
    >
      {showHistory && (
        <div className="flex h-screen max-h-screen flex-col overflow-hidden">
          {/* Header with toggle + title */}
          <header className="flex-shrink-0 px-4 py-3 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
                aria-label="Close sidebar"
              >
                <PanelLeft className="h-5 w-5 text-neutral-600" />
              </button>
              <h1 className="text-lg font-semibold text-neutral-900">Prompt Builder</h1>
            </div>
          </header>

          {/* New Prompt button */}
          <div className="flex-shrink-0 px-4 py-3">
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              aria-label="Create new prompt"
            >
              <span>New Prompt</span>
            </button>
          </div>

          {/* Sign-in message */}
          {!user && (
            <div className="flex-shrink-0 px-4 pb-2">
              <p className="text-[11px] text-neutral-500">
                Sign in to sync across devices
              </p>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pt-5 pb-2">
            <h2 className="px-2 mb-2 text-xs font-semibold text-neutral-900 tracking-wide">
              Recent
            </h2>
            {isLoadingHistory ? (
              <div className="p-4 text-center">
                <div className="spinner-sm mx-auto mb-2" />
                <p className="text-xs text-neutral-500">
                  Loading...
                </p>
              </div>
            ) : filteredHistory.length === 0 && searchQuery ? (
              <div className="p-4 text-center">
                <p className="text-xs text-neutral-500">
                  No results for &quot;{searchQuery}&quot;
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <HistoryEmptyState onCreateNew={onCreateNew} />
            ) : (
              <>
                <nav aria-label="Recent prompts list">
                  <ul className="space-y-0.5">
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
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="w-full px-2 py-2 text-xs text-neutral-500 hover:text-neutral-700 transition-colors text-left"
                  >
                    {showAllHistory ? 'See less' : 'See more...'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Auth Section */}
          <footer className="flex-shrink-0 border-t border-neutral-100 p-3">
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

