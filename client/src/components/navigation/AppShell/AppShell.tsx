/**
 * Unified navigation orchestrator.
 *
 * Renders appropriate shell variant based on current route:
 * - 'topnav': Marketing pages (horizontal navbar)
 * - 'sidebar': Workspace pages (vertical sidebar)
 * - 'none': Auth pages (no shell)
 */

import { memo, useEffect, useState, type ReactElement } from 'react';

import { ToolSidebar } from '@components/ToolSidebar';
import type { User } from '@hooks/types';
import { getAuthRepository } from '@repositories/index';
import type { Asset, AssetType } from '@shared/types/asset';

import type { AppShellProps } from './types';
import { useNavigationConfig } from './hooks/useNavigationConfig';
import { TopNavbar } from './variants/TopNavbar';

const noop = (..._args: unknown[]): void => {};
const EMPTY_ASSETS_BY_TYPE: Record<AssetType, Asset[]> = {
  character: [],
  style: [],
  location: [],
  object: [],
};

export const AppShell = memo(function AppShell(props: AppShellProps): ReactElement {
  const { children, toolSidebarProps, ...restProps } = props;
  const mergedProps = {
    ...(toolSidebarProps ?? {}),
    ...restProps,
  };
  const {
    history = [],
    filteredHistory = [],
    isLoadingHistory = false,
    searchQuery = '',
    onSearchChange = noop,
    onLoadFromHistory = noop,
    onCreateNew = noop,
    onDelete = noop,
    onDuplicate,
    onRename,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
    prompt = '',
    onPromptChange,
    onOptimize,
    showResults,
    isProcessing,
    isRefining,
    genericOptimizedPrompt,
    promptInputRef,
    onCreateFromTrigger,
    aspectRatio = '16:9',
    duration = 5,
    selectedModel = '',
    onModelChange = noop,
    onAspectRatioChange = noop,
    onDurationChange = noop,
    onDraft = noop,
    onRender = noop,
    isDraftDisabled = true,
    isRenderDisabled = true,
    onImageUpload,
    keyframes = [],
    onAddKeyframe = noop,
    onRemoveKeyframe = noop,
    onClearKeyframes,
    tier = 'render',
    onTierChange = noop,
    onStoryboard = noop,
    activeDraftModel = null,
    showMotionControls = false,
    cameraMotion = null,
    onCameraMotionChange = noop,
    subjectMotion = '',
    onSubjectMotionChange = noop,
    assets = [],
    assetsByType,
    isLoadingAssets = false,
    onInsertTrigger = noop,
    onEditAsset = noop,
    onCreateAsset = noop,
  } = mergedProps;
  const { variant, navItems } = useNavigationConfig();
  const [user, setUser] = useState<User | null>(null);
  const resolvedAssetsByType = assetsByType ?? EMPTY_ASSETS_BY_TYPE;

  useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  if (variant === 'none') {
    return <>{children}</>;
  }

  if (variant === 'topnav') {
    return (
      <div className="flex min-h-full flex-col bg-app">
        <TopNavbar navItems={navItems.topNav} user={user} />
        <div className="min-h-0 flex-1 pt-[var(--global-top-nav-height)]">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-app">
      <ToolSidebar
        user={user}
        history={history}
        filteredHistory={filteredHistory}
        isLoadingHistory={isLoadingHistory}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLoadFromHistory={onLoadFromHistory}
        onCreateNew={onCreateNew}
        onDelete={onDelete}
        {...(typeof onDuplicate === 'function' ? { onDuplicate } : {})}
        {...(typeof onRename === 'function' ? { onRename } : {})}
        {...(currentPromptUuid !== undefined ? { currentPromptUuid } : {})}
        {...(currentPromptDocId !== undefined ? { currentPromptDocId } : {})}
        {...(typeof activeStatusLabel === 'string' ? { activeStatusLabel } : {})}
        {...(typeof activeModelLabel === 'string' ? { activeModelLabel } : {})}
        prompt={prompt}
        {...(typeof onPromptChange === 'function' ? { onPromptChange } : {})}
        {...(typeof onOptimize === 'function' ? { onOptimize } : {})}
        {...(typeof showResults === 'boolean' ? { showResults } : {})}
        {...(typeof isProcessing === 'boolean' ? { isProcessing } : {})}
        {...(typeof isRefining === 'boolean' ? { isRefining } : {})}
        genericOptimizedPrompt={genericOptimizedPrompt ?? null}
        {...(promptInputRef ? { promptInputRef } : {})}
        {...(typeof onCreateFromTrigger === 'function' ? { onCreateFromTrigger } : {})}
        aspectRatio={aspectRatio}
        duration={duration}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        onAspectRatioChange={onAspectRatioChange}
        onDurationChange={onDurationChange}
        onDraft={onDraft}
        onRender={onRender}
        isDraftDisabled={isDraftDisabled}
        isRenderDisabled={isRenderDisabled}
        {...(typeof onImageUpload === 'function' ? { onImageUpload } : {})}
        keyframes={keyframes}
        onAddKeyframe={onAddKeyframe}
        onRemoveKeyframe={onRemoveKeyframe}
        {...(typeof onClearKeyframes === 'function' ? { onClearKeyframes } : {})}
        tier={tier}
        onTierChange={onTierChange}
        onStoryboard={onStoryboard}
        {...(activeDraftModel !== null ? { activeDraftModel } : {})}
        showMotionControls={showMotionControls}
        cameraMotion={cameraMotion}
        onCameraMotionChange={onCameraMotionChange}
        subjectMotion={subjectMotion}
        onSubjectMotionChange={onSubjectMotionChange}
        assets={assets}
        assetsByType={resolvedAssetsByType}
        isLoadingAssets={isLoadingAssets}
        onInsertTrigger={onInsertTrigger}
        onEditAsset={onEditAsset}
        onCreateAsset={onCreateAsset}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
        {children}
      </div>
    </div>
  );
});

AppShell.displayName = 'AppShell';
