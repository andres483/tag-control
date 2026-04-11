import { useState, useCallback } from 'react';
import { getTarifa } from '../lib/pricing';
import { saveTrip } from '../lib/storage';

export function useTrip() {
  const [isActive, setIsActive] = useState(false);
  const [crossings, setCrossings] = useState([]);
  const [startTime, setStartTime] = useState(null);

  const startTrip = useCallback(() => {
    setIsActive(true);
    setCrossings([]);
    setStartTime(Date.now());
  }, []);

  const endTrip = useCallback(() => {
    setCrossings((prev) => {
      if (prev.length > 0) {
        const totalCost = prev.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
        const routes = [...new Set(prev.map((c) => c.toll.ruta))];
        saveTrip({
          id: Date.now().toString(),
          startTime: prev[0].timestamp,
          endTime: prev[prev.length - 1].timestamp,
          crossings: prev.map((c) => ({
            tollId: c.toll.id,
            tollNombre: c.toll.nombre,
            tollRuta: c.toll.ruta,
            tarifa: getTarifa(c.toll, new Date(c.timestamp)),
            timestamp: c.timestamp,
          })),
          totalCost,
          tollCount: prev.length,
          routes,
        });
      }
      return prev;
    });
    setIsActive(false);
    setStartTime(null);
  }, []);

  const addCrossing = useCallback((crossing) => {
    setCrossings((prev) => [...prev, crossing]);
  }, []);

  const totalCost = crossings.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
  const tollCount = crossings.length;

  return {
    isActive,
    crossings,
    startTime,
    totalCost,
    tollCount,
    startTrip,
    endTrip,
    addCrossing,
  };
}
