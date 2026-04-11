const TRIPS_KEY = 'tagcontrol_trips';

export function getSavedTrips() {
  try {
    return JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveTrip(trip) {
  const trips = getSavedTrips();
  trips.unshift(trip); // más reciente primero
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export function clearTrips() {
  localStorage.removeItem(TRIPS_KEY);
}
