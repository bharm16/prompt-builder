/**
 * History Repository API
 */

export {
  normalizeEntries,
  loadFromFirestore,
  loadFromLocalStorage,
  syncToLocalStorage,
  saveEntry,
  updateHighlights,
  updateOutput,
  deleteEntry,
  clearAll,
} from './historyRepository';
