// Temporary in-memory storage. Key: driver ID. Value: list of categories.
const preferences = {};

function getPreferences(driverId) {
  return preferences[driverId] || [];
}

function setPreferences(driverId, categories) {
  // new Set(...) removes duplicates, e.g. ['Parcel','Parcel'] -> ['Parcel']
  preferences[driverId] = [...new Set(categories)];
  return preferences[driverId];
}

module.exports = { getPreferences, setPreferences };