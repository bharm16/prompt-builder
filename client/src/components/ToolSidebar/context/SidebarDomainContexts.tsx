import React, { createContext, useContext, type ReactNode } from 'react';
import type {
  OptionalToolSidebarAssetsDomain,
  OptionalToolSidebarGenerationDomain,
  OptionalToolSidebarPromptEditingDomain,
  OptionalToolSidebarSessionsDomain,
} from '../types';

const SidebarSessionsContext = createContext<OptionalToolSidebarSessionsDomain>(null);
const SidebarPromptEditingContext = createContext<OptionalToolSidebarPromptEditingDomain>(null);
const SidebarGenerationContext = createContext<OptionalToolSidebarGenerationDomain>(null);
const SidebarAssetsContext = createContext<OptionalToolSidebarAssetsDomain>(null);

export function useSidebarSessionsDomain(): OptionalToolSidebarSessionsDomain {
  return useContext(SidebarSessionsContext);
}

export function useSidebarPromptEditingDomain(): OptionalToolSidebarPromptEditingDomain {
  return useContext(SidebarPromptEditingContext);
}

export function useSidebarGenerationDomain(): OptionalToolSidebarGenerationDomain {
  return useContext(SidebarGenerationContext);
}

export function useSidebarAssetsDomain(): OptionalToolSidebarAssetsDomain {
  return useContext(SidebarAssetsContext);
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

export function SidebarPromptEditingContextProvider({
  value,
  children,
}: {
  value: OptionalToolSidebarPromptEditingDomain;
  children: ReactNode;
}): React.ReactElement {
  return <SidebarPromptEditingContext.Provider value={value}>{children}</SidebarPromptEditingContext.Provider>;
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
