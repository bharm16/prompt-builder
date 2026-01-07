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
  updateVersions,
  deleteEntry,
  clearAll,
} from './historyRepository';
