import React, { memo, useRef, useEffect } from 'react';
import {
  Search,
  FileText,
  Lightbulb,
  LogIn,
  LogOut,
  PanelLeft,
  GraduationCap,
  Video,
  MessageSquare,
  X,
  Trash2
} from 'lucide-react';
import { getAuthRepository } from '../../repositories';
import { HistoryEmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

// Memoized history item component with delete functionality
const HistoryItem = memo(({ entry, modes, onLoad, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const modeInfo = modes.find((m) => m.id === entry.mode);
  const ModeIcon = modeInfo?.icon || FileText;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (showDeleteConfirm) {
      // Confirmed - actually delete
      onDelete(entry.id);
      setShowDeleteConfirm(false);
    } else {
      // Show confirmation
      setShowDeleteConfirm(true);
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleLoad = () => {
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

// Auth Menu Component
const AuthMenu = ({ user, onSignIn, onSignOut }) => {
  const [showAuthMenu, setShowAuthMenu] = React.useState(false);
  const authMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target)) {
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

  return (
    <div className="relative" ref={authMenuRef}>
      <button
        onClick={() => setShowAuthMenu(!showAuthMenu)}
        className="flex w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-neutral-100"
        aria-expanded={showAuthMenu}
        aria-label="User menu"
      >
        <img
          src={user.photoURL}
          alt=""
          className="h-7 w-7 flex-shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-medium text-neutral-900">
            {user.displayName}
          </p>
          <p className="truncate text-[11px] text-neutral-500">
            {user.email}
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
};

// Main History Sidebar Component
export const HistorySidebar = ({
  showHistory,
  user,
  history,
  filteredHistory,
  isLoadingHistory,
  searchQuery,
  onSearchChange,
  onLoadFromHistory,
  onCreateNew,
  onDelete,
  modes
}) => {
  const toast = useToast();

  const handleSignIn = async () => {
    try {
      const authRepository = getAuthRepository();
      const user = await authRepository.signInWithGoogle();
      toast.success(`Welcome, ${user.displayName}!`);
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
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
          <div className="flex-shrink-0 px-4 pt-20 pb-2">
            {!user && (
              <p className="mb-2 text-[11px] text-neutral-500">
                Sign in to sync across devices
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 pt-14">
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
              <nav aria-label="Recent prompts list">
                <ul className="space-y-0.5">
                  {filteredHistory.map((entry) => (
                    <HistoryItem
                      key={entry.id}
                      entry={entry}
                      modes={modes}
                      onLoad={onLoadFromHistory}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              </nav>
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
};