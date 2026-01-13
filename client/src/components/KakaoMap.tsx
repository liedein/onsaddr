import { useEffect, useRef, memo } from "react";
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

// 1. React.memo로 감싸서 부모 컴포넌트가 변해도 Props가 안 바뀌면 재렌더링되지 않게 차단
const KakaoMap = memo(function KakaoMap({
  initialLocation,
  selectedLocation,
  onLocationSelect,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null); // 마커 객체를 하나만 유지

  // [초기화] 지도 최초 생성 및 이벤트 등록
  useEffect(() => {
    if (!window.kakao || !mapRef.current) return;

    window.kakao.maps.load(() => {
      const defaultLat = initialLocation?.lat ?? 37.5665;
      const defaultLng = initialLocation?.lng ?? 126.978;

      const mapOption = {
        center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        level: 2,
      };

      // 지도 객체 생성
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, mapOption);

      // 마커 객체 최초 1회 미리 생성 (보이지 않는 상태)
      markerInstance.current = new window.kakao.maps.Marker({
        position: mapInstance.current.getCenter(),
      });
      markerInstance.current.setMap(mapInstance.current);

      // 지도 클릭 이벤트 등록
      window.kakao.maps.event.addListener(mapInstance.current, "click", (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        if (onLocationSelect) {
          onLocationSelect({ lat: latlng.getLat(), lng: latlng.getLng() });
        }
      });
    });
    
    // 컴포넌트가 사라질 때 이벤트 해제 (메모리 누수 방지)
    return () => {
      if (mapInstance.current) {
        window.kakao.maps.event.removeListener(mapInstance.current, "click");
      }
    };
  }, []); // 빈 배열: 처음 한 번만 실행

  // [업데이트] 선택된 위치가 바뀔 때 마커 위치와 지도 중심만 이동 (가장 중요)
  useEffect(() => {
    if (!mapInstance.current || !markerInstance.current || !selectedLocation) return;

    const moveLatLon = new window.kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng);

    // 2. 새 마커를 만들지 않고 기존 마커의 '위치만 이동' (성능 대폭 향상)
    markerInstance.current.setPosition(moveLatLon);

    // 3. 지도의 중심을 부드럽게 혹은 즉시 이동
    mapInstance.current.setCenter(moveLatLon);
    
  }, [selectedLocation?.lat, selectedLocation?.lng]); // 위경도가 실제로 바뀔 때만 작동

  return <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />;
});

export default KakaoMap;