const deliveries = {};
let nextId = 1;

function createDelivery(data) {
  const id = `DEL-${String(nextId++).padStart(4, '0')}`;
  const delivery = {
    id,
    ...data,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  deliveries[id] = delivery;
  return delivery;
}

function getDelivery(id) {
  return deliveries[id] || null;
}

function getAllDeliveries() {
  return Object.values(deliveries);
}

function updateDelivery(id, changes) {
  if (!deliveries[id]) return null;
  deliveries[id] = { ...deliveries[id], ...changes, updatedAt: new Date().toISOString() };
  return deliveries[id];
}

module.exports = { createDelivery, getDelivery, getAllDeliveries, updateDelivery };
