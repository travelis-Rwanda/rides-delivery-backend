import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from './auth.js';
import { errorHandler } from '../errors.js';

process.env.JWT_SECRET = 'test-secret';
const sign = (payload, options) => jwt.sign(payload, 'test-secret', options);

function startServer() {
  const app = express();
  app.get('/driver-only', authenticate, requireRole('driver'), (req, res) => {
    res.json({ id: req.user.id });
  });
  app.use(errorHandler);
  const server = app.listen(0);
  return { server, url: `http://localhost:${server.address().port}/driver-only` };
}

async function get(headers) {
  const { server, url } = startServer();
  const res = await fetch(url, { headers });
  const body = await res.json();
  server.close();
  return { status: res.status, body };
}

test('no token: 401 in the error envelope', async () => {
  const res = await get({});
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  assert.ok(res.body.error.timestamp);
});

test('invalid token: 401 with the reason in details', async () => {
  const res = await get({ Authorization: 'Bearer not-a-real-token' });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.details.reason, 'JsonWebTokenError');
});

test('expired token: 401', async () => {
  const token = sign({ id: 'driver-1', role: 'driver' }, { expiresIn: -10 });
  const res = await get({ Authorization: `Bearer ${token}` });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.details.reason, 'TokenExpiredError');
});

test('a customer cannot use a driver-only route: 403', async () => {
  const token = sign({ id: 'customer-1', role: 'customer' });
  const res = await get({ Authorization: `Bearer ${token}` });
  assert.strictEqual(res.status, 403);
});

test('a driver is allowed and the user ID comes from the token', async () => {
  const token = sign({ id: 'driver-1', role: 'driver' });
  const res = await get({ Authorization: `Bearer ${token}` });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.id, 'driver-1');
});