/**
 * 경쟁사 동향 조회 페이지 (기존 Home 화면)
 * 라우트: /etc
 */
import { useState, useEffect, useRef } from "react";
import KakaoMap from "@/components/KakaoMap";
import ToastNotification from "@/components/ToastNotification";
import { useGeolocation } from "@/hooks/useGeolocation";
import { RefreshCw } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import type { LocationData, ToastData, AntInfo } from "@/types/map";

const telcoOptions = ["KT", "LGU", "KT+LGU"];
const generationOptions = ["5G", "LTE", "5G+LTE"];
const targetOptions = ["도로", "교차로", "건물", "철도", "등산로", "해상로", "기타"];

export default function Etc() {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [telco, setTelco] = useState("");
  const [generation, setGeneration] = useState("");
  const [target, setTarget] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [subAddress, setSubAddress] = useState("");
  const [detail, setDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const [mode, setMode] = useState<"MAP" | "ANT">("MAP");
  const [selectedAnt, setSelectedAnt] = useState<number | null>(null);
  const [antData, setAntData] = useState<Record<number, AntInfo | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapCompRef = useRef<import("@/components/KakaoMap").KakaoMapRef>(null);

  const [usageCount, setUsageCount] = useState(0);
  const USAGE_LIMIT = 100;

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

  const { currentLocation, isLoadingLocation } = useGeolocation();

  useEffect(() => {
    if (!selectedLocation && currentLocation) {
      setSelectedLocation(currentLocation);
    }
  }, [currentLocation, selectedLocation]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => setToast(null), 2000);
  };

  const handleModeToggle = () => {
    if (mode === "MAP") {
      if (!mapCompRef.current?.isMarkerAtCenter()) {
        showToast("Pin이 지도 중심에 있지 않습니다. 핀을 중앙에 놓아주세요.", "error");
        return;
      }
      setMode("ANT");
    } else {
      setMode("MAP");
    }
  };

  const handleLocationSelect = async (location: LocationData) => {
    if (mode === "ANT") return;
    if (usageCount >= USAGE_LIMIT) {
      showToast("오늘 조회 한도(100회)에 도달했습니다.", "error");
      return;
    }

    setSelectedLocation({
      lat: location.lat,
      lng: location.lng,
      address: "주소를 불러오는 중...",
    });

    try {
      setIsLoading(true);
      const response = await fetch("/api/coordinate-to-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: location.lat, lng: location.lng }),
      });
      if (!response.ok) throw new Error("주소 변환 실패");
      const data = await response.json();
      setSelectedLocation({
        lat: location.lat,
        lng: location.lng,
        address: data.address,
      });
      incrementUsage();
    } catch {
      showToast("주소를 가져오는데 실패했습니다.", "error");
      setSelectedLocation((prev) =>
        prev ? { ...prev, address: "" } : null
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapAreaClick = (e: React.MouseEvent) => {
    if (mode !== "ANT" || !selectedAnt || !mapContainerRef.current) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const angleRad = Math.atan2(py - cy, px - cx);
    let deg = Math.round(angleRad * (180 / Math.PI) + 90);
    if (deg < 0) deg += 360;
    if (deg >= 360) deg -= 360;

    const offset = 25;
    const length = 80;
    const sx = cx + Math.cos(angleRad) * offset;
    const sy = cy + Math.sin(angleRad) * offset;
    const ex = cx + Math.cos(angleRad) * length;
    const ey = cy + Math.sin(angleRad) * length;

    const headLen = 12;
    const ax1 = ex - headLen * Math.cos(angleRad - Math.PI / 6);
    const ay1 = ey - headLen * Math.sin(angleRad - Math.PI / 6);
    const ax2 = ex - headLen * Math.cos(angleRad + Math.PI / 6);
    const ay2 = ey - headLen * Math.sin(angleRad + Math.PI / 6);

    setAntData((prev) => ({
      ...prev,
      [selectedAnt]: {
        angle: deg,
        points: { sx, sy, ex, ey, ax1, ay1, ax2, ay2 },
      },
    }));
  };

  const handleCopyToClipboard = async () => {
    const finalTarget = target === "기타" ? customTarget : target;

    if (
      !selectedLocation?.address ||
      !telco ||
      !generation ||
      !finalTarget ||
      !subAddress
    ) {
      showToast("모든 값을 선택해주세요.", "error");
      return;
    }

    let copyText =
      `통신사: ${telco}\n` +
      `세대: ${generation}\n` +
      `서비스 타겟: ${finalTarget}\n` +
      `위도: ${selectedLocation.lat.toFixed(6)}\n` +
      `경도: ${selectedLocation.lng.toFixed(6)}\n` +
      `지번주소: ${selectedLocation.address}\n` +
      `상세위치: ${subAddress}\n` +
      `세부내역: ${detail}`;

    const antEntries = Object.entries(antData)
      .filter(([, data]) => data !== null)
      .map(([key, data]) => `ANT${key}: ${data!.angle}`);

    if (antEntries.length > 0) {
      copyText += `\n${antEntries.join("\n")}`;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      showToast("클립보드에 복사되었습니다!", "success");
    } catch {
      showToast("복사에 실패했습니다.", "error");
    }
  };

  const handleRefresh = () => window.location.reload();

  const antColors: Record<
    number,
    { hex: string; bg: string; active: string }
  > = {
    1: { hex: "#f43f5e", bg: "bg-rose-500", active: "bg-rose-700" },
    2: { hex: "#10b981", bg: "bg-emerald-500", active: "bg-emerald-700" },
    3: { hex: "#0ea5e9", bg: "bg-sky-500", active: "bg-sky-700" },
    4: { hex: "#8b5cf6", bg: "bg-violet-500", active: "bg-violet-700" },
  };

  const rightSlot = (
    <button
      onClick={handleRefresh}
      className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-lg transition-colors"
    >
      <RefreshCw className="w-6 h-6" />
    </button>
  );

  return (
    <AppLayout title="경쟁사 동향 조회" rightSlot={rightSlot}>
      <div className="flex-1 flex flex-col relative">
        <div
          ref={mapContainerRef}
          className="relative overflow-hidden"
          style={{ height: "38vh", minHeight: "270px" }}
          onClick={handleMapAreaClick}
        >
          <KakaoMap
            ref={mapCompRef}
            initialLocation={currentLocation}
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            isLoading={isLoading || isLoadingLocation}
            mode={mode}
          />

          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {Object.entries(antData).map(([key, data]) => {
              if (!data) return null;
              const color = antColors[Number(key) as keyof typeof antColors].hex;
              return (
                <g key={key}>
                  <line
                    x1={data.points.sx}
                    y1={data.points.sy}
                    x2={data.points.ex}
                    y2={data.points.ey}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${data.points.ex},${data.points.ey} ${data.points.ax1},${data.points.ay1} ${data.points.ax2},${data.points.ay2}`}
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>

          {mode === "ANT" && (
            <div className="absolute bottom-4 right-4 flex space-x-2 z-20">
              {[1, 2, 3, 4].map((num) => {
                const config = antColors[num];
                const isSelected = selectedAnt === num;
                const hasValue = antData[num] !== null;

                let buttonStyle = "";
                if (isSelected) {
                  buttonStyle = `${config.active} border-white scale-110 shadow-xl z-30 opacity-100`;
                } else if (hasValue) {
                  buttonStyle = `${config.bg} border-transparent opacity-100 shadow-md`;
                } else {
                  buttonStyle = `${config.bg} border-transparent opacity-70`;
                }

                return (
                  <button
                    key={num}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnt(num);
                    }}
                    className={`w-12 h-10 rounded text-white font-bold transition-all duration-200 active:scale-90 border-2 ${buttonStyle}`}
                  >
                    {antData[num]?.angle ?? `A${num}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-gray-800 border-t border-gray-700 pt-5 pb-4 px-2 flex flex-col space-y-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={handleModeToggle}
              className={`w-16 h-[42px] shrink-0 rounded-md font-bold text-sm transition-all duration-200 active:scale-95 shadow-md ${
                mode === "MAP"
                  ? "bg-blue-600 text-white"
                  : "bg-orange-600 text-white"
              }`}
            >
              {mode}
            </button>
            <select
              className="bg-gray-100 text-gray-900 text-base px-1 py-2 rounded-md flex-[0.9] min-w-0"
              value={telco}
              onChange={(e) => setTelco(e.target.value)}
            >
              <option value="">통신사</option>
              {telcoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              className="bg-gray-100 text-gray-900 text-base px-1 py-2 rounded-md flex-[0.8] min-w-0"
              value={generation}
              onChange={(e) => setGeneration(e.target.value)}
            >
              <option value="">세대</option>
              {generationOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              className="bg-gray-100 text-gray-900 text-base px-1 py-2 rounded-md flex-[1.3] min-w-0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">서비스 타겟</option>
              {targetOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {target === "기타" && (
            <input
              type="text"
              className="bg-gray-100 text-gray-900 text-base px-3 py-2 rounded-md"
              value={customTarget}
              onChange={(e) => setCustomTarget(e.target.value)}
              placeholder="서비스 타겟 직접 입력"
            />
          )}

          <div className="flex items-stretch space-x-2">
            <div className="flex flex-col flex-1 space-y-2">
              <div className="flex items-center">
                <label className="text-sm text-gray-300 w-16 shrink-0">
                  위도
                </label>
                <input
                  className="text-base font-mono bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
                  value={
                    selectedLocation
                      ? selectedLocation.lat.toFixed(6)
                      : ""
                  }
                  readOnly
                />
              </div>
              <div className="flex items-center">
                <label className="text-sm text-gray-300 w-16 shrink-0">
                  경도
                </label>
                <input
                  className="text-base font-mono bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
                  value={
                    selectedLocation
                      ? selectedLocation.lng.toFixed(6)
                      : ""
                  }
                  readOnly
                />
              </div>
            </div>
            <button
              onClick={handleCopyToClipboard}
              disabled={
                !selectedLocation?.address ||
                !telco ||
                !generation ||
                !(target === "기타" ? customTarget : target) ||
                !subAddress ||
                isLoading
              }
              className="flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors duration-200 w-[60px] h-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                fontSize: "1.15rem",
                minWidth: "54px",
                minHeight: "86px",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 mb-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                  strokeWidth="2"
                  stroke="currentColor"
                  fill="none"
                />
                <rect
                  x="3"
                  y="3"
                  width="13"
                  height="13"
                  rx="2"
                  strokeWidth="2"
                  stroke="currentColor"
                  fill="none"
                />
              </svg>
              복사
            </button>
          </div>

          <div className="flex items-center mb-1">
            <label className="text-sm text-gray-300 w-16 shrink-0">
              지번주소
            </label>
            <input
              className="text-base bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
              value={selectedLocation?.address ?? ""}
              readOnly
            />
          </div>

          <div className="flex items-center mb-1">
            <label className="text-sm text-gray-300 w-16 shrink-0">
              상세위치
            </label>
            <input
              className="text-base bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1"
              value={subAddress}
              onChange={(e) => setSubAddress(e.target.value)}
              placeholder="건물명, 시설물 위치 등을 입력하세요"
            />
          </div>

          <div className="flex items-start">
            <label className="text-sm text-gray-300 w-16 shrink-0 mt-2">
              세부내역
            </label>
            <textarea
              maxLength={100}
              rows={2}
              className="text-base bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1 resize-none"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="100자 이내로 세부내역을 입력해주세요"
              style={{ minHeight: "3.2em", maxHeight: "4em" }}
            />
          </div>

          <div className="mt-3 text-center pb-0 border-t border-gray-700 pt-3">
            <span className="text-sm text-gray-300">금일 조회 횟수: </span>
            <span className="text-sm text-emerald-400 font-medium">
              {usageCount}
            </span>
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
