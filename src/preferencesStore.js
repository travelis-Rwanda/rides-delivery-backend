const preferences = {};

function getPreferences(driverId) {
  return preferences[driverId] || [];
}

function setPreferences(driverId, categories) {
  preferences[driverId] = [...new Set(categories)];
  return preferences[driverId];
}

module.exports = { getPreferences, setPreferences };
