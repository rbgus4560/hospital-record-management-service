import { useState } from 'react'
import './AppointmentManagementPage.css'

export default function AppointmentManagementPage({
  patientAppointments,
  documents,
  openPreview,
  onCompletedChange,
  saving,
  notice,
}) {
  const [status, setStatus] = useState('예정')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('전체')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const keyword = query.trim().toLocaleLowerCase()
  const invalidRange = Boolean(startDate && endDate && startDate > endDate)
  const filteredAppointments = patientAppointments
    .filter((item) => {
      const searchableText = [
        item.title,
        item.hospital,
        item.location,
        item.doctor,
        item.date,
        item.time,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
      return (
        !invalidRange &&
        (status === '전체' || Boolean(item.completed) === (status === '완료')) &&
        (type === '전체' || item.type === type) &&
        (!startDate || item.date >= startDate) &&
        (!endDate || item.date <= endDate) &&
        searchableText.includes(keyword)
      )
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99'),
    )

  const hasFilters = Boolean(query || startDate || endDate || type !== '전체' || status !== '예정')
  function resetFilters() {
    setStatus('예정')
    setQuery('')
    setType('전체')
    setStartDate('')
    setEndDate('')
  }

  return (
    <section className="panel page-panel appointment-page">
      <div className="panel-header appointment-header">
        <h1>진료·검사</h1>
        <div className="appointment-filters">
          <label className="appointment-search">
            <span>검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="병원, 진료과, 검사명, 장소 검색"
            />
          </label>
          <fieldset className="appointment-date-filter">
            <legend>날짜 범위</legend>
            <input
              type="date"
              aria-label="시작일"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              aria-label="종료일"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </fieldset>
          <div className="appointment-type-filter" role="group" aria-label="일정 종류">
            {['전체', '진료', '검사'].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="appointment-status-filter">
            <span>상태</span>
            <select
              aria-label="진료·검사 상태"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {['예정', '완료', '전체'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button appointment-reset"
            type="button"
            disabled={!hasFilters}
            onClick={resetFilters}
          >
            초기화
          </button>
        </div>
      </div>
      {notice && (
        <p className="appointment-date-error" role="alert">
          {notice}
        </p>
      )}
      <div className="appointment-results" aria-live="polite">
        <span>
          {status === '완료' ? '진료·검사 이력' : '진료·검사'}{' '}
          <strong>{filteredAppointments.length}</strong>건
          {hasFilters && ` / 전체 ${patientAppointments.length}건`}
        </span>
        {invalidRange && (
          <span className="appointment-date-error" role="alert">
            종료일은 시작일 이후로 선택해 주세요.
          </span>
        )}
      </div>
      <div className="appointment-column-head" aria-hidden="true">
        <span>날짜 · 시간</span>
        <span>진료 · 검사</span>
        <span>병원 · 장소</span>
        <span>관리</span>
      </div>
      <div className="panel-body">
        {!filteredAppointments.length && (
          <div className="appointment-empty">
            <h2>
              {patientAppointments.length
                ? '조건에 맞는 일정이 없습니다.'
                : '등록된 일정이 없습니다.'}
            </h2>
            <p>
              {patientAppointments.length
                ? '검색어, 날짜, 종류 또는 상태를 확인해 주세요.'
                : '영수증의 OCR 결과를 검수하고 확정하면 일정이 표시됩니다.'}
            </p>
            {hasFilters && (
              <button className="secondary-button" onClick={resetFilters}>
                필터 초기화
              </button>
            )}
          </div>
        )}
        {filteredAppointments.map((item) => {
          const document = documents.find((entry) => entry.id === item.documentId)
          return (
            <article className="appointment-row" key={item.id}>
              <div className="appointment-when">
                <div className="date-badge">
                  <span>{Number(item.date.slice(5, 7))}월</span>
                  <strong>{Number(item.date.slice(8, 10))}</strong>
                </div>
                <div>
                  <span className="appointment-year">{item.date.slice(0, 4)}년</span>
                  <p className="appointment-time">{item.time || '시간 미기재'}</p>
                </div>
              </div>
              <div className="appointment-summary">
                <span className={`type-label ${item.type === '검사' ? 'exam' : 'visit'}`}>
                  {item.type}
                </span>
                {item.completed && <span className="appointment-completed-label">완료</span>}
                <h2>{item.title || '일정명 미기재'}</h2>
                {item.doctor && <p>담당의 {item.doctor}</p>}
              </div>
              <div className="appointment-place">
                <strong>{item.hospital || '병원 미기재'}</strong>
                <p>{item.location || '장소 미기재'}</p>
              </div>
              <div className="appointment-action">
                <button
                  className="secondary-button"
                  disabled={!document || saving}
                  onClick={() => openPreview(document)}
                >
                  원본·일정 수정
                </button>
                <button
                  className="secondary-button appointment-complete-button"
                  disabled={saving}
                  onClick={() => onCompletedChange(item, !item.completed)}
                  aria-label={`${item.title} ${item.completed ? '예정으로 되돌리기' : '완료로 표시'}`}
                >
                  {item.completed ? '예정으로' : '완료'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
