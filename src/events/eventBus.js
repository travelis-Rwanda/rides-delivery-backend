const { EventEmitter } = require('events');

const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

const EVENTS = {
  DELIVERY_CREATED:          'delivery.created',
  DELIVERY_UPDATED:          'delivery.updated',
  DELIVERY_CANCELLED:        'delivery.cancelled',
  DELIVERY_COMPLETED:        'delivery.completed',
  DRIVER_ASSIGNED:           'driver.assigned',
  DRIVER_UNASSIGNED:         'driver.unassigned',
  RESTAURANT_ORDER_RECEIVED: 'source.restaurant.order_received',
  SHOP_ORDER_RECEIVED:       'source.shop.order_received',
};

module.exports = { eventBus, EVENTS };
