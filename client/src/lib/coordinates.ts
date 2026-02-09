/**
 * 위도/경도를 도·분·초(DMS) 문자열로 변환
 * 기존 경쟁사 동향 페이지 로직을 유틸로 분리해 재사용
 */

/**
 * 십진수 도(degree) 값을 도·분·초 형식 문자열로 변환
 * @param decimal - 위도 또는 경도 (십진수)
 * @param isLongitude - 경도 여부 (true면 E/W, false면 N/S 접미사)
 */
export function decimalToDMS(
  decimal: number,
  isLongitude: boolean
): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  const dir = isLongitude
    ? decimal >= 0
      ? "E"
      : "W"
    : decimal >= 0
      ? "N"
      : "S";

  return `${degrees}°${minutes}'${seconds.toFixed(2)}" ${dir}`;
}

/**
 * 위도(lat)를 도분초 문자열로 반환
 */
export function latToDMS(lat: number): string {
  return decimalToDMS(lat, false);
}

/**
 * 경도(lng)를 도분초 문자열로 반환
 */
export function lngToDMS(lng: number): string {
  return decimalToDMS(lng, true);
}
