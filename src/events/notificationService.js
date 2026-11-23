// RID-19: Deliver event notifications to customers, drivers, and source modules.

const { eventBus, EVENTS } = require('./eventBus');

// In-memory log — keyed by recipientId
const notificationLog = {};

function record(recipientId, notification) {
  if (!notificationLog[recipientId]) notificationLog[recipientId] = [];
  const entry = { ...notification, deliveredAt: new Date().toISOString() };
  notificationLog[recipientId].push(entry);
  console.log(`[NOTIFY] → ${recipientId}: ${notification.message}`);
}

function sendToCustomer(customerId, event, payload) {
  record(customerId, {
    type: 'customer',
    event,
    message: customerMessage(event, payload),
    payload,
  });
}

function sendToDriver(driverId, event, payload) {
  record(driverId, {
    type: 'driver',
    event,
    message: driverMessage(event, payload),
    payload,
  });
}

function sendToSourceModule(source, event, payload) {
  record(`source:${source}`, {
    type: 'source-module',
    event,
    message: `[${source.toUpperCase()}] ${event}`,
    payload,
  });
}

function customerMessage(event, payload) {
  switch (event) {
    case EVENTS.DELIVERY_CREATED:   return `Your delivery #${payload.deliveryId} has been placed.`;
    case EVENTS.DRIVER_ASSIGNED:    return `A driver has been assigned to your delivery #${payload.deliveryId}.`;
    case EVENTS.DELIVERY_COMPLETED: return `Your delivery #${payload.deliveryId} is complete.`;
    case EVENTS.DELIVERY_CANCELLED: return `Your delivery #${payload.deliveryId} was cancelled.`;
    default: return `Update on delivery #${payload.deliveryId}: ${event}`;
  }
}

function driverMessage(event, payload) {
  switch (event) {
    case EVENTS.DRIVER_ASSIGNED:    return `You have been assigned delivery #${payload.deliveryId} (${payload.category}).`;
    case EVENTS.DRIVER_UNASSIGNED:  return `You have been unassigned from delivery #${payload.deliveryId}.`;
    case EVENTS.DELIVERY_CANCELLED: return `Delivery #${payload.deliveryId} was cancelled.`;
    default: return `Delivery update #${payload.deliveryId}: ${event}`;
  }
}

function getNotifications(recipientId) {
  return notificationLog[recipientId] || [];
}

// --- Wire up event listeners ---

eventBus.on(EVENTS.DELIVERY_CREATED, (payload) => {
  sendToCustomer(payload.customerId, EVENTS.DELIVERY_CREATED, payload);
  sendToSourceModule(payload.source, EVENTS.DELIVERY_CREATED, payload);
});

eventBus.on(EVENTS.DRIVER_ASSIGNED, (payload) => {
  sendToCustomer(payload.customerId, EVENTS.DRIVER_ASSIGNED, payload);
  sendToDriver(payload.driverId, EVENTS.DRIVER_ASSIGNED, payload);
});

eventBus.on(EVENTS.DRIVER_UNASSIGNED, (payload) => {
  sendToDriver(payload.driverId, EVENTS.DRIVER_UNASSIGNED, payload);
});

eventBus.on(EVENTS.DELIVERY_COMPLETED, (payload) => {
  sendToCustomer(payload.customerId, EVENTS.DELIVERY_COMPLETED, payload);
  sendToDriver(payload.driverId, EVENTS.DELIVERY_COMPLETED, payload);
  sendToSourceModule(payload.source, EVENTS.DELIVERY_COMPLETED, payload);
});

eventBus.on(EVENTS.DELIVERY_CANCELLED, (payload) => {
  sendToCustomer(payload.customerId, EVENTS.DELIVERY_CANCELLED, payload);
  if (payload.driverId) sendToDriver(payload.driverId, EVENTS.DELIVERY_CANCELLED, payload);
  sendToSourceModule(payload.source, EVENTS.DELIVERY_CANCELLED, payload);
});

eventBus.on(EVENTS.RESTAURANT_ORDER_RECEIVED, (payload) => {
  sendToSourceModule('restaurant', EVENTS.RESTAURANT_ORDER_RECEIVED, payload);
});

eventBus.on(EVENTS.SHOP_ORDER_RECEIVED, (payload) => {
  sendToSourceModule('shop', EVENTS.SHOP_ORDER_RECEIVED, payload);
});

module.exports = { sendToCustomer, sendToDriver, sendToSourceModule, getNotifications };
