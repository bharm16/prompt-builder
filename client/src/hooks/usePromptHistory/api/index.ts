/**
 * History Repository API
 */

export {
  normalizeEntries,
  loadFromFirestore,
  loadFromLocalStorage,
  syncToLocalStorage,
  saveEntry,
  updatePrompt,
  updateHighlights,
  updateOutput,
  updateVersions,
  deleteEntry,
  clearAll,
} from './historyRepository';
