import { CATEGORIES } from './constants.js';

// Checks the list of categories a driver wants to save.

export function validateCategories(categories) {
  if (!Array.isArray(categories)) {
    return 'categories must be an array';
  }

  for (const category of categories) {
    if (!CATEGORIES.includes(category)) {
      return `Invalid category: ${category}. Allowed: ${CATEGORIES.join(', ')}`;
    }
  }

  return null; // null means "no problem found"
}