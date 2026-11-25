/**
 * 1. 목적
 *    여러 화면이 같은 방식으로 FastAPI를 호출하게 한다.
 *
 * 2. 입력
 *    API 주소, 요청 경로와 전송할 데이터 또는 저장할 문서·일정을 받는다.
 *
 * 3. 주요 기능
 *    요청과 응답을 JSON으로 다루고 오류 메시지를 정리한다. 빈 날짜·시간은 저장용 null로 변환한다.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export function apiUrl(path) {
  return `${API_BASE}${path}`
}

export async function api(path, options = {}) {
  let response
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('백엔드에 연결할 수 없습니다. 서버 실행 상태와 접속 주소를 확인해주세요.')
  }
  if (response.status === 204) return null
  const result = await response.json()
  if (!response.ok) {
    throw new Error(
      typeof result.detail === 'string' ? result.detail : '입력한 데이터의 형식을 확인해주세요.',
    )
  }
  return result
}

export function documentPayload(document) {
  return { ...document, date: document.date || null }
}

export function appointmentPayload(appointment) {
  return { ...appointment, time: appointment.time || null }
}
