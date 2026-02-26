import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

// Fallback: Almaty
const FALLBACK: GeoPosition = { lat: 43.238949, lng: 76.945465 };

export function useGeolocation(options?: { enableHighAccuracy?: boolean; distanceFilter?: number }) {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPos = useRef<GeoPosition | null>(null);
  const distanceFilter = options?.distanceFilter ?? 5;

  const haversineDistance = (a: GeoPosition, b: GeoPosition) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setPosition(FALLBACK);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: GeoPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!lastPos.current || haversineDistance(lastPos.current, newPos) >= distanceFilter) {
          lastPos.current = newPos;
          setPosition(newPos);
        }
        setError(null);
        setPermissionDenied(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
        }
        setError(err.message);
        if (!position) setPosition(FALLBACK);
      },
      { enableHighAccuracy: options?.enableHighAccuracy ?? true, maximumAge: 5000, timeout: 10000 }
    );
  }, [distanceFilter, options?.enableHighAccuracy]);

  useEffect(() => {
    startWatching();
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [startWatching]);

  const requestPermission = useCallback(() => {
    setPermissionDenied(false);
    setError(null);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    startWatching();
  }, [startWatching]);

  return { position: position ?? FALLBACK, error, permissionDenied, requestPermission };
}
