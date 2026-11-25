/**
 * 1. 목적
 *    영수증과 청구 묶음의 다운로드 이름을 일관되게 정한다.
 *
 * 2. 입력
 *    환자 이름, 문서 정보, 확장자 또는 사용자가 입력한 이름을 받는다.
 *
 * 3. 주요 기능
 *    기본 파일명을 만들고 파일명에 사용할 수 없는 문자를 정리한다.
 */
// Windows 파일명 금지 문자와 끝의 공백/마침표를 제거한다.
function safePart(value, fallback) {
  const text = Array.from(String(value || '').trim(), (char) =>
    char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char,
  )
    .join('')
    .replace(/[. ]+$/g, '')
    .slice(0, 60)
  return text || fallback
}

export function receiptFilename(patientName, item, index) {
  const parts = [
    safePart(patientName, '환자'),
    safePart(item.date, '날짜미확인'),
    safePart(item.hospital, '병원미확인'),
    safePart(item.type, '영수증'),
  ]
  if (index !== undefined) parts.unshift(String(index + 1).padStart(2, '0'))
  return `${parts.join('_')}.pdf`
}

export function bundleFilename(patientName, items, extension) {
  if (items.length === 1 && extension === 'pdf') return receiptFilename(patientName, items[0])
  const dates = items
    .map((item) => item.date)
    .filter(Boolean)
    .sort()
  const range = dates.length
    ? dates[0] === dates.at(-1)
      ? dates[0]
      : `${dates[0]}~${dates.at(-1)}`
    : '날짜미확인'
  const hospitals = new Set(items.map((item) => item.hospital).filter(Boolean))
  const hospital = hospitals.size === 1 ? [...hospitals][0] : '여러병원'
  return `${safePart(patientName, '환자')}_${range}_${safePart(hospital, '병원미확인')}_영수증${items.length}건.${extension}`
}

export function customDownloadFilename(value, extension, fallback) {
  const base = String(value || '')
    .trim()
    .replace(/\.(pdf|zip)$/i, '')
  return base ? `${safePart(base, '영수증')}.${extension}` : fallback
}
