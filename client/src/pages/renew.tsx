/** client\src\pages\renew.tsx */
import { useState, useRef, useEffect, useCallback } from "react";
import KakaoMap, { KakaoMapRef } from "@/components/KakaoMap";
import ToastNotification from "@/components/ToastNotification";
import AppLayout from "@/components/AppLayout";
import { useGeolocation } from "@/hooks/useGeolocation";
import { RefreshCw } from "lucide-react";
import type { LocationData, ToastData, AntInfo, SlotData } from "@/types/map";
import { copyToClipboard } from "@/lib/clipboard";

const SLOT_KEYS = [1, 2, 3, 4] as const;

const antColors: Record<number, { hex: string; bg: string; active: string; inactive: string }> = {
  1: { hex: "#f43f5e", bg: "bg-rose-500", active: "bg-rose-700", inactive: "bg-gray-500" },
  2: { hex: "#10b981", bg: "bg-emerald-500", active: "bg-emerald-700", inactive: "bg-gray-500" },
  3: { hex: "#0ea5e9", bg: "bg-sky-500", active: "bg-sky-700", inactive: "bg-gray-500" },
  4: { hex: "#8b5cf6", bg: "bg-violet-500", active: "bg-violet-700", inactive: "bg-gray-500" },
};

function getArrowPoints(sx: number, sy: number, angleDeg: number): AntInfo["points"] {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const length = 60;
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
  const [mode, setMode] = useState<"위치" | "방향">("위치");
  const [selectedAnt, setSelectedAnt] = useState<number | null>(null);
  const selectedAntRef = useRef<number | null>(null);
  const [slots, setSlots] = useState<Record<number, SlotData | null>>({ 1: null, 2: null, 3: null, 4: null });
  const [arrowPoints, setArrowPoints] = useState<Record<number, AntInfo["points"] | null>>({ 1: null, 2: null, 3: null, 4: null });
  const [circlePixelPositions, setCirclePixelPositions] = useState<Record<number, { x: number; y: number } | null>>({ 1: null, 2: null, 3: null, 4: null });
  
  const [subAddress, setSubAddress] = useState("");
  const [detail, setDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const USAGE_LIMIT = 100;

  const mapCompRef = useRef<KakaoMapRef | null>(null);
  const { currentLocation, isLoadingLocation } = useGeolocation();

  useEffect(() => { selectedAntRef.current = selectedAnt; }, [selectedAnt]);

  // 1. 픽셀 좌표 갱신
  const updatePixelPositions = useCallback(() => {
    const ref = mapCompRef.current;
    if (!ref) return;

    const nextCircle: any = {};
    const nextArrow: any = {};

    SLOT_KEYS.forEach((num) => {
      const slot = slots[num];
      if (!slot) return;
      const pt = ref.getPointFromLatLng(slot.lat, slot.lng);
      if (pt) {
        nextCircle[num] = pt;
        if (slot.direction) {
          nextArrow[num] = getArrowPoints(pt.x, pt.y, slot.direction.angle);
        }
      }
    });
    setCirclePixelPositions(nextCircle);
    setArrowPoints(nextArrow);
  }, [slots]);

  // 2. 중심 이동
  const moveToCenter = useCallback(() => {
    const ref = mapCompRef.current;
    const validSlots = SLOT_KEYS.map(n => slots[n]).filter((s): s is SlotData => s !== null);
    if (!ref || validSlots.length === 0) return;
    const avgLat = validSlots.reduce((s, sl) => s + sl.lat, 0) / validSlots.length;
    const avgLng = validSlots.reduce((s, sl) => s + sl.lng, 0) / validSlots.length;
    ref.setCenter(avgLat, avgLng);
  }, [slots]);

  // 3. 지도 클릭 핸들러 (수정됨)
  const handleMapClick = async (lat: number, lng: number) => {
    const antKey = selectedAntRef.current;
    if (antKey === null) return;

    if (mode === "위치") {
      if (usageCount >= USAGE_LIMIT) return setToast({ message: "조회 한도 초과", type: "error", isVisible: true });
      setIsLoading(true);
      try {
        const res = await fetch("/api/coordinate-to-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        const data = await res.json();
        setSlots(prev => ({
          ...prev,
          [antKey]: { lat, lng, address: data.jibunAddress || data.address, direction: null }
        }));
        setUsageCount(c => c + 1);
        setTimeout(moveToCenter, 100);
      } finally { setIsLoading(false); }
    } else if (mode === "방향") {
      const slot = slots[antKey];
      if (!slot) return;
      const ref = mapCompRef.current;
      const centerPt = ref?.getPointFromLatLng(slot.lat, slot.lng);
      const clickPt = ref?.getPointFromLatLng(lat, lng);
      if (centerPt && clickPt) {
        const angleRad = Math.atan2(clickPt.y - centerPt.y, clickPt.x - centerPt.x);
        let deg = (Math.round(angleRad * (180 / Math.PI) + 90) + 360) % 360;
        setSlots(prev => ({
          ...prev,
          [antKey]: { ...slot, direction: { angle: deg, points: getArrowPoints(centerPt.x, centerPt.y, deg) } }
        }));
      }
    }
  };

  useEffect(() => { updatePixelPositions(); }, [slots, updatePixelPositions]);

  const handleCopyToClipboard = async () => {
    let text = "";
    SLOT_KEYS.forEach(n => {
      const s = slots[n];
      if (s) text += `[A${n}] 위도:${s.lat.toFixed(6)} 경도:${s.lng.toFixed(6)} 주소:${s.address} ${s.direction ? `방향:${s.direction.angle}°` : ""}\n`;
    });
    if (subAddress) text += `상세:${subAddress}\n`;
    if (detail) text += `내역:${detail}`;
    if (await copyToClipboard(text)) setToast({ message: "복사됨", type: "success", isVisible: true });
    setTimeout(() => setToast(null), 2000);
  };

  const displayLocation = slots[1] || null;

  return (
    <AppLayout title="시설물 현행화" rightSlot={<button onClick={() => window.location.reload()}><RefreshCw className="w-6 h-6 text-gray-400" /></button>}>
      <div className="flex-1 flex flex-col">
        <div className="relative overflow-hidden" style={{ height: "38vh", minHeight: "270px" }}>
          <KakaoMap ref={mapCompRef} initialLocation={currentLocation} mode="MAP" showCenterMarker={false} onMapClick={handleMapClick} onMapIdle={updatePixelPositions} />
          
          <div className="absolute bottom-4 left-4 flex rounded-md overflow-hidden bg-gray-800/90 z-20">
            {["위치", "방향"].map((m: any) => (
              <button key={m} onClick={() => { setMode(m); setSelectedAnt(null); }} className={`w-16 h-[42px] font-bold text-sm ${mode === m ? (m === "위치" ? "bg-blue-600" : "bg-orange-600") : "bg-gray-700"} text-white`}>{m}</button>
            ))}
          </div>

          <div className="absolute bottom-4 right-4 flex space-x-2 z-20">
            {SLOT_KEYS.map((num) => {
              const s = slots[num];
              const isSelected = selectedAnt === num;
              const isDisabled = mode === "방향" && !s;
              return (
                <button key={num} disabled={isDisabled} onClick={() => setSelectedAnt(isSelected ? null : num)}
                  className={`w-12 h-10 rounded font-bold border-2 transition-all ${isSelected ? "border-white scale-110 " + antColors[num].active : (s ? antColors[num].bg : "bg-gray-500")} text-white ${isDisabled ? "opacity-30" : ""}`}>
                  {s?.direction ? `${s.direction.angle}°` : `A${num}`}
                </button>
              );
            })}
          </div>

          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {SLOT_KEYS.map(n => {
              const pos = circlePixelPositions[n];
              return pos && <circle key={`c-${n}`} cx={pos.x} cy={pos.y} r={14} fill={antColors[n].hex} fillOpacity={0.5} stroke={antColors[n].hex} strokeWidth={2} />;
            })}
            {SLOT_KEYS.map(n => {
              const p = arrowPoints[n];
              return p && <g key={`a-${n}`}><line x1={p.sx} y1={p.sy} x2={p.ex} y2={p.ey} stroke={antColors[n].hex} strokeWidth="3" /><polygon points={`${p.ex},${p.ey} ${p.ax1},${p.ay1} ${p.ax2},${p.ay2}`} fill={antColors[n].hex} /></g>;
            })}
          </svg>
        </div>

        <div className="bg-gray-800 border-t border-gray-700 pt-5 pb-4 px-2 flex flex-col space-y-3">
          <div className="flex items-stretch space-x-2">
            <div className="flex flex-col flex-1 space-y-2">
              <div className="flex items-center"><label className="text-sm text-gray-300 w-20">위도</label><input className="bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1 font-mono" value={displayLocation?.lat.toFixed(6) || ""} readOnly /></div>
              <div className="flex items-center"><label className="text-sm text-gray-300 w-20">경도</label><input className="bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1 font-mono" value={displayLocation?.lng.toFixed(6) || ""} readOnly /></div>
            </div>
            <button onClick={handleCopyToClipboard} disabled={!slots[1]} className="bg-emerald-600 text-white rounded-md w-[60px] flex flex-col items-center justify-center disabled:opacity-50">복사</button>
          </div>
          <div className="flex items-center"><label className="text-sm text-gray-300 w-20">지번주소</label><input className="bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1" value={displayLocation?.address || ""} readOnly /></div>
          <div className="flex items-center"><label className="text-sm text-gray-300 w-20">상세위치</label><input className="bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1" value={subAddress} onChange={e => setSubAddress(e.target.value)} /></div>
          <div className="flex items-start"><label className="text-sm text-gray-300 w-20 mt-2">세부내역</label><textarea className="bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1 resize-none" rows={2} value={detail} onChange={e => setDetail(e.target.value)} /></div>
          <div className="mt-3 text-center border-t border-gray-700 pt-3 text-sm text-gray-300">금일 조회: <span className="text-emerald-400">{usageCount}</span> / {USAGE_LIMIT}</div>
        </div>
      </div>
      <ToastNotification message={toast?.message || ""} type={toast?.type || "success"} isVisible={!!toast} />
    </AppLayout>
  );
}