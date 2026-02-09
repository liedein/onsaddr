import { useEffect, useRef, memo, forwardRef, useImperativeHandle } from "react";
import type { LocationData } from "@/types/map";

export interface CirclePosition {
  lat: number;
  lng: number;
  label?: string;
}

export interface KakaoMapRef {
  isMarkerAtCenter: () => boolean;
  getPointFromLatLng: (lat: number, lng: number) => { x: number; y: number } | null;
  setCenter: (lat: number, lng: number) => void;
  setBounds: (latLngs: Array<{ lat: number; lng: number }>, padding?: number) => void;
  getMap: () => any;
}

interface KakaoMapProps {
  initialLocation?: LocationData | null;
  selectedLocation?: LocationData | null;
  onLocationSelect?: (location: LocationData) => void;
  /** 지도 클릭 시 항상 호출 (MAP 모드에서는 onLocationSelect도 함께 호출) */
  onMapClick?: (lat: number, lng: number) => void;
  isLoading?: boolean;
  mode: "MAP" | "ANT";
  /** 초기 확대 레벨 (1~14, 1이 최대 확대). 미지정 시 2 */
  initialLevel?: number;
  /** 단일 중심 마커 표시 여부 (Renew는 원형 마커만 사용 시 false) */
  showCenterMarker?: boolean;
  /** 원형 포인트 마커 위치 목록 (A1~A4 등) */
  circlePositions?: CirclePosition[];
  /** 지도 이동/줌 후 idle 시 호출 (화살표 등 오버레이 위치 갱신용) */
  onMapIdle?: () => void;
}

declare global {
  interface Window {
    kakao: any;
  }
}

const KakaoMap = memo(forwardRef<KakaoMapRef, KakaoMapProps>(function KakaoMap(
  {
    initialLocation,
    selectedLocation,
    onLocationSelect,
    onMapClick,
    mode,
    initialLevel = 2,
    showCenterMarker = true,
    circlePositions = [],
    onMapIdle,
  },
  ref
) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const circleInstances = useRef<any[]>([]);
  const idleHandlerRef = useRef<(() => void) | null>(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
    if (mapInstance.current) {
      const isAntMode = mode === "ANT";
      mapInstance.current.setDraggable(!isAntMode);
      mapInstance.current.setZoomable(!isAntMode);
    }
  }, [mode]);

  useImperativeHandle(ref, () => ({
    isMarkerAtCenter: () => {
      if (!mapInstance.current || !markerInstance.current) return false;
      const center = mapInstance.current.getCenter();
      const markerPos = markerInstance.current.getPosition();
      const diffLat = Math.abs(center.getLat() - markerPos.getLat());
      const diffLng = Math.abs(center.getLng() - markerPos.getLng());
      return diffLat < 0.00001 && diffLng < 0.00001;
    },
    getPointFromLatLng: (lat: number, lng: number) => {
      if (!mapInstance.current || !mapRef.current) return null;
      try {
        const projection = mapInstance.current.getProjection();
        const point = projection.pointFromCoords(new window.kakao.maps.LatLng(lat, lng));
        if (point) return { x: point.x, y: point.y };
      } catch (_) {}
      return null;
    },
    setCenter: (lat: number, lng: number) => {
      if (!mapInstance.current) return;
      const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
      mapInstance.current.setCenter(moveLatLon);
    },
    setBounds: (latLngs: Array<{ lat: number; lng: number }>, padding = 50) => {
      if (!mapInstance.current || !window.kakao || latLngs.length === 0) return;
      const bounds = new window.kakao.maps.LatLngBounds();
      latLngs.forEach(({ lat, lng }) => bounds.extend(new window.kakao.maps.LatLng(lat, lng)));
      mapInstance.current.setBounds(bounds, padding, padding, padding, padding);
    },
    getMap: () => mapInstance.current,
  }));

  useEffect(() => {
    if (!window.kakao || !mapRef.current) return;

    window.kakao.maps.load(() => {
      const defaultLat = initialLocation?.lat ?? 37.5665;
      const defaultLng = initialLocation?.lng ?? 126.978;

      const mapOption = {
        center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        level: initialLevel,
      };

      mapInstance.current = new window.kakao.maps.Map(mapRef.current, mapOption);

      if (showCenterMarker) {
        markerInstance.current = new window.kakao.maps.Marker({
          position: mapInstance.current.getCenter(),
        });
        markerInstance.current.setMap(mapInstance.current);
      } else {
        markerInstance.current = null;
      }

      const isAntMode = modeRef.current === "ANT";
      mapInstance.current.setDraggable(!isAntMode);
      mapInstance.current.setZoomable(!isAntMode);

      window.kakao.maps.event.addListener(mapInstance.current, "click", (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        const lat = latlng.getLat();
        const lng = latlng.getLng();
        if (onMapClick) onMapClick(lat, lng);
        if (modeRef.current === "MAP" && onLocationSelect) {
          onLocationSelect({ lat, lng });
        }
      });

      if (onMapIdle) {
        const handler = () => onMapIdle();
        idleHandlerRef.current = handler;
        window.kakao.maps.event.addListener(mapInstance.current, "idle", handler);
      }
    });

    return () => {
      if (mapInstance.current) {
        try {
          window.kakao.maps.event.removeListener(mapInstance.current, "click");
          if (idleHandlerRef.current) {
            window.kakao.maps.event.removeListener(mapInstance.current, "idle", idleHandlerRef.current);
          }
        } catch (_) {}
      }
    };
  }, []);

  // selectedLocation 변경 시 중심 마커/지도 이동 (showCenterMarker일 때만)
  useEffect(() => {
    if (!mapInstance.current || !selectedLocation) return;
    const moveLatLon = new window.kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
    if (markerInstance.current) {
      markerInstance.current.setPosition(moveLatLon);
    }
    mapInstance.current.setCenter(moveLatLon);
  }, [selectedLocation?.lat, selectedLocation?.lng, showCenterMarker]);

  // 원형 마커 갱신
  useEffect(() => {
    if (!window.kakao || !mapInstance.current) return;

    circleInstances.current.forEach((c) => c.setMap(null));
    circleInstances.current = [];

    circlePositions.forEach((pos) => {
      const circle = new window.kakao.maps.Circle({
        center: new window.kakao.maps.LatLng(pos.lat, pos.lng),
        radius: 15,
        strokeWeight: 2,
        strokeColor: "#3b82f6",
        strokeOpacity: 1,
        fillColor: "#3b82f6",
        fillOpacity: 0.6,
      });
      circle.setMap(mapInstance.current);
      circleInstances.current.push(circle);
    });
  }, [circlePositions]);

  return <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />;
}));

export default KakaoMap;
