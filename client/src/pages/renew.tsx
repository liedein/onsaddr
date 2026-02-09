/**
 * 현행화 페이지
 * 라우트: /renew
 * - 지도 초기 level 1, MAP/ANT 좌하단, 지도 높이 확대
 * - 하단 패널: 위도, 경도, 지번주소, 상세위치, 세부내역만
 * - ANT 시 위치/방향 토글, A1~A4 위치·방향, bounds 자동 조정, 복사 로직
 */
import { useState, useRef, useEffect, useCallback } from "react";
import KakaoMap from "@/components/KakaoMap";
import type { KakaoMapRef } from "@/components/KakaoMap";
import ToastNotification from "@/components/ToastNotification";
import AppLayout from "@/components/AppLayout";
import type { LocationData, ToastData, AntInfo, SlotData } from "@/types/map";
import { latToDMS, lngToDMS } from "@/lib/coordinates";
import { copyToClipboard } from "@/lib/clipboard";

const SLOT_KEYS = [1, 2, 3, 4] as const;
const antColors: Record<number, { hex: string; bg: string; active: string }> = {
  1: { hex: "#f43f5e", bg: "bg-rose-500", active: "bg-rose-700" },
  2: { hex: "#10b981", bg: "bg-emerald-500", active: "bg-emerald-700" },
  3: { hex: "#0ea5e9", bg: "bg-sky-500", active: "bg-sky-700" },
  4: { hex: "#8b5cf6", bg: "bg-violet-500", active: "bg-violet-700" },
};

/** 화살표 꼭지점 계산 (Etc와 동일 로직) */
function getArrowPoints(
  sx: number,
  sy: number,
  angleDeg: number
): AntInfo["points"] {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const length = 80;
  const ex = sx + Math.cos(angleRad) * length;
  const ey = sy + Math.sin(angleRad) * length;
  const headLen = 12;
  const ax1 = ex - headLen * Math.cos(angleRad - Math.PI / 6);
  const ay1 = ey - headLen * Math.sin(angleRad - Math.PI / 6);
  const ax2 = ex - headLen * Math.cos(angleRad + Math.PI / 6);
  const ay2 = ey - headLen * Math.sin(angleRad + Math.PI / 6);
  return { sx, sy, ex, ey, ax1, ay1, ax2, ay2 };
}

export default function Renew() {
  const [mode, setMode] = useState<"MAP" | "ANT">("MAP");
  const [locationDirectionMode, setLocationDirectionMode] = useState<"위치" | "방향">("위치");
  const [slots, setSlots] = useState<Record<number, SlotData | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
  });
  const [selectedAnt, setSelectedAnt] = useState<number | null>(null);
  const [panelLocation, setPanelLocation] = useState<LocationData | null>(null);
  const [subAddress, setSubAddress] = useState("");
  const [detail, setDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [arrowPoints, setArrowPoints] = useState<Record<number, AntInfo["points"] | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapCompRef = useRef<KakaoMapRef | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const fetchAddress = useCallback(
    async (lat: number, lng: number): Promise<{ address: string; roadAddress?: string; jibunAddress?: string }> => {
      const res = await fetch("/api/coordinate-to-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (!res.ok) throw new Error("주소 변환 실패");
      const data = await res.json();
      return {
        address: data.address ?? "",
        roadAddress: data.roadAddress ?? "",
        jibunAddress: data.jibunAddress ?? "",
      };
    },
    []
  );

  const updateArrowPoints = useCallback(() => {
    const ref = mapCompRef.current;
    if (!ref) return;
    const next: Record<number, AntInfo["points"] | null> = { 1: null, 2: null, 3: null, 4: null };
    SLOT_KEYS.forEach((num) => {
      const slot = slots[num];
      if (!slot?.lat || !slot?.direction) return;
      const pt = ref.getPointFromLatLng(slot.lat, slot.lng);
      if (!pt) return;
      next[num] = getArrowPoints(pt.x, pt.y, slot.direction.angle);
    });
    setArrowPoints(next);
  }, [slots]);

  useEffect(() => {
    updateArrowPoints();
  }, [slots, updateArrowPoints]);

  const handleMapIdle = useCallback(() => {
    updateArrowPoints();
  }, [updateArrowPoints]);

  const circlePositions = SLOT_KEYS.map((num) => {
    const s = slots[num];
    if (!s) return null;
    return { lat: s.lat, lng: s.lng, label: `A${num}` };
  }).filter(Boolean) as Array<{ lat: number; lng: number; label?: string }>;

  const selectedLocationForMap =
    panelLocation ?? (slots[1] ? { lat: slots[1].lat, lng: slots[1].lng, address: slots[1].address } : null);

  const handleLocationSelect = useCallback(
    async (location: LocationData) => {
      if (mode !== "MAP") return;
      setPanelLocation({ ...location, address: "주소를 불러오는 중..." });
      try {
        setIsLoading(true);
        const data = await fetchAddress(location.lat, location.lng);
        setPanelLocation({
          lat: location.lat,
          lng: location.lng,
          address: data.jibunAddress || data.address,
          roadAddress: data.roadAddress,
          jibunAddress: data.jibunAddress,
        });
      } catch {
        showToast("주소를 가져오는데 실패했습니다.", "error");
        setPanelLocation((prev) => (prev ? { ...prev, address: "" } : null));
      } finally {
        setIsLoading(false);
      }
    },
    [mode, fetchAddress, showToast]
  );

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (mode !== "ANT") return;

      if (locationDirectionMode === "위치" && selectedAnt !== null) {
        setSlots((prev) => {
          const next = { ...prev };
          next[selectedAnt] = {
            lat,
            lng,
            address: "로딩 중...",
            direction: null,
          };
          return next;
        });
        try {
          setIsLoading(true);
          const data = await fetchAddress(lat, lng);
          setSlots((prev) => {
            const next = { ...prev };
            if (next[selectedAnt]) {
              next[selectedAnt] = {
                ...next[selectedAnt]!,
                address: data.jibunAddress || data.address,
                roadAddress: data.roadAddress,
                jibunAddress: data.jibunAddress,
              };
            }
            return next;
          });
          if (selectedAnt === 1) {
            setPanelLocation({
              lat,
              lng,
              address: data.jibunAddress || data.address,
              roadAddress: data.roadAddress,
              jibunAddress: data.jibunAddress,
            });
          }
        } catch {
          showToast("주소를 가져오는데 실패했습니다.", "error");
        } finally {
          setIsLoading(false);
        }

        const latLngs: Array<{ lat: number; lng: number }> = [{ lat, lng }];
        SLOT_KEYS.forEach((n) => {
          if (n !== selectedAnt && slots[n]) {
            latLngs.push({ lat: slots[n]!.lat, lng: slots[n]!.lng });
          }
        });
        setTimeout(() => {
          if (latLngs.length > 0) mapCompRef.current?.setBounds(latLngs);
          else mapCompRef.current?.setCenter(lat, lng);
        }, 100);
        return;
      }

      if (locationDirectionMode === "방향" && selectedAnt !== null) {
        const slot = slots[selectedAnt];
        if (!slot) return;
        const ref = mapCompRef.current;
        if (!ref) return;
        const slotPt = ref.getPointFromLatLng(slot.lat, slot.lng);
        const clickPt = ref.getPointFromLatLng(lat, lng);
        if (!slotPt || !clickPt) return;
        const angleRad = Math.atan2(clickPt.y - slotPt.y, clickPt.x - slotPt.x);
        let deg = Math.round(angleRad * (180 / Math.PI) + 90);
        if (deg < 0) deg += 360;
        if (deg >= 360) deg -= 360;
        const points = getArrowPoints(slotPt.x, slotPt.y, deg);
        setSlots((prev) => {
          const next = { ...prev };
          if (next[selectedAnt]) {
            next[selectedAnt] = {
              ...next[selectedAnt]!,
              direction: { angle: deg, points },
            };
          }
          return next;
        });
        setArrowPoints((prev) => ({ ...prev, [selectedAnt]: points }));
      }
    },
    [
      mode,
      locationDirectionMode,
      selectedAnt,
      slots,
      fetchAddress,
      showToast,
    ]
  );

  const slotsWithPosition = SLOT_KEYS.filter((n) => slots[n]);
  useEffect(() => {
    if (mode !== "ANT" || slotsWithPosition.length === 0) return;
    const latLngs = slotsWithPosition.map((n) => ({
      lat: slots[n]!.lat,
      lng: slots[n]!.lng,
    }));
    mapCompRef.current?.setBounds(latLngs);
  }, [mode, slots]);

  const handleCopyToClipboard = useCallback(async () => {
    const a1 = slots[1];
    if (!a1) {
      showToast("A1 위치를 먼저 설정해주세요.", "error");
      return;
    }

    const roadAddr = a1.roadAddress ?? "";
    const jibunAddr = a1.jibunAddress ?? a1.address ?? "";
    const a1Lat = a1.lat.toFixed(6);
    const a1Lng = a1.lng.toFixed(6);
    const a1LatDMS = latToDMS(a1.lat);
    const a1LngDMS = lngToDMS(a1.lng);
    const a1Dir = a1.direction ? String(a1.direction.angle) : "";

    const lines: string[] = [
      `A1 위도: ${a1Lat}`,
      `A1 경도: ${a1Lng}`,
      `A1 위도(도분초): ${a1LatDMS}`,
      `A1 경도(도분초): ${a1LngDMS}`,
      `A1 방향: ${a1Dir}`,
      `도로명주소: ${roadAddr}`,
      `지번주소: ${jibunAddr}`,
      `상세위치: ${subAddress}`,
    ];

    for (const num of [2, 3, 4]) {
      const s = slots[num];
      if (!s) continue;
      lines.push(
        `A${num} 위도: ${s.lat.toFixed(6)}`,
        `A${num} 경도: ${s.lng.toFixed(6)}`,
        `A${num} 위도(도분초): ${latToDMS(s.lat)}`,
        `A${num} 경도(도분초): ${lngToDMS(s.lng)}`,
        `A${num} 방향: ${s.direction ? s.direction.angle : ""}`
      );
    }

    const copyText = lines.join("\n");
    const ok = await copyToClipboard(copyText);
    if (ok) showToast("클립보드에 복사되었습니다!", "success");
    else showToast("복사에 실패했습니다.", "error");
  }, [slots, subAddress, showToast]);

  const displayLocation = panelLocation ?? (slots[1] ? { lat: slots[1].lat, lng: slots[1].lng, address: slots[1].address } : null);

  return (
    <AppLayout title="현행화">
      <div className="flex-1 flex flex-col relative">
        {/* 지도 영역: 높이를 헤더 높이만큼 더 크게 (기존 38vh → 약 45vh) */}
        <div
          ref={mapContainerRef}
          className="relative overflow-hidden"
          style={{ height: "45vh", minHeight: "320px" }}
        >
          <KakaoMap
            ref={mapCompRef}
            initialLevel={1}
            showCenterMarker={false}
            mode={mode}
            selectedLocation={selectedLocationForMap}
            onLocationSelect={handleLocationSelect}
            onMapClick={handleMapClick}
            onMapIdle={handleMapIdle}
            circlePositions={circlePositions}
            isLoading={isLoading}
          />

          {/* MAP/ANT 토글: 좌측 하단 */}
          <div className="absolute bottom-4 left-4 z-20">
            <button
              type="button"
              onClick={() => setMode((m) => (m === "MAP" ? "ANT" : "MAP"))}
              className={`w-16 h-[42px] rounded-md font-bold text-sm shadow-md transition-all active:scale-95 ${
                mode === "MAP" ? "bg-blue-600 text-white" : "bg-orange-600 text-white"
              }`}
            >
              {mode}
            </button>
          </div>

          {/* ANT일 때 위치/방향 토글 + A1~A4 (지도 오른쪽 또는 인접 UI) */}
          {mode === "ANT" && (
            <div className="absolute top-4 right-4 bottom-4 flex flex-col gap-2 z-20 w-28">
              <div className="flex rounded-md overflow-hidden shadow-lg bg-gray-800/90 p-0.5">
                <button
                  type="button"
                  onClick={() => setLocationDirectionMode("위치")}
                  className={`flex-1 py-2 text-xs font-medium ${
                    locationDirectionMode === "위치"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  위치
                </button>
                <button
                  type="button"
                  onClick={() => setLocationDirectionMode("방향")}
                  className={`flex-1 py-2 text-xs font-medium ${
                    locationDirectionMode === "방향"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  방향
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {SLOT_KEYS.map((num) => {
                  const hasPosition = !!slots[num];
                  const canSelectDirection =
                    locationDirectionMode === "방향" && hasPosition;
                  const canSelectPosition = locationDirectionMode === "위치";
                  const isSelected = selectedAnt === num;
                  const canSelect =
                    locationDirectionMode === "위치" || canSelectDirection;
                  const config = antColors[num];
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => setSelectedAnt(isSelected ? null : num)}
                      className={`w-full py-2 rounded text-white font-bold text-sm transition-all border-2 ${
                        isSelected ? config.active : hasPosition ? config.bg : "bg-gray-600 opacity-70"
                      } ${!canSelect ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      A{num}
                      {slots[num]?.direction != null && (
                        <span className="ml-1 text-xs">({slots[num]!.direction!.angle}°)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 방향 화살표 SVG 오버레이 */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {SLOT_KEYS.map((num) => {
              const pts = arrowPoints[num];
              if (!pts) return null;
              const color = antColors[num].hex;
              return (
                <g key={num}>
                  <line
                    x1={pts.sx}
                    y1={pts.sy}
                    x2={pts.ex}
                    y2={pts.ey}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${pts.ex},${pts.ey} ${pts.ax1},${pts.ay1} ${pts.ax2},${pts.ay2}`}
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* 하단 정보 패널: 위도, 경도, 지번주소, 상세위치, 세부내역 + 복사 */}
        <div className="bg-gray-800 border-t border-gray-700 pt-5 pb-4 px-2 flex flex-col space-y-3">
          <div className="flex items-stretch space-x-2">
            <div className="flex flex-col flex-1 space-y-2">
              <div className="flex items-center">
                <label className="text-sm text-gray-300 w-20 shrink-0">위도</label>
                <input
                  className="text-base font-mono bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
                  value={displayLocation ? displayLocation.lat.toFixed(6) : ""}
                  readOnly
                />
              </div>
              <div className="flex items-center">
                <label className="text-sm text-gray-300 w-20 shrink-0">경도</label>
                <input
                  className="text-base font-mono bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
                  value={displayLocation ? displayLocation.lng.toFixed(6) : ""}
                  readOnly
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyToClipboard}
              disabled={!slots[1]}
              className="flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors w-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: "1.15rem", minWidth: "54px", minHeight: "86px" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 mb-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" stroke="currentColor" fill="none" />
                <rect x="3" y="3" width="13" height="13" rx="2" strokeWidth="2" stroke="currentColor" fill="none" />
              </svg>
              복사
            </button>
          </div>

          <div className="flex items-center">
            <label className="text-sm text-gray-300 w-20 shrink-0">지번주소</label>
            <input
              className="text-base bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
              value={displayLocation?.address ?? ""}
              readOnly
            />
          </div>

          <div className="flex items-center">
            <label className="text-sm text-gray-300 w-20 shrink-0">상세위치</label>
            <input
              className="text-base bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1"
              value={subAddress}
              onChange={(e) => setSubAddress(e.target.value)}
              placeholder="건물명, 시설물 위치 등"
            />
          </div>

          <div className="flex items-start">
            <label className="text-sm text-gray-300 w-20 shrink-0 mt-2">세부내역</label>
            <textarea
              maxLength={100}
              rows={2}
              className="text-base bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1 resize-none"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="100자 이내"
              style={{ minHeight: "3.2em", maxHeight: "4em" }}
            />
          </div>
        </div>
      </div>
      <ToastNotification
        message={toast?.message ?? ""}
        type={toast?.type ?? "success"}
        isVisible={!!toast?.isVisible}
      />
    </AppLayout>
  );
}
