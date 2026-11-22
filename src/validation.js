const { CATEGORIES } = require('./constants');

// Checks the list of categories a driver wants to save.
// Returns an error message (string) if invalid, or null if valid.
function validateCategories(categories) {
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

module.exports = { validateCategories };