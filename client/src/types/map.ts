/** 지도/주소 관련 공통 타입 */

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  /** 도로명주소 (API에서 별도 반환 시) */
  roadAddress?: string;
  /** 지번주소 (API에서 별도 반환 시) */
  jibunAddress?: string;
}

export interface ToastData {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
}

/** ANT 방향 정보 - 픽셀 좌표 기반 (기존 Etc 화살표) */
export interface AntInfo {
  angle: number;
  points: {
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    ax1: number;
    ay1: number;
    ax2: number;
    ay2: number;
  };
}

/** A# 슬롯 한 개의 위치 + 방향 (Renew용) */
export interface SlotData {
  lat: number;
  lng: number;
  /** 지번주소 */
  address?: string;
  /** 도로명주소 */
  roadAddress?: string;
  /** 지번 (jibunAddress API 필드) */
  jibunAddress?: string;
  /** 방향 정보. 위치 재지정 시 초기화됨 */
  direction?: AntInfo | null;
}
