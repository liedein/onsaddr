/**
 * 클립보드 복사 유틸
 * navigator.clipboard.writeText 사용, TypeScript 타입 및 에러 핸들링 포함
 */

/**
 * 텍스트를 클립보드에 복사합니다.
 * @param text - 복사할 문자열
 * @returns 성공 시 true, 실패 시 false (에러 시 false 반환으로 호출부에서 알림 가능)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
