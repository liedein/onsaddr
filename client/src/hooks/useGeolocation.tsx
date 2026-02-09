import { useState, useEffect } from 'react';
import type { LocationData } from "@/types/map";

export function useGeolocation() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentLocation({ lat, lng });
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('위치 정보 오류:', error);
        setLocationError(error.message);
        // Set default location (Seoul City Hall)
        setCurrentLocation({ lat: 37.5665, lng: 126.9780 });
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, []);

  return {
    currentLocation,
    isLoadingLocation,
    locationError,
  };
}
