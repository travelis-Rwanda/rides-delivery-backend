// Central router — pure Node http, no framework.
const { send, sendError, parseBody, matchPath } = require('./http/helpers');
const { CATEGORIES } = require('./constants');
const { validateCategories } = require('./validation');
const { getPreferences, setPreferences } = require('./preferencesStore');
const { getNotifications } = require('./events/notificationService');
const { createDelivery, getAllDeliveries } = require('./deliveries/deliveryStore');
const { eventBus, EVENTS } = require('./events/eventBus');

// TEMPORARY: reads driver identity from x-driver-id header.
function fakeAuth(req, res) {
  const driverId = req.headers['x-driver-id'];
  if (!driverId) {
    sendError(res, 401, 'UNAUTHORIZED', 'Missing x-driver-id header');
    return null;
  }
  return driverId;
}

function validateRestaurantOrder(body) {
  for (const field of ['orderId', 'customerId', 'restaurantId', 'items', 'pickupAddress', 'deliveryAddress']) {
    if (!body[field]) return `Missing required field: ${field}`;
  }
  if (!Array.isArray(body.items) || body.items.length === 0) return 'items must be a non-empty array';
  return null;
}

function validateShopOrder(body) {
  for (const field of ['orderId', 'customerId', 'shopId', 'items', 'pickupAddress', 'deliveryAddress']) {
    if (!body[field]) return `Missing required field: ${field}`;
  }
  if (!Array.isArray(body.items) || body.items.length === 0) return 'items must be a non-empty array';
  return null;
}

async function router(req, res) {
  const method = req.method;
  const url = req.url;
  const path = url.split('?')[0];

  // ── GET /health ──────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/health') {
    return send(res, 200, { status: 'ok', categories: CATEGORIES });
  }

  // ── GET /drivers/me/category-preferences ─────────────────────────────────
  if (method === 'GET' && path === '/drivers/me/category-preferences') {
    const driverId = fakeAuth(req, res);
    if (!driverId) return;
    const categories = getPreferences(driverId);
    return send(res, 200, { driverId, categories, showingAll: categories.length === 0 });
  }

  // ── PUT /drivers/me/category-preferences ─────────────────────────────────
  if (method === 'PUT' && path === '/drivers/me/category-preferences') {
    const driverId = fakeAuth(req, res);
    if (!driverId) return;
    let body;
    try { body = await parseBody(req); }
    catch { return sendError(res, 400, 'BAD_REQUEST', 'Invalid JSON body'); }
    const problem = validateCategories(body.categories);
    if (problem) return sendError(res, 400, 'VALIDATION_ERROR', problem);
    const saved = setPreferences(driverId, body.categories);
    return send(res, 200, { driverId, categories: saved, showingAll: saved.length === 0 });
  }

  // ── GET /notifications/:recipientId ──────────────────────────────────────
  const notifMatch = matchPath('/notifications/:recipientId', path);
  if (method === 'GET' && notifMatch) {
    const { recipientId } = notifMatch;
    const notifications = getNotifications(recipientId);
    return send(res, 200, { recipientId, count: notifications.length, notifications });
  }

  // ── POST /sync/restaurant (RID-15) ───────────────────────────────────────
  if (method === 'POST' && path === '/sync/restaurant') {
    let body;
    try { body = await parseBody(req); }
    catch { return sendError(res, 400, 'BAD_REQUEST', 'Invalid JSON body'); }
    const problem = validateRestaurantOrder(body);
    if (problem) return sendError(res, 400, 'VALIDATION_ERROR', problem);

    const delivery = createDelivery({
      source: 'restaurant',
      sourceOrderId: body.orderId,
      customerId: body.customerId,
      sourceId: body.restaurantId,
      category: 'Restaurant',
      items: body.items,
      pickupAddress: body.pickupAddress,
      deliveryAddress: body.deliveryAddress,
      notes: body.notes || '',
    });

    eventBus.emit(EVENTS.RESTAURANT_ORDER_RECEIVED, { deliveryId: delivery.id, orderId: body.orderId, restaurantId: body.restaurantId });
    eventBus.emit(EVENTS.DELIVERY_CREATED, { deliveryId: delivery.id, customerId: body.customerId, source: 'restaurant', category: 'Restaurant' });

    return send(res, 201, { delivery });
  }

  // ── GET /sync/restaurant/:orderId (RID-15) ───────────────────────────────
  const restMatch = matchPath('/sync/restaurant/:orderId', path);
  if (method === 'GET' && restMatch) {
    const match = getAllDeliveries().find(d => d.source === 'restaurant' && d.sourceOrderId === restMatch.orderId);
    if (!match) return sendError(res, 404, 'NOT_FOUND', `No delivery for restaurant order ${restMatch.orderId}`);
    return send(res, 200, { delivery: match });
  }

  // ── POST /sync/shop (RID-12) ─────────────────────────────────────────────
  if (method === 'POST' && path === '/sync/shop') {
    let body;
    try { body = await parseBody(req); }
    catch { return sendError(res, 400, 'BAD_REQUEST', 'Invalid JSON body'); }
    const problem = validateShopOrder(body);
    if (problem) return sendError(res, 400, 'VALIDATION_ERROR', problem);

    const delivery = createDelivery({
      source: 'shop',
      sourceOrderId: body.orderId,
      customerId: body.customerId,
      sourceId: body.shopId,
      category: 'Shop',
      items: body.items,
      pickupAddress: body.pickupAddress,
      deliveryAddress: body.deliveryAddress,
      notes: body.notes || '',
    });

    eventBus.emit(EVENTS.SHOP_ORDER_RECEIVED, { deliveryId: delivery.id, orderId: body.orderId, shopId: body.shopId });
    eventBus.emit(EVENTS.DELIVERY_CREATED, { deliveryId: delivery.id, customerId: body.customerId, source: 'shop', category: 'Shop' });

    return send(res, 201, { delivery });
  }

  // ── GET /sync/shop/:orderId (RID-12) ─────────────────────────────────────
  const shopMatch = matchPath('/sync/shop/:orderId', path);
  if (method === 'GET' && shopMatch) {
    const match = getAllDeliveries().find(d => d.source === 'shop' && d.sourceOrderId === shopMatch.orderId);
    if (!match) return sendError(res, 404, 'NOT_FOUND', `No delivery for shop order ${shopMatch.orderId}`);
    return send(res, 200, { delivery: match });
  }

  // ── 404 fallback ─────────────────────────────────────────────────────────
  sendError(res, 404, 'NOT_FOUND', `${method} ${path} is not a valid endpoint`);
}

module.exports = router;
