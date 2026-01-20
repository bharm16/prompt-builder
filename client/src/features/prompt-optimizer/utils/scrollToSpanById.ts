export function scrollToSpanById(spanId: string): void {
  if (!spanId || typeof document === 'undefined') return;

  const safeId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(spanId)
      : spanId.replace(/["\\]/g, '\\$&');

  const target = document.querySelector(
    `[data-span-id="${safeId}"]`
  ) as HTMLElement | null;

  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  target.classList.add('ps-animate-span-pulse');
  window.setTimeout(() => {
    target.classList.remove('ps-animate-span-pulse');
  }, 700);
}
