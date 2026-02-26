import React, { createContext, useContext, type ReactNode } from 'react';
import type {
  OptionalToolSidebarAssetsDomain,
  OptionalToolSidebarGenerationDomain,
  OptionalToolSidebarPromptInteractionDomain,
  OptionalToolSidebarSessionsDomain,
  OptionalToolSidebarWorkspaceDomain,
} from '../types';

export interface SidebarDataContextValue {
  sessions: OptionalToolSidebarSessionsDomain;
  promptInteraction: OptionalToolSidebarPromptInteractionDomain;
  generation: OptionalToolSidebarGenerationDomain;
  assets: OptionalToolSidebarAssetsDomain;
  workspace: OptionalToolSidebarWorkspaceDomain;
}

const SidebarDataContext = createContext<SidebarDataContextValue | null>(null);
const SidebarSessionsContext = createContext<OptionalToolSidebarSessionsDomain>(null);
const SidebarPromptInteractionContext = createContext<OptionalToolSidebarPromptInteractionDomain>(null);
const SidebarGenerationContext = createContext<OptionalToolSidebarGenerationDomain>(null);
const SidebarAssetsContext = createContext<OptionalToolSidebarAssetsDomain>(null);
const SidebarWorkspaceContext = createContext<OptionalToolSidebarWorkspaceDomain>(null);

export function useSidebarData(): SidebarDataContextValue | null {
  return useContext(SidebarDataContext);
}

export function useSidebarSessionsDomain(): OptionalToolSidebarSessionsDomain {
  const sidebarData = useContext(SidebarDataContext);
  const legacy = useContext(SidebarSessionsContext);
  return sidebarData?.sessions ?? legacy;
}

export function useSidebarPromptInteractionDomain(): OptionalToolSidebarPromptInteractionDomain {
  const sidebarData = useContext(SidebarDataContext);
  const legacy = useContext(SidebarPromptInteractionContext);
  return sidebarData?.promptInteraction ?? legacy;
}

export function useSidebarGenerationDomain(): OptionalToolSidebarGenerationDomain {
  const sidebarData = useContext(SidebarDataContext);
  const legacy = useContext(SidebarGenerationContext);
  return sidebarData?.generation ?? legacy;
}

export function useSidebarAssetsDomain(): OptionalToolSidebarAssetsDomain {
  const sidebarData = useContext(SidebarDataContext);
  const legacy = useContext(SidebarAssetsContext);
  return sidebarData?.assets ?? legacy;
}

export function useSidebarWorkspaceDomain(): OptionalToolSidebarWorkspaceDomain {
  const sidebarData = useContext(SidebarDataContext);
  const legacy = useContext(SidebarWorkspaceContext);
  return sidebarData?.workspace ?? legacy;
}

export function SidebarDataContextProvider({
  value,
  children,
}: {
  value: SidebarDataContextValue | null;
  children: ReactNode;
}): React.ReactElement {
  return <SidebarDataContext.Provider value={value}>{children}</SidebarDataContext.Provider>;
}

export function SidebarSessionsContextProvider({
  value,
  children,
}: {
  value: OptionalToolSidebarSessionsDomain;
  children: ReactNode;
}): React.ReactElement {
  return <SidebarSessionsContext.Provider value={value}>{children}</SidebarSessionsContext.Provider>;
}

export function SidebarPromptInteractionContextProvider({
  value,
  children,
}: {
  value: OptionalToolSidebarPromptInteractionDomain;
  children: ReactNode;
}): React.ReactElement {
  return (
    <SidebarPromptInteractionContext.Provider value={value}>
      {children}
    </SidebarPromptInteractionContext.Provider>
  );
}

export function SidebarGenerationContextProvider({
  value,
  children,
}: {
  value: OptionalToolSidebarGenerationDomain;
  children: ReactNode;
}): React.ReactElement {
  return <SidebarGenerationContext.Provider value={value}>{children}</SidebarGenerationContext.Provider>;
}

export function SidebarAssetsContextProvider({
  value,
  children,
}: {
  value: OptionalToolSidebarAssetsDomain;
  children: ReactNode;
}): React.ReactElement {
  return <SidebarAssetsContext.Provider value={value}>{children}</SidebarAssetsContext.Provider>;
}

export function SidebarWorkspaceContextProvider({
  value,
  children,
}: {
  value: OptionalToolSidebarWorkspaceDomain;
  children: ReactNode;
}): React.ReactElement {
  return <SidebarWorkspaceContext.Provider value={value}>{children}</SidebarWorkspaceContext.Provider>;
}
