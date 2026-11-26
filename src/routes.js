import { Router } from 'express';
import { validateCategories } from './validation.js';
import { getPreferences, setPreferences } from './preferencesStore.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { AppError } from './errors.js';

const router = Router();

// Read the driver's saved categories. Drivers only.
router.get('/drivers/me/category-preferences', authenticate, requireRole('driver'), (req, res) => {
  const categories = getPreferences(req.user.id);
  res.json({ driverId: req.user.id, categories, showingAll: categories.length === 0 });
});

// Save the driver's categories. Drivers only.
router.put('/drivers/me/category-preferences', authenticate, requireRole('driver'), (req, res, next) => {
  const problem = validateCategories(req.body && req.body.categories);
  if (problem) {
    return next(new AppError('VALIDATION_ERROR', problem, 400));
  }
  const saved = setPreferences(req.user.id, req.body.categories);
  res.json({ driverId: req.user.id, categories: saved, showingAll: saved.length === 0 });
});

export default router;