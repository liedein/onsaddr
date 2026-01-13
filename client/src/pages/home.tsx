import { useState, useEffect } from "react";
import KakaoMap from "@/components/KakaoMap";
import ToastNotification from "@/components/ToastNotification";
import { useGeolocation } from "@/hooks/useGeolocation";
import { RefreshCw } from "lucide-react";

const telcoOptions = ["KT", "LGU", "KT+LGU"];
const targetOptions = ["도로", "교차로", "건물", "철도", "등산로", "해상로", "기타"];

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

export interface ToastData {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
}

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [telco, setTelco] = useState("");
  const [target, setTarget] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [subAddress, setSubAddress] = useState(""); // 추가: 상세위치 수기 입력값
  const [detail, setDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // --- 기기 기반 사용량 상태 관리 ---
  const [usageCount, setUsageCount] = useState(0);
  const USAGE_LIMIT = 100;

  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const savedData = localStorage.getItem("map_usage");

    if (savedData) {
      const { date, count } = JSON.parse(savedData);
      if (date === today) {
        setUsageCount(count);
      } else {
        localStorage.setItem("map_usage", JSON.stringify({ date: today, count: 0 }));
        setUsageCount(0);
      }
    } else {
      localStorage.setItem("map_usage", JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  const incrementUsage = () => {
    const today = new Date().toLocaleDateString();
    setUsageCount(prev => {
      const newCount = prev + 1;
      localStorage.setItem("map_usage", JSON.stringify({ date: today, count: newCount }));
      return newCount;
    });
  };
  // ---------------------------------

  const { currentLocation, isLoading: isLoadingLocation } = useGeolocation();

  useEffect(() => {
    if (!selectedLocation && currentLocation) {
      setSelectedLocation(currentLocation);
    }
  }, [currentLocation, selectedLocation]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => setToast(null), 2000);
  };

  const handleLocationSelect = async (location: LocationData) => {
    if (usageCount >= USAGE_LIMIT) {
      showToast("오늘 조회 한도(100회)에 도달했습니다.", "error");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/coordinate-to-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: location.lat, lng: location.lng }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "주소를 가져오는데 실패했습니다.");
      }

      const data = await response.json();
      setSelectedLocation({
        lat: location.lat,
        lng: location.lng,
        address: data.address,
      });

      incrementUsage(); // 조회 성공 시 카운트 증가
    } catch (error) {
      console.error("주소 변환 오류:", error);
      showToast(error instanceof Error ? error.message : "주소를 가져오는데 실패했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const finalTarget = target === "기타" ? customTarget : target;

    if (!selectedLocation || !selectedLocation.address || !telco || !finalTarget) {
      showToast("모든 값을 선택해주세요.", "error");
      return;
    }

    const copyText =
      `통신사: ${telco}\n` +
      `서비스 타겟: ${finalTarget}\n` +
      `위도: ${selectedLocation.lat.toFixed(6)}\n` +
      `경도: ${selectedLocation.lng.toFixed(6)}\n` +
      `지번주소: ${selectedLocation.address}\n` +
      `상세위치: ${subAddress}\n` + // 복사 시 상세위치 포함
      `세부내역: ${detail}`;

    try {
      await navigator.clipboard.writeText(copyText);
      showToast("클립보드에 복사되었습니다!", "success");
    } catch (error) {
      console.error("복사 실패:", error);
      showToast("복사에 실패했습니다.", "error");
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="flex w-full items-center px-4 py-4">
          <div className="w-12" />
          <h1 className="text-2xl font-bold text-gray-50 flex-grow text-center tracking-wide">
            내 주변 주소 조회
          </h1>
          <div className="w-12 flex justify-end">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-lg transition-colors duration-200"
              title="새로고침"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 flex flex-col relative">
        {/* 지도 영역 */}
        <div className="relative" style={{ height: "38vh", minHeight: "270px" }}>
          <KakaoMap
            initialLocation={currentLocation}
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            isLoading={isLoading || isLoadingLocation}
          />
          {selectedLocation?.address && (
            <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2 max-w-xs shadow-lg">
              <p className="text-sm text-gray-100 font-medium">
                {selectedLocation.address}
              </p>
            </div>
          )}
        </div>

        {/* 입력 폼 영역 */}
        <div className="bg-gray-800 border-t border-gray-700 pt-5 pb-4 px-2 flex flex-col space-y-3">
          <div className="flex items-center space-x-3">
            <select
              className="bg-gray-100 text-gray-900 text-sm px-3 py-2 rounded-md flex-1"
              value={telco}
              onChange={e => setTelco(e.target.value)}
            >
              <option value="">통신사 선택</option>
              {telcoOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              className="bg-gray-100 text-gray-900 text-sm px-3 py-2 rounded-md flex-1"
              value={target}
              onChange={e => setTarget(e.target.value)}
            >
              <option value="">서비스 타겟 선택</option>
              {targetOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {target === "기타" && (
            <input
              type="text"
              className="bg-gray-100 text-gray-900 text-sm px-3 py-2 rounded-md"
              value={customTarget}
              onChange={e => setCustomTarget(e.target.value)}
              placeholder="서비스 타겟을 직접 입력하세요"
            />
          )}

          {/* 위경도 정보 및 복사 버튼 (기본 스타일 유지) */}
          <div className="flex items-stretch space-x-2">
            <div className="flex flex-col flex-1 space-y-2">
              <div className="flex items-center">
                <label className="text-sm text-gray-300 w-16 shrink-0">위도</label>
                <input
                  className="text-base font-mono bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1 min-w-[15rem] w-60"
                  value={selectedLocation ? selectedLocation.lat.toFixed(6) : ""}
                  readOnly
                />
              </div>
              <div className="flex items-center">
                <label className="text-sm text-gray-300 w-16 shrink-0">경도</label>
                <input
                  className="text-base font-mono bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1 min-w-[15rem] w-60"
                  value={selectedLocation ? selectedLocation.lng.toFixed(6) : ""}
                  readOnly
                />
              </div>
            </div>
            <button
              onClick={handleCopyToClipboard}
              aria-label="클립보드 복사"
              disabled={!selectedLocation?.address || !telco || !(target === "기타" ? customTarget : target) || isLoading}
              className="flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors duration-200 w-[60px] h-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                fontSize: "1.15rem",
                minWidth: "54px",
                minHeight: "86px",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" stroke="currentColor" fill="none"/>
                <rect x="3" y="3" width="13" height="13" rx="2" strokeWidth="2" stroke="currentColor" fill="none"/>
              </svg>
              복사
            </button>
          </div>

          <div className="flex items-center mb-1">
            <label className="text-sm text-gray-300 w-16 shrink-0">지번주소</label>
            <input
              className="text-base bg-gray-700 px-3 py-2 rounded-md text-gray-100 flex-1"
              value={selectedLocation?.address || ""}
              readOnly
              placeholder="위치를 선택해주세요"
            />
          </div>

          {/* 새로 추가된 상세위치 입력 필드 */}
          <div className="flex items-center mb-1">
            <label className="text-sm text-gray-300 w-16 shrink-0">상세위치</label>
            <input
              className="text-base bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1"
              value={subAddress}
              onChange={e => setSubAddress(e.target.value)}
              placeholder="건물명, 시설물 위치 등을 입력하세요"
            />
          </div>

          <div className="flex items-start">
            <label className="text-sm text-gray-300 w-16 shrink-0 mt-2">세부내역</label>
            <textarea
              maxLength={100}
              rows={2}
              className="text-base bg-gray-100 text-gray-900 px-3 py-2 rounded-md flex-1 resize-none"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="100자 이내로 세부내역을 입력해주세요"
              style={{ minHeight: "3.2em", maxHeight: "4em" }}
            />
          </div>

          {/* 조회 횟수 표시 영역 */}
          <div className="mt-3 text-center pb-0 border-t border-gray-700 pt-3">
            <span className="text-sm text-gray-300">오늘 기기 조회 횟수: </span>
            <span className="text-sm text-emerald-400 font-medium">{usageCount}</span>
            <span className="text-sm text-gray-300"> / {USAGE_LIMIT}</span>
          </div>
        </div>
      </main>
      <ToastNotification toast={toast} />
    </div>
  );
}