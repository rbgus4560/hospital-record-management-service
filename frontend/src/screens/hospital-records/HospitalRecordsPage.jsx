import { useState } from 'react'
import { DocumentList } from '../../shared-components/DocumentAndAppointmentLists'
import './HospitalRecordsPage.css'

export default function HospitalRecordsPage({
  notice,
  patients,
  patientId,
  onPatientChange,
  selectedPatient,
  patientDocuments,
  selectedDocumentId,
  setSelectedDocumentId,
  openDocumentForm,
  deleteDocument,
  openPreview,
  changeMenu,
}) {
  const [query, setQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const keyword = query.trim().toLocaleLowerCase()
  const invalidRange = Boolean(startDate && endDate && startDate > endDate)
  const filteredDocuments = patientDocuments.filter((item) => {
    const text = [item.hospital, item.type, item.filename, item.date]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return (
      !invalidRange &&
      text.includes(keyword) &&
      (!startDate || (item.date && item.date >= startDate)) &&
      (!endDate || (item.date && item.date <= endDate))
    )
  })
  const selectedDocument = filteredDocuments.find((item) => item.id === selectedDocumentId)
  const hasFilters = Boolean(query || startDate || endDate)
  function resetFilters() {
    setQuery('')
    setStartDate('')
    setEndDate('')
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header record-page-header">
        <h1>병원 기록</h1>
        <div className="record-filters">
          <input
            type="search"
            aria-label="문서 검색"
            placeholder="병원, 문서명, 파일명 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="record-date-filter" role="group" aria-label="문서 날짜 범위">
            <input
              type="date"
              aria-label="문서 시작일"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              aria-label="문서 종료일"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <select
            aria-label="병원 기록 환자 선택"
            value={patientId}
            disabled={!patients.length}
            onChange={(event) => onPatientChange(event.target.value)}
          >
            {!patients.length && <option value="">등록된 환자 없음</option>}
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
                {patient.label ? ` (${patient.label})` : ''}
              </option>
            ))}
          </select>
          <button className="secondary-button" disabled={!hasFilters} onClick={resetFilters}>
            초기화
          </button>
        </div>
        <div className="record-header-actions">
          <button className="upload-button" onClick={openDocumentForm}>
            문서 등록
          </button>
          <button
            className="record-delete-button"
            disabled={!selectedDocument}
            onClick={() => {
              if (selectedDocument) deleteDocument(selectedDocument)
            }}
          >
            문서 삭제
          </button>
        </div>
      </div>

      {notice && (
        <p className="management-notice" role="status">
          {notice}
        </p>
      )}

      <div className="record-filter-summary" aria-live="polite">
        <span>
          문서 <strong>{filteredDocuments.length}</strong>건
          {hasFilters && ` / 전체 ${patientDocuments.length}건`}
        </span>
        {invalidRange && <span role="alert">종료일은 시작일 이후로 선택해 주세요.</span>}
      </div>
      <div className="panel-body">
        {!selectedPatient ? (
          <div className="management-empty">
            <h3>환자를 먼저 등록해주세요.</h3>
            <button className="upload-button" onClick={() => changeMenu('patients')}>
              환자 관리로 이동
            </button>
          </div>
        ) : patientDocuments.length && !filteredDocuments.length ? (
          <div className="management-empty">
            <h3>조건에 맞는 문서가 없습니다.</h3>
            <p>검색어와 문서 날짜를 확인해 주세요.</p>
            <button className="secondary-button" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        ) : (
          <DocumentList
            items={filteredDocuments}
            onPreview={openPreview}
            selectedId={selectedDocumentId}
            onSelect={setSelectedDocumentId}
          />
        )}
      </div>
    </section>
  )
}
