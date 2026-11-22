const express = require('express');
const { validateCategories } = require('./validation');
const { getPreferences, setPreferences } = require('./preferencesStore');

const router = express.Router();

// TEMPORARY: the real backend will get the driver ID from the Rides auth token.
// For practice, we read it from a header called "x-driver-id".
function fakeAuth(req, res, next) {
  const driverId = req.header('x-driver-id');
  if (!driverId) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing x-driver-id header', timestamp: new Date().toISOString() },
    });
  }
  req.driverId = driverId;
  next();
}

router.get('/drivers/me/category-preferences', fakeAuth, (req, res) => {
  const categories = getPreferences(req.driverId);
  res.json({ driverId: req.driverId, categories, showingAll: categories.length === 0 });
});

router.put('/drivers/me/category-preferences', fakeAuth, (req, res) => {
  const { categories } = req.body;
  const problem = validateCategories(categories);

  if (problem) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: problem, timestamp: new Date().toISOString() },
    });
  }

  const saved = setPreferences(req.driverId, categories);
  res.json({ driverId: req.driverId, categories: saved, showingAll: saved.length === 0 });
});

module.exports = router;