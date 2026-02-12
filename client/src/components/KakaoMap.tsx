import { useEffect, useRef, memo, forwardRef, useImperativeHandle, useState } from "react";
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
  onMapClick?: (lat: number, lng: number) => void;
  mode: "MAP" | "ANT";
  initialLevel?: number;
  showCenterMarker?: boolean;
  circlePositions?: CirclePosition[];
  onMapIdle?: () => void;
}

declare global {
  interface Window {
    kakao: any;
  }
}

const KakaoMap = memo(
  forwardRef<KakaoMapRef, KakaoMapProps>(function KakaoMap(
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
    const idleHandlerRef = useRef<any>(null);
    const clickHandlerRef = useRef<any>(null);
    const modeRef = useRef(mode);
    const [mapReady, setMapReady] = useState(false);

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
        return (
          Math.abs(center.getLat() - markerPos.getLat()) < 0.00001 &&
          Math.abs(center.getLng() - markerPos.getLng()) < 0.00001
        );
      },
      getPointFromLatLng: (lat: number, lng: number) => {
        if (!mapInstance.current) return null;
        const projection = mapInstance.current.getProjection();
        const point = projection.pointFromCoords(
          new window.kakao.maps.LatLng(lat, lng)
        );
        return point ? { x: point.x, y: point.y } : null;
      },
      setCenter: (lat: number, lng: number) => {
        if (!mapInstance.current) return;
        mapInstance.current.setCenter(
          new window.kakao.maps.LatLng(lat, lng)
        );
      },
      setBounds: (latLngs, padding = 50) => {
        if (!mapInstance.current || latLngs.length === 0) return;
        const bounds = new window.kakao.maps.LatLngBounds();
        latLngs.forEach(({ lat, lng }) =>
          bounds.extend(new window.kakao.maps.LatLng(lat, lng))
        );
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

        mapInstance.current = new window.kakao.maps.Map(
          mapRef.current,
          mapOption
        );

        if (showCenterMarker) {
          markerInstance.current = new window.kakao.maps.Marker({
            position: mapInstance.current.getCenter(),
          });
          markerInstance.current.setMap(mapInstance.current);
        }

        const handleMapClickEvent = (mouseEvent: any) => {
          const lat = mouseEvent.latLng.getLat();
          const lng = mouseEvent.latLng.getLng();

          if (onMapClick) onMapClick(lat, lng);

          if (modeRef.current === "MAP" && onLocationSelect) {
            onLocationSelect({ lat, lng });
          }
        };

        clickHandlerRef.current = handleMapClickEvent;

        window.kakao.maps.event.addListener(
          mapInstance.current,
          "click",
          handleMapClickEvent
        );

        window.kakao.maps.event.addListener(
          mapInstance.current,
          "touchend",
          handleMapClickEvent
        );

        if (onMapIdle) {
          const handler = () => onMapIdle();
          idleHandlerRef.current = handler;
          window.kakao.maps.event.addListener(
            mapInstance.current,
            "idle",
            handler
          );
        }

        setMapReady(true);
      });

      return () => {
        if (!mapInstance.current) return;

        if (clickHandlerRef.current) {
          window.kakao.maps.event.removeListener(
            mapInstance.current,
            "click",
            clickHandlerRef.current
          );
          window.kakao.maps.event.removeListener(
            mapInstance.current,
            "touchend",
            clickHandlerRef.current
          );
        }

        if (idleHandlerRef.current) {
          window.kakao.maps.event.removeListener(
            mapInstance.current,
            "idle",
            idleHandlerRef.current
          );
        }
      };
    }, []);

    useEffect(() => {
      if (!mapInstance.current || !selectedLocation) return;

      const moveLatLon = new window.kakao.maps.LatLng(
        selectedLocation.lat,
        selectedLocation.lng
      );

      if (markerInstance.current) {
        markerInstance.current.setPosition(moveLatLon);
      }

      mapInstance.current.setCenter(moveLatLon);
    }, [selectedLocation]);

    useEffect(() => {
      if (!window.kakao || !mapInstance.current || !mapReady) return;

      circleInstances.current.forEach((c) => c.setMap(null));
      circleInstances.current = [];

      circlePositions.forEach((pos) => {
        const circle = new window.kakao.maps.Circle({
          center: new window.kakao.maps.LatLng(pos.lat, pos.lng),
          radius: 25,
          strokeWeight: 2,
          strokeColor: "#3b82f6",
          strokeOpacity: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.5,
        });
        circle.setMap(mapInstance.current);
        circleInstances.current.push(circle);
      });
    }, [circlePositions, mapReady]);

    return <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />;
  })
);

export default KakaoMap;