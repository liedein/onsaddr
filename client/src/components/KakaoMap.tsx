import { useEffect, useRef, useCallback } from "react";
import { LocationData } from "@/pages/home";

interface KakaoMapProps {
  initialLocation?: LocationData | null;
  selectedLocation?: LocationData | null;
  onLocationSelect?: (location: LocationData) => void;
}

declare global {
  interface Window {
    kakao: any;
  }
}

export default function KakaoMap({
  initialLocation,
  selectedLocation,
  onLocationSelect,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);

  const addMarker = useCallback((lat: number, lng: number) => {
    if (!mapInstance.current || !window.kakao?.maps) return;

    if (markerInstance.current) {
      markerInstance.current.setMap(null);
    }

    const markerPosition = new window.kakao.maps.LatLng(lat, lng);
    markerInstance.current = new window.kakao.maps.Marker({
      position: markerPosition,
    });

    markerInstance.current.setMap(mapInstance.current);
  }, []);

  useEffect(() => {
    if (!window.kakao || !mapRef.current) return;

    // SDK 내부 모듈이 로드될 때까지 기다림
    window.kakao.maps.load(() => {
      const defaultLat = initialLocation?.lat ?? 37.5665;
      const defaultLng = initialLocation?.lng ?? 126.978;

      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        level: 3,
      });

      // 클릭 이벤트
      window.kakao.maps.event.addListener(mapInstance.current, "click", (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        onLocationSelect?.({ lat: latlng.getLat(), lng: latlng.getLng() });
      });

      // 초기 마커
      if (selectedLocation) {
        addMarker(selectedLocation.lat, selectedLocation.lng);
      }
    });
  }, []);

  useEffect(() => {
    if (!window.kakao?.maps || !mapInstance.current || !selectedLocation) return;
    addMarker(selectedLocation.lat, selectedLocation.lng);
    mapInstance.current.setCenter(
      new window.kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng)
    );
  }, [selectedLocation, addMarker]);

  return <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />;
}
