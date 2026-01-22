import type { AssetListResponse, AssetType } from '@shared/types/asset';
import { assetApi } from '@/features/assets/api/assetApi';

export const assetsSidebarApi = {
  async list(type: AssetType | null = null): Promise<AssetListResponse> {
    return await assetApi.list(type);
  },
};

export default assetsSidebarApi;
