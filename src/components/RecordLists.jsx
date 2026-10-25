/** 문서와 확정 일정의 표시 컴포넌트. 데이터 변경과 원본 열기는 상위 화면 콜백에 위임한다. */
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

export function AppointmentList({ items, onOpen }) {
  if (!items.length) return <p className="empty-message">등록된 일정이 없습니다.</p>
  return items.map((item) => (
    <article className="schedule-item" key={item.id}>
      <div className="date-badge">
        <span>{Number(item.date.slice(5, 7))}월</span>
        <strong>{Number(item.date.slice(8, 10))}</strong>
      </div>
      <div className="item-details">
        <span className={`type-label ${item.type === '검사' ? 'exam' : 'visit'}`}>{item.type}</span>
        <h3>{item.title}</h3>
        <p>
          {item.time || '시간 미기재'} · {item.hospital}
        </p>
        <p>
          {item.type === '검사' ? item.location || '장소 미기재' : item.doctor || '의사 미기재'}
        </p>
        <button className="text-button" onClick={() => onOpen(item)}>
          원본·일정 수정
        </button>
      </div>
    </article>
  ))
}
