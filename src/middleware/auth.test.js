const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createAuth } = require('./auth');
const { errorHandler, AppError } = require('../errors');

// A fake Rides, so the tests need no network and no database.
const fakeRides = {
  verifyToken: async (token) => {
    if (token === 'driver-token') return { id: 'driver-1', roles: ['driver'] };
    if (token === 'customer-token') return { id: 'customer-1', roles: ['customer'] };
    throw new AppError('UNAUTHORIZED', 'Invalid or expired Rides token', 401, {
      ridesError: { code: 'INVALID_TOKEN' },
    });
  },
};

function startServer() {
  const { authenticate, requireRole } = createAuth(fakeRides);
  const app = express();
  app.get('/driver-only', authenticate, requireRole('driver'), (req, res) => {
    res.json({ id: req.user.id });
  });
  app.use(errorHandler);
  const server = app.listen(0); // port 0 = pick any free port
  return { server, url: `http://localhost:${server.address().port}/driver-only` };
}

test('no token: 401 in the Req 18 error envelope', async () => {
  const { server, url } = startServer();
  const res = await fetch(url);
  const body = await res.json();
  server.close();
  assert.strictEqual(res.status, 401);
  assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  assert.ok(body.error.timestamp);
});

test('invalid token: 401 carrying the Rides error details', async () => {
  const { server, url } = startServer();
  const res = await fetch(url, { headers: { Authorization: 'Bearer wrong' } });
  const body = await res.json();
  server.close();
  assert.strictEqual(res.status, 401);
  assert.strictEqual(body.error.details.ridesError.code, 'INVALID_TOKEN');
});

test('a customer cannot use a driver-only route: 403', async () => {
  const { server, url } = startServer();
  const res = await fetch(url, { headers: { Authorization: 'Bearer customer-token' } });
  server.close();
  assert.strictEqual(res.status, 403);
});

test('a driver is allowed and gets the Rides user ID', async () => {
  const { server, url } = startServer();
  const res = await fetch(url, { headers: { Authorization: 'Bearer driver-token' } });
  const body = await res.json();
  server.close();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.id, 'driver-1');
});