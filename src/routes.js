const express = require('express');
const { validateCategories } = require('./validation');
const { getPreferences, setPreferences } = require('./preferencesStore');
const { authenticate, requireRole } = require('./middleware/auth');
const { AppError } = require('./errors');

const router = express.Router();

// Read the driver's saved categories. Driver role only (Req 1.5).
router.get(
  '/drivers/me/category-preferences',
  authenticate,
  requireRole('driver'),
  (req, res) => {
    const categories = getPreferences(req.user.id); // Rides user ID (Req 1.3)
    res.json({ driverId: req.user.id, categories, showingAll: categories.length === 0 });
  }
);

// Save the driver's categories. Driver role only (Req 1.5).
router.put(
  '/drivers/me/category-preferences',
  authenticate,
  requireRole('driver'),
  (req, res, next) => {
    const problem = validateCategories(req.body && req.body.categories);
    if (problem) {
      return next(new AppError('VALIDATION_ERROR', problem, 400));
    }
    const saved = setPreferences(req.user.id, req.body.categories);
    res.json({ driverId: req.user.id, categories: saved, showingAll: saved.length === 0 });
  }
);

module.exports = router;