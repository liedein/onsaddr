import { useEffect, useRef, memo, forwardRef, useImperativeHandle } from "react";
import { LocationData } from "@/pages/home";

interface KakaoMapProps {
  initialLocation?: LocationData | null;
  selectedLocation?: LocationData | null;
  onLocationSelect?: (location: LocationData) => void;
  isLoading?: boolean;
}

declare global {
  interface Window {
    kakao: any;
  }
}

const KakaoMap = memo(forwardRef(function KakaoMap({
  initialLocation,
  selectedLocation,
  onLocationSelect,
}: KakaoMapProps, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);

  // 요구사항 12: 부모에서 호출 가능한 Pin 중심 확인 함수 노출
  useImperativeHandle(ref, () => ({
    isMarkerAtCenter: () => {
      if (!mapInstance.current || !markerInstance.current) return false;
      const center = mapInstance.current.getCenter();
      const markerPos = markerInstance.current.getPosition();
      
      // 위경도 소수점 6자리 정도 오차 범위 내에서 일치하는지 확인
      const diffLat = Math.abs(center.getLat() - markerPos.getLat());
      const diffLng = Math.abs(center.getLng() - markerPos.getLng());
      return diffLat < 0.00001 && diffLng < 0.00001;
    }
  }));

  useEffect(() => {
    if (!window.kakao || !mapRef.current) return;

    window.kakao.maps.load(() => {
      const defaultLat = initialLocation?.lat ?? 37.5665;
      const defaultLng = initialLocation?.lng ?? 126.978;

      const mapOption = {
        center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        level: 2,
      };

      mapInstance.current = new window.kakao.maps.Map(mapRef.current, mapOption);

      markerInstance.current = new window.kakao.maps.Marker({
        position: mapInstance.current.getCenter(),
      });
      markerInstance.current.setMap(mapInstance.current);

      window.kakao.maps.event.addListener(mapInstance.current, "click", (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        if (onLocationSelect) {
          onLocationSelect({ lat: latlng.getLat(), lng: latlng.getLng() });
        }
      });
    });
    
    return () => {
      if (mapInstance.current) {
        window.kakao.maps.event.removeListener(mapInstance.current, "click");
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markerInstance.current || !selectedLocation) return;
    const moveLatLon = new window.kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
    markerInstance.current.setPosition(moveLatLon);
    mapInstance.current.setCenter(moveLatLon);
  }, [selectedLocation?.lat, selectedLocation?.lng]);

  return <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />;
}));

export default KakaoMap;