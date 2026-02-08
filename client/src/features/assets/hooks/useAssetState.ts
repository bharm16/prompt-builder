import { useReducer, useCallback, useMemo } from 'react';
import type { Asset, AssetType, AssetListResponse } from '@shared/types/asset';

interface AssetState {
  assets: Asset[];
  byType: Record<AssetType, number>;
  selectedAsset: Asset | null;
  isLoading: boolean;
  error: string | null;
  editorOpen: boolean;
  editorMode: 'create' | 'edit';
  editorAssetType: AssetType | null;
  filterType: AssetType | null;
}

const initialState: AssetState = {
  assets: [],
  byType: { character: 0, style: 0, location: 0, object: 0 },
  selectedAsset: null,
  isLoading: false,
  error: null,
  editorOpen: false,
  editorMode: 'create',
  editorAssetType: null,
  filterType: null,
};

type AssetAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ASSETS'; payload: AssetListResponse }
  | { type: 'ADD_ASSET'; payload: Asset }
  | { type: 'UPDATE_ASSET'; payload: Asset }
  | { type: 'DELETE_ASSET'; payload: string }
  | { type: 'SELECT_ASSET'; payload: Asset | null }
  | { type: 'OPEN_EDITOR'; payload: { mode: 'create' | 'edit'; asset?: Asset | null; assetType?: AssetType | null } }
  | { type: 'CLOSE_EDITOR' }
  | { type: 'SET_FILTER'; payload: AssetType | null };

function assetReducer(state: AssetState, action: AssetAction): AssetState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'SET_ASSETS':
      return {
        ...state,
        assets: action.payload.assets,
        byType: action.payload.byType || state.byType,
        isLoading: false,
      };
    case 'ADD_ASSET': {
      const newByType = { ...state.byType };
      newByType[action.payload.type] = (newByType[action.payload.type] || 0) + 1;
      return {
        ...state,
        assets: [action.payload, ...state.assets],
        byType: newByType,
        editorOpen: false,
      };
    }
    case 'UPDATE_ASSET':
      return {
        ...state,
        assets: state.assets.map((asset) =>
          asset.id === action.payload.id ? action.payload : asset
        ),
        selectedAsset:
          state.selectedAsset?.id === action.payload.id
            ? action.payload
            : state.selectedAsset,
      };
    case 'DELETE_ASSET': {
      const deletedAsset = state.assets.find((asset) => asset.id === action.payload);
      const updatedByType = { ...state.byType };
      if (deletedAsset) {
        updatedByType[deletedAsset.type] = Math.max(
          0,
          (updatedByType[deletedAsset.type] || 0) - 1
        );
      }
      return {
        ...state,
        assets: state.assets.filter((asset) => asset.id !== action.payload),
        byType: updatedByType,
        selectedAsset:
          state.selectedAsset?.id === action.payload ? null : state.selectedAsset,
      };
    }
    case 'SELECT_ASSET':
      return { ...state, selectedAsset: action.payload };
    case 'OPEN_EDITOR':
      return {
        ...state,
        editorOpen: true,
        editorMode: action.payload.mode,
        editorAssetType: action.payload.assetType || null,
        selectedAsset: action.payload.asset || null,
      };
    case 'CLOSE_EDITOR':
      return { ...state, editorOpen: false, editorAssetType: null };
    case 'SET_FILTER':
      return { ...state, filterType: action.payload };
    default:
      return state;
  }
}

export function useAssetState() {
  const [state, dispatch] = useReducer(assetReducer, initialState);

  const setLoading = useCallback(
    (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    []
  );
  const setError = useCallback(
    (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    []
  );
  const setAssets = useCallback(
    (data: AssetListResponse) => dispatch({ type: 'SET_ASSETS', payload: data }),
    []
  );
  const addAsset = useCallback(
    (asset: Asset) => dispatch({ type: 'ADD_ASSET', payload: asset }),
    []
  );
  const updateAsset = useCallback(
    (asset: Asset) => dispatch({ type: 'UPDATE_ASSET', payload: asset }),
    []
  );
  const deleteAsset = useCallback(
    (assetId: string) => dispatch({ type: 'DELETE_ASSET', payload: assetId }),
    []
  );
  const selectAsset = useCallback(
    (asset: Asset | null) => dispatch({ type: 'SELECT_ASSET', payload: asset }),
    []
  );
  const openEditor = useCallback(
    (mode: 'create' | 'edit', asset: Asset | null = null, assetType: AssetType | null = null) =>
      dispatch({ type: 'OPEN_EDITOR', payload: { mode, asset, assetType } }),
    []
  );
  const closeEditor = useCallback(() => dispatch({ type: 'CLOSE_EDITOR' }), []);
  const setFilter = useCallback(
    (type: AssetType | null) => dispatch({ type: 'SET_FILTER', payload: type }),
    []
  );

  const actions = useMemo(
    () => ({
      setLoading,
      setError,
      setAssets,
      addAsset,
      updateAsset,
      deleteAsset,
      selectAsset,
      openEditor,
      closeEditor,
      setFilter,
    }),
    [
      setLoading,
      setError,
      setAssets,
      addAsset,
      updateAsset,
      deleteAsset,
      selectAsset,
      openEditor,
      closeEditor,
      setFilter,
    ]
  );

  const filteredAssets = state.filterType
    ? state.assets.filter((asset) => asset.type === state.filterType)
    : state.assets;

  return { state, actions, filteredAssets };
}

export default useAssetState;
