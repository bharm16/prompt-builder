import React from "react";
import { FEATURES } from "@/config/features.config";
import { CanvasWorkspace as LegacyCanvasWorkspace } from "./CanvasWorkspace";
import { UnifiedCanvasWorkspace } from "./UnifiedCanvasWorkspace";

type CanvasWorkspaceImpl = typeof LegacyCanvasWorkspace;

const Impl: CanvasWorkspaceImpl = FEATURES.UNIFIED_WORKSPACE
  ? (UnifiedCanvasWorkspace as CanvasWorkspaceImpl)
  : LegacyCanvasWorkspace;

export const CanvasWorkspace: CanvasWorkspaceImpl = (props) => (
  <Impl {...props} />
);
