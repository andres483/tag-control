import { useState, useCallback, useRef, useEffect } from 'react';
import { getTarifa } from '../lib/pricing';
import { saveTrip } from '../lib/storage';

export function useTrip() {
  const [isActive, setIsActive] = useState(false);
  const [crossings, setCrossings] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const crossingsRef = useRef([]);

  // Mantener ref sincronizado
  useEffect(() => {
    crossingsRef.current = crossings;
  }, [crossings]);

  const startTrip = useCallback(() => {
    setIsActive(true);
    setCrossings([]);
    setStartTime(Date.now());
  }, []);

  const endTrip = useCallback(() => {
    const prev = crossingsRef.current;
    if (prev.length > 0) {
      const totalCost = prev.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
      const routes = [...new Set(prev.map((c) => c.toll.ruta))];
      saveTrip({
        id: Date.now().toString(),
        startTime: startTime || prev[0].timestamp,
        endTime: Date.now(),
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
    setIsActive(false);
    setCrossings([]);
    setStartTime(null);
  }, [startTime]);

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
