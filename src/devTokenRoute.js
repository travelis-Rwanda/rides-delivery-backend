import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';

const ROLES = ['driver', 'customer'];


export const devTokenDoc = {
  post: {
    tags: ['Development helper'],
    summary: 'Get a test JWT (development only)',
    description:
      'Signs a JWT with the server secret so the protected endpoints can be tried from Swagger. ' +
      'In real use, the token comes from the Rides login. This route exists only when ' +
      'ENABLE_DEV_TOKEN=true and is never available in production.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['role'],
            properties: {
              role: { type: 'string', enum: ROLES },
              userId: { type: 'string', description: 'Optional. Defaults to "<role>-1".' },
            },
          },
          example: { role: 'driver' },
        },
      },
    },
    responses: {
      200: {
        description: 'A signed token, valid for 1 hour. Copy it into the Authorize button.',
        content: {
          'application/json': {
            example: {
              token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              tokenType: 'Bearer',
              expiresIn: '1h',
              user: { id: 'driver-1', role: 'driver' },
            },
          },
        },
      },
      400: { description: 'Invalid role' },
    },
  },
};

const router = Router();

router.post('/auth/dev-token', (req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new AppError('CONFIG_ERROR', 'JWT_SECRET is not set', 500));

  const role = req.body && req.body.role;
  if (!ROLES.includes(role)) {
    return next(new AppError('VALIDATION_ERROR', `role must be one of: ${ROLES.join(', ')}`, 400));
  }

  const userId =
    typeof req.body.userId === 'string' && req.body.userId.trim() ? req.body.userId.trim() : `${role}-1`;

  // THIS is where a token is made: the payload is signed with the secret.
  const expiresIn = '1h';
  const token = jwt.sign({ id: userId, role }, secret, { expiresIn });

  res.json({ token, tokenType: 'Bearer', expiresIn, user: { id: userId, role } });
});

export default router;