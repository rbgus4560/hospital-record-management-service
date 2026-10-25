/** FastAPI 공통 통신 계층. API 주소·JSON 변환·실패 메시지와 DB 입력 형태 변환을 한곳에서 관리한다. */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export async function api(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
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
