import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

// Default map center (Almaty) — NOT a real user position
export const DEFAULT_MAP_CENTER: GeoPosition = { lat: 43.238949, lng: 76.945465 };

export function useGeolocation(options?: { enableHighAccuracy?: boolean; distanceFilter?: number }) {
  // null means "no real position yet"
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const watchIdRef = useRef<number | null>(null);
  const lastPos = useRef<GeoPosition | null>(null);

  const distanceFilter = options?.distanceFilter ?? 5;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;

  const haversineDistance = (a: GeoPosition, b: GeoPosition) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      if (mountedRef.current) {
        setError('Geolocation not supported');
        setLoading(false);
      }
      return;
    }

    clearWatch();

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (!mountedRef.current) return;
          const newPos: GeoPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          if (!lastPos.current || haversineDistance(lastPos.current, newPos) >= distanceFilter) {
            lastPos.current = newPos;
            setPosition(newPos);
          }
          setError(null);
          setPermissionDenied(false);
          setLoading(false);
        },
        (err) => {
          if (!mountedRef.current) return;
          if (err.code === err.PERMISSION_DENIED) {
            setPermissionDenied(true);
          }
          setError(err.message);
          setLoading(false);
          // position stays null — no fake coordinates
        },
        { enableHighAccuracy, maximumAge: 5000, timeout: 10000 }
      );
    } catch (e) {
      if (mountedRef.current) {
        console.warn('Geolocation watch failed:', e);
        setError('Failed to start geolocation');
        setLoading(false);
      }
    }
  }, [distanceFilter, enableHighAccuracy, clearWatch]);

  useEffect(() => {
    mountedRef.current = true;
    startWatching();
    return () => {
      mountedRef.current = false;
      clearWatch();
    };
  }, [startWatching, clearWatch]);

  const requestPermission = useCallback(() => {
    if (!mountedRef.current) return;
    setPermissionDenied(false);
    setError(null);
    setLoading(true);
    startWatching();
  }, [startWatching]);

  const dismissPermission = useCallback(() => {
    if (!mountedRef.current) return;
    setPermissionDenied(false);
  }, []);

  // mapCenter: real position if available, otherwise default
  const mapCenter = position ?? DEFAULT_MAP_CENTER;
  // hasRealPosition: true only when we have actual device coordinates
  const hasRealPosition = position !== null;

  return {
    position,        // null if no real position
    mapCenter,       // always valid coords for map display
    hasRealPosition, // boolean flag
    loading,
    error,
    permissionDenied,
    requestPermission,
    dismissPermission,
  };
}
