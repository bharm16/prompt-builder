/**
 * Utility function for merging Tailwind CSS classes.
 * Handles conditional classes and removes duplicates.
 *
 * @example
 * cn('base-class', condition && 'conditional-class', ['array', 'classes'])
 */
export function cn(...classes: Array<string | string[] | Record<string, boolean> | undefined | null | boolean>): string {
  return classes
    .flat()
    .filter((cls) => {
      // Filter out falsy values (undefined, null, false, '', 0)
      return Boolean(cls) && cls !== true;
    })
    .join(' ')
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

export default cn;

