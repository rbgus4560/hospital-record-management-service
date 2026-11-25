/**
 * 1. 목적
 *    문서와 확정 일정의 목록 표시를 여러 화면에서 공유한다.
 *
 * 2. 입력
 *    표시할 문서·일정과 문서 선택 및 미리보기 동작을 받는다.
 *
 * 3. 주요 기능
 *    문서 목록과 일정 목록을 표시하고 문서 조작은 상위 화면에 전달한다.
 */
export function DocumentList({ items, onPreview, selectedId, onSelect }) {
  if (!items.length) {
    return <p className="empty-message">등록된 문서가 없습니다.</p>
  }

  return items.map((item) => (
    <article className="document-item" key={item.id}>
      {onSelect && (
        <input
          type="radio"
          name="document-to-delete"
          checked={selectedId === item.id}
          onChange={() => onSelect(item.id)}
          aria-label={`${item.hospital} ${item.date || '날짜 미확인'} ${item.type} 삭제 대상으로 선택`}
        />
      )}
      <span className="document-icon" aria-hidden="true">
        ▤
      </span>

      <button className="document-open" onClick={() => onPreview(item)}>
        <strong>{item.type}</strong>
        <span>
          {item.hospital} · {item.date ? item.date.replaceAll('-', '.') : '날짜 확인 필요'} ·{' '}
          {item.confirmed ? '확인 완료' : '확인 필요'}
        </span>
      </button>
    </article>
  ))
}

/** 홈에서는 일정 정보만 표시한다. */
export function AppointmentList({ items }) {
  if (!items.length) return <p className="empty-message">등록된 일정이 없습니다.</p>
  return items.map((item) => (
    <article className="schedule-item" key={item.id}>
      <div className="date-badge">
        <span>{Number(item.date.slice(5, 7))}월</span>
        <strong>{Number(item.date.slice(8, 10))}</strong>
      </div>
      <div className="schedule-time">
        <span>{item.date.slice(0, 4)}년</span>
        <strong>{item.time || '시간 미기재'}</strong>
      </div>
      <div className="item-details">
        <span className={`type-label ${item.type === '검사' ? 'exam' : 'visit'}`}>{item.type}</span>
        <h3>{item.title}</h3>
        <p>
          {item.type === '검사'
            ? item.location || '장소 미기재'
            : item.doctor
              ? `담당의 ${item.doctor}`
              : '담당의 미기재'}
        </p>
        {item.hospital && <p>{item.hospital}</p>}
      </div>
    </article>
  ))
}
