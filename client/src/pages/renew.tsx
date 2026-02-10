/**
 * 시설물 현행화 페이지
 * 라우트: /renew
 * 
 * [주요 변경사항]
 * 1. 초기 지도: 사용자 현재 위치 중심, 기본 Pin 제거 (showCenterMarker=false)
 * 2. A1~A4 버튼 초기 상태: 회색 (위치 미설정 상태)
 * 3. 위치 모드: 
 *    - A1~A4 선택 없이 지도 터치 → 아무 동작 없음
 *    - A1~A4 선택 후 지도 터치 → 원 아이콘 생성, 전체 위치들의 중심으로 지도 이동
 * 4. 방향 모드: 
 *    - 위치 미설정 버튼 비활성화(disabled)
 *    - 활성 버튼 선택 후 지도 터치 → 화살표 생성 (지도 중심 이동 없음)
 *    - 활성 버튼 미선택 시 지도 터치 → 아무 동작 없음
 * 5. 지도 이동/줌은 항상 가능
 */
import { useState, useRef, useEffect, useCallback } from "react";
import KakaoMap from "@/components/KakaoMap";
import type { KakaoMapRef } from "@/components/KakaoMap";
import ToastNotification from "@/components/ToastNotification";
import AppLayout from "@/components/AppLayout";
import { useGeolocation } from "@/hooks/useGeolocation";
import { RefreshCw } from "lucide-react";
import type { LocationData, ToastData, AntInfo, SlotData } from "@/types/map";
import { latToDMS, lngToDMS } from "@/lib/coordinates";
import { copyToClipboard } from "@/lib/clipboard";

const SLOT_KEYS = [1, 2, 3, 4] as const;

/** A1~A4 색상 정의 (경쟁사 동향 페이지와 동일) */
const antColors: Record<number, { hex: string; bg: string; active: string; inactive: string }> = {
  1: { hex: "#f43f5e", bg: "bg-rose-500", active: "bg-rose-700", inactive: "bg-gray-500" },
  2: { hex: "#10b981", bg: "bg-emerald-500", active: "bg-emerald-700", inactive: "bg-gray-500" },
  3: { hex: "#0ea5e9", bg: "bg-sky-500", active: "bg-sky-700", inactive: "bg-gray-500" },
  4: { hex: "#8b5cf6", bg: "bg-violet-500", active: "bg-violet-700", inactive: "bg-gray-500" },
};

/** 화살표 꼭지점 계산 (경쟁사 동향 페이지 handleMapAreaClick과 동일 로직) */
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
  // 위치/방향 모드
  const [mode, setMode] = useState<"위치" | "방향">("위치");
  
  // A1~A4 각 슬롯 데이터 (위치 + 방향)
  const [slots, setSlots] = useState<Record<number, SlotData | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
  });
  
  // 현재 선택된 A# 버튼 (위치 모드 또는 방향 모드에서)
  const [selectedAnt, setSelectedAnt] = useState<number | null>(null);
  
  // 패널에 표시할 위치 정보 (위치 모드에서 A# 미선택 시 사용 - 현재는 사용 안 함)
  const [panelLocation, setPanelLocation] = useState<LocationData | null>(null);
  
  const [subAddress, setSubAddress] = useState("");
  const [detail, setDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  
  // 화살표 픽셀 좌표 (지도 위 SVG 렌더링용)
  const [arrowPoints, setArrowPoints] = useState<Record<number, AntInfo["points"] | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
  });
  
  // A1~A4 위치의 픽셀 좌표 (원형 포인트 SVG 렌더링용)
  const [circlePixelPositions, setCirclePixelPositions] = useState<Record<number, { x: number; y: number } | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  const [usageCount, setUsageCount] = useState(0);
  const USAGE_LIMIT = 100;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapCompRef = useRef<KakaoMapRef | null>(null);

  // 금일 조회 횟수 localStorage
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const savedData = localStorage.getItem("map_usage");
    if (savedData) {
      const { date, count } = JSON.parse(savedData);
      if (date === today) setUsageCount(count);
      else {
        localStorage.setItem("map_usage", JSON.stringify({ date: today, count: 0 }));
        setUsageCount(0);
      }
    } else {
      localStorage.setItem("map_usage", JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  const incrementUsage = () => {
    const today = new Date().toLocaleDateString();
    setUsageCount((prev) => {
      const newCount = prev + 1;
      localStorage.setItem("map_usage", JSON.stringify({ date: today, count: newCount }));
      return newCount;
    });
  };

  // 사용자 현재 위치 가져오기 (Geolocation)
  const { currentLocation, isLoadingLocation } = useGeolocation();

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleRefresh = () => window.location.reload();

  // 좌표 → 주소 변환 API 호출
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

  // 화살표 픽셀 좌표 + 원형 포인트 픽셀 좌표 갱신 (지도 이동/줌 시 호출)
  const updateArrowPoints = useCallback(() => {
    const ref = mapCompRef.current;
    if (!ref) return;
    
    const nextArrow: Record<number, AntInfo["points"] | null> = { 1: null, 2: null, 3: null, 4: null };
    const nextCircle: Record<number, { x: number; y: number } | null> = { 1: null, 2: null, 3: null, 4: null };
    
    SLOT_KEYS.forEach((num) => {
      const slot = slots[num];
      if (!slot || slot.lat == null || slot.lng == null) return;
      
      // 위도/경도 → 픽셀 좌표 변환
      const pt = ref.getPointFromLatLng(slot.lat, slot.lng);
      if (!pt) return;
      
      // 원형 포인트 픽셀 좌표 저장
      nextCircle[num] = { x: pt.x, y: pt.y };
      
      // 방향이 설정된 경우 화살표 픽셀 좌표 계산
      if (slot.direction) {
        nextArrow[num] = getArrowPoints(pt.x, pt.y, slot.direction.angle);
      }
    });
    
    setArrowPoints(nextArrow);
    setCirclePixelPositions(nextCircle);
  }, [slots]);

  useEffect(() => {
    updateArrowPoints();
  }, [slots, updateArrowPoints]);

  // 지도 idle 이벤트 핸들러 (지도 이동/줌 후 오버레이 위치 갱신)
  const handleMapIdle = useCallback(() => {
    updateArrowPoints();
  }, [updateArrowPoints]);

  // 선택된 위치들의 중심 좌표 계산 및 지도 이동
  const moveToSelectedLocationsCenter = useCallback(() => {
    const ref = mapCompRef.current;
    if (!ref) return;

    const locations = SLOT_KEYS.map(num => slots[num])
      .filter((slot): slot is SlotData => slot !== null);

    if (locations.length === 0) return;

    if (locations.length === 1) {
      // 1개만 있으면 해당 위치로 중심 이동
      ref.setCenter(locations[0].lat, locations[0].lng);
    } else {
      // 2개 이상이면 모든 위치가 보이도록 bounds 설정
      const latLngs = locations.map(loc => ({ lat: loc.lat, lng: loc.lng }));
      ref.setBounds(latLngs, 100);
    }
  }, [slots]);

  // 지도 클릭 핸들러 - 위치/방향 모드에 따라 분기
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      // 위치 모드
      if (mode === "위치") {
        // A# 버튼이 선택되지 않은 경우 → 아무 동작 없음
        if (selectedAnt === null) return;

        // 조회 한도 체크
        if (usageCount >= USAGE_LIMIT) {
          showToast("오늘 조회 한도(100회)에 도달했습니다.", "error");
          return;
        }

        // 선택된 버튼에 위치 설정
        try {
          setIsLoading(true);
          const data = await fetchAddress(lat, lng);
          
          setSlots(prev => ({
            ...prev,
            [selectedAnt]: {
              lat,
              lng,
              address: data.jibunAddress || data.address,
              roadAddress: data.roadAddress,
              jibunAddress: data.jibunAddress,
              direction: null, // 위치 재지정 시 방향 초기화
            }
          }));
          
          incrementUsage();
          
          // 위치 설정 후 지도 중심 이동 (모든 선택된 위치들의 중심으로)
          setTimeout(() => {
            moveToSelectedLocationsCenter();
          }, 100);
        } catch {
          showToast("주소를 가져오는데 실패했습니다.", "error");
        } finally {
          setIsLoading(false);
        }
      }
      // 방향 모드
      else if (mode === "방향") {
        // A# 버튼이 선택되지 않은 경우 → 아무 동작 없음
        if (selectedAnt === null) return;

        // 선택된 버튼에 위치가 설정되어 있지 않으면 → 아무 동작 없음
        const slot = slots[selectedAnt];
        if (!slot) return;

        // 지도 컨테이너에서 클릭 위치 계산 (경쟁사 동향 페이지와 동일 로직)
        if (!mapContainerRef.current) return;
        
        const ref = mapCompRef.current;
        if (!ref) return;

        // 슬롯 위치의 픽셀 좌표 가져오기
        const centerPt = ref.getPointFromLatLng(slot.lat, slot.lng);
        if (!centerPt) return;

        // 클릭한 위치의 픽셀 좌표 가져오기
        const clickPt = ref.getPointFromLatLng(lat, lng);
        if (!clickPt) return;

        // 각도 계산 (경쟁사 동향 페이지 로직)
        const angleRad = Math.atan2(clickPt.y - centerPt.y, clickPt.x - centerPt.x);
        let deg = Math.round(angleRad * (180 / Math.PI) + 90);
        if (deg < 0) deg += 360;
        if (deg >= 360) deg -= 360;

        // 방향 정보 저장 (지도 중심 이동 없음)
        setSlots(prev => ({
          ...prev,
          [selectedAnt]: {
            ...slot,
            direction: {
              angle: deg,
              points: getArrowPoints(centerPt.x, centerPt.y, deg),
            }
          }
        }));
      }
    },
    [mode, selectedAnt, slots, usageCount, fetchAddress, incrementUsage, showToast, moveToSelectedLocationsCenter]
  );

  // A# 버튼 클릭 핸들러
  const handleAntButtonClick = useCallback((num: number) => {
    setSelectedAnt(prev => prev === num ? null : num);
  }, []);

  // 복사 버튼 핸들러
  const handleCopyToClipboard = useCallback(async () => {
    if (!slots[1]) {
      showToast("A1 위치를 먼저 설정해주세요.", "error");
      return;
    }

    let copyText = "";

    // A1~A4 각각 정보 추가
    SLOT_KEYS.forEach(num => {
      const slot = slots[num];
      if (!slot) return;

      copyText += `\n[A${num}]\n`;
      copyText += `위도: ${slot.lat.toFixed(6)}\n`;
      copyText += `경도: ${slot.lng.toFixed(6)}\n`;
      copyText += `지번주소: ${slot.address || ""}\n`;
      if (slot.direction) {
        copyText += `방향: ${slot.direction.angle}°\n`;
      }
    });

    if (subAddress) {
      copyText += `\n상세위치: ${subAddress}\n`;
    }
    if (detail) {
      copyText += `세부내역: ${detail}\n`;
    }

    const success = await copyToClipboard(copyText.trim());
    if (success) {
      showToast("클립보드에 복사되었습니다!", "success");
    } else {
      showToast("복사에 실패했습니다.", "error");
    }
  }, [slots, subAddress, detail, showToast]);

  // 지도에 표시할 위치 결정 (currentLocation 우선)
  const selectedLocationForMap = currentLocation;

  // 패널에 표시할 위치 정보 (A1 우선, 없으면 panelLocation)
  const displayLocation = slots[1] ?? panelLocation;

  return (
    <AppLayout
      title="시설물 현행화"
      rightSlot={
        <button
          onClick={handleRefresh}
          className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-6 h-6" />
        </button>
      }
    >
      <div className="flex-1 flex flex-col">
        {/* 지도 영역 */}
        <div
          ref={mapContainerRef}
          className="relative overflow-hidden"
          style={{ height: "38vh", minHeight: "270px" }}
        >
          <KakaoMap
            ref={mapCompRef}
            initialLocation={currentLocation}
            selectedLocation={selectedLocationForMap}
            mode="MAP"
            initialLevel={2}
            showCenterMarker={false} // 초기 Pin 제거
            circlePositions={[]} // SVG로 직접 렌더링하므로 빈 배열
            onMapClick={handleMapClick}
            onMapIdle={handleMapIdle}
            isLoading={isLoading || isLoadingLocation}
          />

          {/* 위치/방향 토글 버튼 (좌하단) */}
          <div className="absolute bottom-4 left-4 flex rounded-md overflow-hidden shadow-md bg-gray-800/90 z-20">
            <button
              type="button"
              onClick={() => {
                setMode("위치");
                setSelectedAnt(null);
              }}
              className={`w-16 h-[42px] shrink-0 font-bold text-sm transition-all duration-200 active:scale-95 ${
                mode === "위치"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              위치
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("방향");
                setSelectedAnt(null);
              }}
              className={`w-16 h-[42px] shrink-0 font-bold text-sm transition-all duration-200 active:scale-95 ${
                mode === "방향"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              방향
            </button>
          </div>

          {/* A1~A4 버튼 (우하단) */}
          <div className="absolute bottom-4 right-4 flex space-x-2 z-20">
            {SLOT_KEYS.map((num) => {
              const config = antColors[num];
              const isSelected = selectedAnt === num;
              const hasLocation = slots[num] !== null;
              
              // 방향 모드에서는 위치가 설정되지 않은 버튼 비활성화
              const isDisabled = mode === "방향" && !hasLocation;

              // 버튼 스타일 결정
              let buttonStyle = "";
              if (isSelected) {
                // 선택된 상태
                buttonStyle = `${config.active} border-white scale-110 shadow-xl z-30`;
              } else if (hasLocation) {
                // 위치가 설정된 상태 (원래 색상)
                buttonStyle = `${config.bg} border-transparent shadow-md`;
              } else {
                // 위치가 설정되지 않은 상태 (회색)
                buttonStyle = `${config.inactive} border-transparent opacity-70`;
              }

              return (
                <button
                  key={num}
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) {
                      handleAntButtonClick(num);
                    }
                  }}
                  className={`w-12 h-10 rounded text-white font-bold transition-all duration-200 active:scale-90 border-2 ${buttonStyle} ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}`}
                >
                  {slots[num]?.direction?.angle ?? `A${num}`}
                </button>
              );
            })}
          </div>

          {/* 원형 포인트 + 화살표 SVG 오버레이 */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {/* 원형 포인트 렌더링 */}
            {SLOT_KEYS.map((num) => {
              const pos = circlePixelPositions[num];
              if (!pos) return null;
              const color = antColors[num].hex;
              return (
                <g key={`circle-${num}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={14}
                    fill={color}
                    fillOpacity={0.5}
                    stroke={color}
                    strokeWidth={2}
                  />
                </g>
              );
            })}
            
            {/* 화살표 렌더링 (경쟁사 동향 페이지와 동일) */}
            {SLOT_KEYS.map((num) => {
              const pts = arrowPoints[num];
              if (!pts) return null;
              const color = antColors[num].hex;
              return (
                <g key={`arrow-${num}`}>
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

        {/* 하단 폼 영역 */}
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
              className="flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors duration-200 w-[60px] h-full disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* 금일 조회 횟수 */}
          <div className="mt-3 text-center pb-0 border-t border-gray-700 pt-3">
            <span className="text-sm text-gray-300">금일 조회 횟수: </span>
            <span className="text-sm text-emerald-400 font-medium">{usageCount}</span>
            <span className="text-sm text-gray-300"> / {USAGE_LIMIT}</span>
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
