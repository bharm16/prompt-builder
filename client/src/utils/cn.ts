/**
 * Utility function for merging Tailwind CSS classes.
 * Handles conditional classes and removes duplicates.
 *
 * @example
 * cn('base-class', condition && 'conditional-class', ['array', 'classes'])
 */
export type ClassValue = string | string[] | Record<string, boolean> | undefined | null | boolean;

export function cn(...classes: Array<ClassValue>): string {
  return classes
    .flat(Infinity)
    .filter((cls) => {
      // Filter out falsy values (undefined, null, false, '', 0)
      return Boolean(cls) && cls !== true;
    })
    .join(' ')
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

export default cn;
