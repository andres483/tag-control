import tollsData from '../data/tolls.json';

// Static data — computed once at module level, no need for useMemo
const tolls = tollsData.tolls;
const tollsByRoute = {};
for (const toll of tolls) {
  if (!tollsByRoute[toll.ruta]) tollsByRoute[toll.ruta] = [];
  tollsByRoute[toll.ruta].push(toll);
}
const routes = Object.keys(tollsByRoute);

export function useTolls() {
  const getTollById = (id) => tolls.find((t) => t.id === id);
  return { tolls, tollsByRoute, routes, getTollById };
}
