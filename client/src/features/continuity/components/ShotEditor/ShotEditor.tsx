import React, { useEffect, useMemo, useState } from 'react';
import type { ContinuitySession, CreateShotInput, ContinuityMode, GenerationMode } from '../../types';
import { IDENTITY_KEYFRAME_CREDIT_COST, STYLE_KEYFRAME_CREDIT_COST } from '../../constants';
import { StrengthSlider } from '../StyleReferencePanel/StrengthSlider';
import { ContinuityModeToggle } from './ContinuityModeToggle';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { capabilitiesApi } from '@/services';
import { useModelRegistry } from '@/hooks/useModelRegistry';
import { toCanonicalModelId, toCapabilityModelId } from '../../utils/modelIds';

interface ShotEditorProps {
  session: ContinuitySession;
  generationMode: GenerationMode;
  onAddShot: (input: CreateShotInput) => Promise<void> | void;
}

const parseNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function ShotEditor({
  session,
  generationMode,
  onAddShot,
}: ShotEditorProps): React.ReactElement {
  const [prompt, setPrompt] = useState('');
  const [continuityMode, setContinuityMode] = useState<ContinuityMode>(
    session.defaultSettings.defaultContinuityMode
  );
  const [styleStrength, setStyleStrength] = useState(
    session.defaultSettings.defaultStyleStrength
  );
  const [styleReferenceId, setStyleReferenceId] = useState<string | null>(null);
  const [modelId, setModelId] = useState(
    toCapabilityModelId(session.defaultSettings.defaultModel) || ''
  );
  const [useCharacter, setUseCharacter] = useState(
    Boolean(session.defaultSettings.useCharacterConsistency)
  );
  const [characterAssetId, setCharacterAssetId] = useState('');
  const [useCameraHints, setUseCameraHints] = useState(false);
  const [cameraYaw, setCameraYaw] = useState('');
  const [cameraPitch, setCameraPitch] = useState('');
  const [cameraRoll, setCameraRoll] = useState('');
  const [cameraDolly, setCameraDolly] = useState('');
  const [usePreviousReference, setUsePreviousReference] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { models: registryModels, isLoading: modelsLoading } = useModelRegistry();
  const [capabilityRegistry, setCapabilityRegistry] = useState<
    Record<string, Record<string, CapabilitiesSchema>> | null
  >(null);
  const [registryError, setRegistryError] = useState<string | null>(null);

  useEffect(() => {
    setContinuityMode(session.defaultSettings.defaultContinuityMode);
    setStyleStrength(session.defaultSettings.defaultStyleStrength);
    setModelId(toCapabilityModelId(session.defaultSettings.defaultModel) || '');
    const lastShot = session.shots[session.shots.length - 1];
    setStyleReferenceId(lastShot?.id ?? null);
    setUseCharacter(Boolean(session.defaultSettings.useCharacterConsistency));
    setUsePreviousReference(false);
  }, [session.id, session.defaultSettings, session.shots]);

  useEffect(() => {
    let active = true;
    capabilitiesApi
      .getRegistry()
      .then((registry) => {
        if (!active) return;
        setCapabilityRegistry(registry);
        setRegistryError(null);
      })
      .catch((error) => {
        if (!active) return;
        setRegistryError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  const styleReferenceOptions = useMemo(() => {
    const options: Array<{ label: string; value: string | null }> = [
      { label: 'Primary reference', value: null },
    ];
    session.shots.forEach((shot) => {
      options.push({ label: `Shot ${shot.sequenceIndex + 1}`, value: shot.id });
    });
    return options;
  }, [session.shots]);

  const hasPreviousShot = session.shots.length > 0;
  const showContinuityControls = generationMode === 'continuity';
  const requiresCharacterConsistency = useCharacter || session.defaultSettings.useCharacterConsistency;

  const capabilityMap = useMemo(() => {
    if (!capabilityRegistry) return {};
    const entries: Record<string, CapabilitiesSchema> = {};
    for (const models of Object.values(capabilityRegistry)) {
      for (const [id, schema] of Object.entries(models)) {
        entries[id] = schema;
      }
    }
    return entries;
  }, [capabilityRegistry]);

  const hasRegistry = Boolean(capabilityRegistry);
  const isContinuityCapable = (capabilityId: string): boolean => {
    if (!hasRegistry) return true;
    const schema = capabilityMap[capabilityId];
    if (!schema) return false;
    const supportsImage = schema.fields?.image_input?.default === true;
    const supportsStyle = schema.fields?.style_reference?.default === true;
    return supportsImage || supportsStyle;
  };

  const continuityEligibleModels = useMemo(
    () => registryModels.filter((model) => isContinuityCapable(model.id)),
    [registryModels, capabilityMap]
  );

  const availableModels = showContinuityControls && continuityEligibleModels.length
    ? continuityEligibleModels
    : registryModels;

  const selectedModelSchema = modelId ? capabilityMap[modelId] : undefined;
  const selectedSupportsImage = selectedModelSchema?.fields?.image_input?.default === true;
  const selectedSupportsStyle = selectedModelSchema?.fields?.style_reference?.default === true;
  const selectedContinuityEligible = hasRegistry
    ? Boolean(selectedSupportsImage || selectedSupportsStyle)
    : true;
  const resolvedModelId = useMemo(() => toCanonicalModelId(modelId), [modelId]);
  const modelResolvable = !modelId || Boolean(resolvedModelId);
  const canSubmitContinuity =
    !showContinuityControls || (selectedContinuityEligible && modelResolvable);

  useEffect(() => {
    if (!showContinuityControls || !continuityEligibleModels.length) return;
    if (modelId && selectedContinuityEligible) return;
    const fallback = continuityEligibleModels[0];
    if (fallback) {
      setModelId(fallback.id);
    }
  }, [showContinuityControls, continuityEligibleModels, modelId, selectedContinuityEligible]);

  const overheadInfo = useMemo(() => {
    if (generationMode === 'continuity' && continuityMode === 'style-match') {
      return requiresCharacterConsistency
        ? { cost: IDENTITY_KEYFRAME_CREDIT_COST, label: 'identity keyframe' }
        : { cost: STYLE_KEYFRAME_CREDIT_COST, label: 'style keyframe' };
    }

    if (generationMode === 'standard' && useCharacter && characterAssetId) {
      return { cost: IDENTITY_KEYFRAME_CREDIT_COST, label: 'character keyframe' };
    }

    return { cost: 0, label: '' };
  }, [
    generationMode,
    continuityMode,
    requiresCharacterConsistency,
    useCharacter,
    characterAssetId,
  ]);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setIsSubmitting(true);
    try {
      const camera = useCameraHints
        ? {
            yaw: parseNumber(cameraYaw),
            pitch: parseNumber(cameraPitch),
            ...(cameraRoll ? { roll: parseNumber(cameraRoll) } : {}),
            ...(cameraDolly ? { dolly: parseNumber(cameraDolly) } : {}),
          }
        : undefined;

      const resolvedModelId = toCanonicalModelId(modelId) || undefined;
      const input: CreateShotInput = {
        prompt: prompt.trim(),
        generationMode,
        continuityMode:
          generationMode === 'continuity'
            ? continuityMode
            : usePreviousReference
              ? 'frame-bridge'
              : 'none',
        styleStrength: showContinuityControls ? styleStrength : undefined,
        styleReferenceId: showContinuityControls ? styleReferenceId : undefined,
        modelId: resolvedModelId,
        characterAssetId: useCharacter && characterAssetId ? characterAssetId : undefined,
        camera,
      };

      await onAddShot(input);
      setPrompt('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Add Shot</h3>
        {showContinuityControls ? (
          <span className="text-xs text-muted">Continuity mode</span>
        ) : (
          <span className="text-xs text-muted">Standard mode</span>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className="w-full min-h-[96px] rounded-lg border border-border bg-surface-1 p-3 text-sm"
        placeholder="Describe the next shot"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted">Model</label>
          <select
            value={modelId || ''}
            onChange={(event) => setModelId(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
            disabled={modelsLoading || availableModels.length === 0}
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          {registryError && (
            <div className="mt-1 text-[11px] text-warning">
              Unable to load model registry ({registryError}). Showing fallback models.
            </div>
          )}
          {showContinuityControls && hasRegistry && !selectedContinuityEligible && (
            <div className="mt-1 text-[11px] text-warning">
              Selected model does not support image input or native style reference. Choose another
              model for continuity.
            </div>
          )}
          {showContinuityControls && !modelResolvable && (
            <div className="mt-1 text-[11px] text-warning">
              Selected model is not supported for generation. Choose a supported model.
            </div>
          )}
          {showContinuityControls && hasRegistry && continuityEligibleModels.length === 0 && (
            <div className="mt-1 text-[11px] text-warning">
              No continuity-capable models are available. Check provider credentials.
            </div>
          )}
          {showContinuityControls && !hasRegistry && (
            <div className="mt-1 text-[11px] text-warning">
              Model capabilities unavailable; continuity eligibility will be enforced on the server.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="use-character"
            type="checkbox"
            checked={useCharacter}
            onChange={(event) => setUseCharacter(event.target.checked)}
          />
          <label htmlFor="use-character" className="text-sm text-muted">
            Use character reference
          </label>
        </div>
      </div>

      {overheadInfo.cost > 0 && (
        <div className="text-xs text-muted">
          Continuity overhead: +{overheadInfo.cost} credits ({overheadInfo.label})
        </div>
      )}

      {useCharacter && (
        <input
          type="text"
          value={characterAssetId}
          onChange={(event) => setCharacterAssetId(event.target.value)}
          placeholder="Character asset ID"
          className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
        />
      )}

      {showContinuityControls ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted mb-2">Continuity mode</div>
            <ContinuityModeToggle value={continuityMode} onChange={setContinuityMode} />
            {!hasPreviousShot && continuityMode === 'frame-bridge' && (
              <div className="mt-2 text-xs text-warning">
                Frame bridge requires a previous generated shot.
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Style source</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
              value={styleReferenceId ?? 'primary'}
              onChange={(event) => {
                const value = event.target.value || 'primary';
                setStyleReferenceId(value === 'primary' ? null : value);
              }}
            >
              {styleReferenceOptions.map((option) => (
                <option key={option.value ?? 'primary'} value={option.value ?? 'primary'}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {continuityMode === 'style-match' && (
            <StrengthSlider value={styleStrength} onChange={setStyleStrength} />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">Camera hints (optional)</label>
              <button
                type="button"
                className="text-xs text-muted hover:text-foreground"
                onClick={() => setUseCameraHints((prev) => !prev)}
              >
                {useCameraHints ? 'Hide' : 'Add'}
              </button>
            </div>
            {useCameraHints && (
              <div className="grid gap-2 sm:grid-cols-4">
                <input
                  type="number"
                  value={cameraYaw}
                  onChange={(event) => setCameraYaw(event.target.value)}
                  placeholder="Yaw"
                  className="rounded-md border border-border bg-surface-1 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={cameraPitch}
                  onChange={(event) => setCameraPitch(event.target.value)}
                  placeholder="Pitch"
                  className="rounded-md border border-border bg-surface-1 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={cameraRoll}
                  onChange={(event) => setCameraRoll(event.target.value)}
                  placeholder="Roll"
                  className="rounded-md border border-border bg-surface-1 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={cameraDolly}
                  onChange={(event) => setCameraDolly(event.target.value)}
                  placeholder="Dolly"
                  className="rounded-md border border-border bg-surface-1 px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
          <div className="text-xs text-muted">
            Standard mode allows text-to-video. You can optionally reuse the previous shot as a
            reference image.
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={usePreviousReference}
              onChange={(event) => setUsePreviousReference(event.target.checked)}
            />
            Use previous shot as reference (best effort)
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !prompt.trim() || !canSubmitContinuity}
        className={`w-full rounded-md px-4 py-2 text-sm font-medium ${
          isSubmitting || !prompt.trim() || !canSubmitContinuity
            ? 'bg-surface-3 text-muted cursor-not-allowed'
            : 'bg-accent text-white'
        }`}
      >
        {isSubmitting ? 'Adding...' : 'Add Shot'}
      </button>
    </div>
  );
}

export default ShotEditor;
