const { CATEGORIES } = require('./constants');

function validateCategories(categories) {
  if (!Array.isArray(categories)) {
    return 'categories must be an array';
  }
  for (const category of categories) {
    if (!CATEGORIES.includes(category)) {
      return `Invalid category: ${category}. Allowed: ${CATEGORIES.join(', ')}`;
    }
  }
  return null;
}

module.exports = { validateCategories };
