/**
 * Utility function for merging Tailwind CSS classes
 * Handles conditional classes and removes duplicates
 * 
 * @param {...(string|string[]|Object|undefined|null|boolean)} classes - Classes to merge
 * @returns {string} Merged class string
 * 
 * @example
 * cn('base-class', condition && 'conditional-class', ['array', 'classes'])
 */
export function cn(...classes) {
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
