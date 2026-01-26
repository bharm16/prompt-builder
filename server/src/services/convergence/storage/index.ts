/**
 * Storage module for Visual Convergence
 *
 * Provides GCS storage operations for convergence images.
 *
 * @module convergence/storage
 */

export type { StorageService } from './StorageService';
export {
  GCSStorageService,
  getGCSStorageService,
  createGCSStorageService,
} from './StorageService';
