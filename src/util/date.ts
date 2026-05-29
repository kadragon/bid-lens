/** UTC 시각 → KST(UTC+9) 기준 YYYY-MM-DD 문자열 (D1 저장 포맷과 동일). 한국은 DST 없음 → 고정 +9h 안전. */
export function kstDateIso(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
