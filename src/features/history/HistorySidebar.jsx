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
  X
} from 'lucide-react';
import { signInWithGoogle, signOutUser } from '../../firebase';
import { HistoryEmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

// Memoized history item component for performance
const HistoryItem = memo(({ entry, modes, onLoad }) => {
  const modeInfo = modes.find((m) => m.id === entry.mode);
  const ModeIcon = modeInfo?.icon || FileText;

  return (
    <li className="stagger-item">
      <button
        onClick={() => onLoad(entry)}
        className="group w-full rounded-lg p-3 text-left transition-all duration-200 hover:bg-white focus-ring hover-scale"
        aria-label={`Load prompt: ${entry.input.substring(0, 50)}...`}
      >
        <div className="flex items-start gap-2">
          <ModeIcon
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500 group-hover:text-primary-700 transition-colors"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-neutral-900 font-medium">
              {entry.input}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <time dateTime={entry.timestamp || ''}>
                {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : 'No date'}
              </time>
              <span>•</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800">
                {entry.score}%
              </span>
            </div>
          </div>
        </div>
      </button>
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
        className="btn-primary w-full hover-scale"
        aria-label="Sign in with Google"
      >
        <LogIn className="h-4 w-4" />
        <span className="text-sm font-semibold">Sign in with Google</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={authMenuRef}>
      <button
        onClick={() => setShowAuthMenu(!showAuthMenu)}
        className="flex w-full items-center gap-2 rounded-lg p-2 transition-all duration-200 hover:bg-white focus-ring"
        aria-expanded={showAuthMenu}
        aria-label="User menu"
      >
        <img
          src={user.photoURL}
          alt=""
          className="h-8 w-8 flex-shrink-0 rounded-full ring-2 ring-neutral-200"
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {user.displayName}
          </p>
          <p className="truncate text-xs text-neutral-600">
            {user.email}
          </p>
        </div>
      </button>

      {showAuthMenu && (
        <div className="dropdown-menu bottom-full mb-2 left-0 w-full">
          <button
            onClick={onSignOut}
            className="dropdown-item text-error-600"
          >
            <LogOut className="h-4 w-4 mr-2" />
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
  modes
}) => {
  const toast = useToast();

  const handleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      toast.success(`Welcome, ${user.displayName}!`);
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <aside
      id="history-sidebar"
      className={`${showHistory ? 'w-72' : 'w-0'} fixed left-0 top-0 z-sticky h-screen max-h-screen overflow-hidden border-r border-neutral-200 bg-neutral-50 transition-all duration-300`}
      aria-label="Prompt history"
      aria-hidden={!showHistory}
    >
      {showHistory && (
        <div className="flex h-screen max-h-screen flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-neutral-200 p-4 pt-20">
            <h2 className="font-semibold text-neutral-900">
              Recent Prompts
            </h2>
            {!user && (
              <p className="mt-1 text-xs text-neutral-600">
                Sign in to sync across devices
              </p>
            )}

            {/* Search History */}
            {history.length > 0 && (
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search history..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:bg-white focus:border-primary-600 focus:ring-1 focus:ring-primary-600 transition-colors shadow-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-neutral-100 rounded"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
            {isLoadingHistory ? (
              <div className="p-4 text-center">
                <div className="spinner-sm mx-auto mb-2" />
                <p className="text-sm text-neutral-500">
                  Loading history...
                </p>
              </div>
            ) : filteredHistory.length === 0 && searchQuery ? (
              <div className="p-4 text-center">
                <p className="text-sm text-neutral-500">
                  No results for "{searchQuery}"
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <HistoryEmptyState onCreateNew={onCreateNew} />
            ) : (
              <nav aria-label="Recent prompts list">
                <ul className="space-y-1">
                  {filteredHistory.map((entry) => (
                    <HistoryItem
                      key={entry.id}
                      entry={entry}
                      modes={modes}
                      onLoad={onLoadFromHistory}
                    />
                  ))}
                </ul>
              </nav>
            )}
          </div>

          {/* Auth Section */}
          <footer className="flex-shrink-0 border-t border-neutral-200 bg-neutral-50 p-3">
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