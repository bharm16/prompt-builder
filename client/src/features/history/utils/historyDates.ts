export function formatShortDate(iso: string | undefined): string {
  if (!iso) return 'No date';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'No date';
  const now = new Date();
  const sameYear = t.getFullYear() === now.getFullYear();
  return t.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatRelativeOrDate(iso: string | undefined): string {
  if (!iso) return 'No date';
  const t = new Date(iso);
  const ms = t.getTime();
  if (Number.isNaN(ms)) return 'No date';
  const diffMs = Date.now() - ms;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 0) return formatShortDate(iso);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(iso);
}
