import { useRef, useState } from 'react'
import InsuranceClaims from './InsuranceClaims'
import './App.css'
import './Management.css'
import OcrImageViewer from './OcrImageViewer'

const menus = [
  { id: 'home', name: '홈' },
  { id: 'patients', name: '환자 관리' },
  { id: 'schedule', name: '일정 관리' },
  { id: 'records', name: '병원 기록' },
  { id: 'claims', name: '보험 청구 준비' },
]

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

const documentTypes = [
  '진료비 계산서·영수증',
  '약제비 계산서·영수증',
  '처방전',
]

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

function Modal({ title, children, onClose }) {
  const dialog = useRef(null)

  return (
    <div
      className="management-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialog}
        className="management-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-modal-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()

          if (event.key === 'Tab') {
            const elements = Array.from(
              dialog.current.querySelectorAll(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
              ),
            )
            const first = elements[0]
            const last = elements[elements.length - 1]

            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <div className="panel-header">
          <h2 id="management-modal-title">{title}</h2>
          <button className="secondary-button" onClick={onClose} autoFocus>
            닫기
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function DocumentList({ items, onPreview, onDelete }) {
  if (!items.length) {
    return <p className="empty-message">등록된 문서가 없습니다.</p>
  }

  return items.map((item) => (
    <article className="document-item" key={item.id}>
      <span className="document-icon" aria-hidden="true">▤</span>

      <button
        className="document-open"
        onClick={() => onPreview(item)}
      >
        <strong>{item.type}</strong>
        <span>{item.hospital} · {item.date ? item.date.replaceAll('-', '.') : '날짜 확인 필요'} · {item.confirmed ? '확인 완료' : '확인 필요'}</span>
      </button>

      {onDelete && (
        <button
          className="danger-button"
          onClick={() => onDelete(item)}
        >
          삭제
        </button>
      )}
    </article>
  ))
}

function AppointmentList({ items, onOpen }) {
  if (!items.length) return <p className="empty-message">등록된 일정이 없습니다.</p>
  return items.map((item) => (
    <article className="schedule-item" key={item.id}>
      <div className="date-badge"><span>{Number(item.date.slice(5,7))}월</span>
        <strong>{Number(item.date.slice(8,10))}</strong></div>
      <div className="item-details">
        <span className={`type-label ${item.type === '검사' ? 'exam' : 'visit'}`}>{item.type}</span>
        <h3>{item.title}</h3>
        <p>{item.time || '시간 미기재'} · {item.hospital}</p>
        <p>{item.type === '검사' ? item.location || '장소 미기재' : item.doctor || '의사 미기재'}</p>
        <button className="text-button" onClick={() => onOpen(item)}>원본·일정 수정</button>
      </div>
    </article>
  ))
}

export default function App() {
  const [activeMenu, setActiveMenu] = useState('home')
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [documents, setDocuments] = useState([])

  // 사용자가 확인한 일정만 홈에 표시합니다.
  const [appointments, setAppointments] = useState([])

  const [month, setMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState('')

  const [patientForm, setPatientForm] = useState(null)
  const [documentForm, setDocumentForm] = useState(null)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [readingPhoto, setReadingPhoto] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [review, setReview] = useState(null)

  const photoInput = useRef(null)
  const modalTrigger = useRef(null)
  const photoRequest = useRef(0)

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7)
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`

  const selectedPatient = patients.find((item) => item.id === patientId)

  const patientDocuments = documents
    .filter((item) => item.patientId === patientId)
    .sort((a, b) => b.createdAt - a.createdAt)

  const patientAppointments = appointments.filter(
    (item) => item.patientId === patientId,
  ).sort((a,b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))

  const shownAppointments = patientAppointments.filter(
    (item) =>
      item.date.startsWith(monthPrefix) &&
      (!selectedDate || item.date === selectedDate),
  )

  const receipts = patientDocuments.filter(
    (item) => item.type !== '처방전',
  )

  function changeMenu(id) {
    setActiveMenu(id)
    setNotice('')
  }

  function closeModal() {
    if (ocrBusy) return
    setReview(null)
    photoRequest.current += 1
    setReadingPhoto(false)
    setPatientForm(null)
    setDocumentForm(null)
    setFormError('')

    requestAnimationFrame(() => modalTrigger.current?.focus())
  }

  function openPatientForm(patient, event) {
    modalTrigger.current = event.currentTarget
    setFormError('')
    setPatientForm(
      patient
        ? { ...patient }
        : { id: '', name: '', label: '', memo: '' },
    )
  }

  function savePatient(event) {
    event.preventDefault()
    const name = patientForm.name.trim()

    if (!name) {
      setFormError('환자 이름을 입력해주세요.')
      return
    }

    const value = {
      ...patientForm,
      name,
      label: patientForm.label.trim(),
      memo: patientForm.memo.trim(),
    }

    if (value.id) {
      setPatients((previous) =>
        previous.map((item) => item.id === value.id ? value : item),
      )
    } else {
      value.id = crypto.randomUUID()
      setPatients((previous) => [...previous, value])
      if (!patientId) setPatientId(value.id)
    }

    closeModal()
    setNotice('환자 정보를 저장했습니다.')
  }

  function deletePatient(patient) {
    const hasRecords =
      documents.some((item) => item.patientId === patient.id) ||
      appointments.some((item) => item.patientId === patient.id)

    if (hasRecords) {
      setNotice('문서 또는 일정이 연결된 환자는 삭제할 수 없습니다.')
      return
    }

    if (!window.confirm(`${patient.name} 환자를 삭제할까요?`)) return

    const remaining = patients.filter((item) => item.id !== patient.id)
    setPatients(remaining)

    if (patientId === patient.id) {
      setPatientId(remaining[0]?.id || '')
      setSelectedDate('')
    }

    setNotice('환자를 삭제했습니다.')
  }

  function openDocumentForm(event) {
    if (!selectedPatient) {
      changeMenu('patients')
      setNotice('문서를 등록할 환자를 먼저 등록해주세요.')
      return
    }

    modalTrigger.current = event.currentTarget
    setFormError('')
    setDocumentForm({
      patientId,
      type: documentTypes[0],
      date: '',
      hospital: '서울대학교병원',
      url: '',
      filename: '',
    })
  }

  async function selectPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const requestId = ++photoRequest.current
    setFormError('')
    setReadingPhoto(true)

    try {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error('JPG 또는 PNG 사진을 선택해주세요.')
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('10MB 이하의 사진을 선택해주세요.')
      }

      const url = await readPhoto(file)
      if (requestId !== photoRequest.current) return

      setDocumentForm((previous) =>
        previous ? { ...previous, url, filename: file.name } : previous,
      )
    } catch (error) {
      if (requestId === photoRequest.current) setFormError(error.message)
    } finally {
      if (requestId === photoRequest.current) setReadingPhoto(false)
    }
  }

  async function saveDocument(event) {
    event.preventDefault()

    if (ocrBusy || readingPhoto) return

    if (
      !documentForm.url
    ) {
      setFormError('사진을 선택해주세요.')
      return
    }

    if (!/^data:image\/(jpeg|png);base64,/.test(documentForm.url)) {
      setFormError('OCR 테스트는 JPG 또는 PNG 사진으로 진행해주세요.')
      return
    }

    setOcrBusy(true)
    setFormError('')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: documentForm.url,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'OCR 요청에 실패했습니다.',
        )
      }

      const item = {
        ...documentForm,
        id: crypto.randomUUID(),
        hospital: documentForm.hospital.trim(),
        createdAt: Date.now(),
        parsedReceipt: result,
        confirmed: false,
        ocrText: result.text,
        ocrFields: result.fields,
        ocrRawResponse: result.raw_response,
        ocrDebugSaved: result.debug_saved,
        ocrDebugFilename: result.debug_filename,
      }

      setDocuments((previous) => [...previous, item])
      setDocumentForm(null)
      setReview(makeReview(item))

      setNotice(
        'OCR 텍스트를 추출했습니다. 현재는 React 임시 저장이며 DB에는 저장되지 않습니다.',
      )
    } catch (error) {
      setFormError(
        error instanceof TypeError
          ? '백엔드 연결을 확인해주세요. 서버 실행 상태와 React 주소의 CORS 설정을 확인하세요.'
          : error.message,
      )
    } finally {
      setOcrBusy(false)
    }
  }

  function deleteDocument(item) {
    if (!window.confirm('문서를 삭제할까요? 보험 청구 준비 목록에서도 제거됩니다.')) {
      return
    }

    setDocuments((previous) => previous.filter((value) => value.id !== item.id))
    setAppointments((previous) => previous.filter((value) => value.documentId !== item.id))
  }

  function openPreview(item, event) {
    modalTrigger.current = event?.currentTarget || document.activeElement
    setFormError('')
    setReview(makeReview(item))
  }

  function makeReview(item) {
    const parsed = item.parsedReceipt || {}
    const info = parsed.document_info || {}
    const visitDate = info.visit_datetime?.value?.match(/\d{4}-\d{2}-\d{2}/)?.[0]
    return {
      document: item,
      hospital: item.confirmed ? item.hospital : (info.hospital_name?.value || item.hospital || ''),
      date: item.confirmed ? item.date : (visitDate || item.date || ''),
      schedules: item.confirmed
        ? appointments.filter((a) => a.documentId === item.id).map((a) => ({ ...a, include: true }))
        : (parsed.schedule_candidates || []).map((a) => ({
          ...a, id: crypto.randomUUID(), include: true,
          time: a.time || '', department: a.department || '', doctor: a.doctor || '',
          examination: a.examination || '', location: a.location || '',
        })),
    }
  }

  function updateReviewSchedule(id, key, value) {
    setReview((previous) => ({ ...previous, schedules: previous.schedules.map(
      (item) => item.id === id ? { ...item, [key]: value } : item,
    ) }))
  }

  async function reparseDocument() {
    if (!review.document.ocrRawResponse || ocrBusy) return
    setOcrBusy(true)
    setFormError('')
    try {
      const response = await fetch('http://127.0.0.1:8000/api/ocr/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_response: review.document.ocrRawResponse }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '분석에 실패했습니다.')
      const item = { ...review.document, parsedReceipt: result }
      setDocuments((previous) => previous.map((d) => d.id === item.id ? item : d))
      setReview((previous) => ({ ...previous, document: item, schedules: (result.schedule_candidates || []).map(
        (a) => ({ ...a, id: crypto.randomUUID(), include: true, time: a.time || '',
          department: a.department || '', doctor: a.doctor || '', examination: a.examination || '', location: a.location || '' }),
      ) }))
    } catch (error) {
      setFormError(error.message)
    } finally { setOcrBusy(false) }
  }

  function confirmReview(event) {
    event.preventDefault()
    if (ocrBusy) return
    const schedules = review.schedules.filter((a) => a.include)
    if (!review.date || !review.hospital.trim() || schedules.some(
      (a) => !a.date || !(a.type === '검사' ? a.examination.trim() : a.department.trim()),
    )) {
      setFormError('문서 날짜·병원명과 포함할 일정의 날짜·진료과 또는 검사명을 확인해주세요.')
      return
    }
    const item = { ...review.document, date: review.date, hospital: review.hospital.trim(), confirmed: true }
    const saved = schedules.map((a) => ({ ...a, patientId: item.patientId, documentId: item.id,
      hospital: item.hospital, title: a.type === '검사' ? a.examination.trim() : a.department.trim(), needs_review: false }))
    setDocuments((previous) => previous.map((d) => d.id === item.id ? item : d))
    setAppointments((previous) => [...previous.filter((a) => a.documentId !== item.id), ...saved])
    const first = [...saved].sort((a,b) => a.date.localeCompare(b.date))[0]
    if (first) {
      const [y,m] = first.date.split('-').map(Number)
      setMonth(new Date(y,m-1,1))
    }
    setPatientId(item.patientId)
    setSelectedDate('')
    closeModal()
    setActiveMenu('home')
    setNotice(`${saved.length}건의 일정을 홈에 반영했습니다. 새로고침하면 임시 데이터가 사라집니다.`)
  }

  const modalOpen = Boolean(patientForm || documentForm || review)

  return (
    <>
      <div className="app-layout" inert={modalOpen ? true : undefined}>
        <aside className="sidebar">
          <div className="brand">
            <span aria-hidden="true">▣</span>
            병원 기록
          </div>

          <div className="patient-selector">
            <label htmlFor="patient-select">환자 선택</label>
            <select
              id="patient-select"
              value={patientId}
              disabled={!patients.length}
              onChange={(event) => {
                setPatientId(event.target.value)
                setSelectedDate('')
                setNotice('')
              }}
            >
              {!patients.length && (
                <option value="">등록된 환자 없음</option>
              )}
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}{patient.label ? ` (${patient.label})` : ''}
                </option>
              ))}
            </select>
          </div>

          <nav className="sidebar-nav" aria-label="주 메뉴">
            {menus.map((menu) => (
              <button
                key={menu.id}
                className={`nav-item ${activeMenu === menu.id ? 'active' : ''}`}
                onClick={() => changeMenu(menu.id)}
                aria-current={activeMenu === menu.id ? 'page' : undefined}
              >
                {menu.name}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          {activeMenu === 'home' && (
            <div className="dashboard-grid">
              <section className="panel calendar-panel">
                <div className="panel-header">
                  <div className="month-navigation">
                    <button
                      aria-label="이전 달"
                      onClick={() => {
                        setMonth(new Date(year, monthIndex - 1, 1))
                        setSelectedDate('')
                      }}
                    >‹</button>
                    <h2>{year}년 {monthIndex + 1}월</h2>
                    <button
                      aria-label="다음 달"
                      onClick={() => {
                        setMonth(new Date(year, monthIndex + 1, 1))
                        setSelectedDate('')
                      }}
                    >›</button>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      const today = new Date()
                      setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                      setSelectedDate('')
                    }}
                  >
                    오늘
                  </button>
                </div>

                <div className="home-status" role="status">{notice || (selectedPatient ? `${selectedPatient.name} 환자의 확인된 일정` : '환자를 등록하고 문서를 올려주세요.')}</div>
                <div className="calendar-legend">
                  <span><i className="legend-dot visit-dot" />진료</span>
                  <span><i className="legend-dot exam-dot" />검사</span>
                </div>

                <div
                  className="calendar-grid"
                  style={{
                    gridTemplateRows: `34px repeat(${weekCount}, minmax(0, 1fr))`,
                  }}
                >
                  {weekdays.map((day, index) => (
                    <div
                      key={day}
                      className={`weekday ${index === 0 ? 'sunday' : ''} ${index === 6 ? 'saturday' : ''}`}
                    >{day}</div>
                  ))}

                  {Array.from({ length: weekCount * 7 }, (_, index) => {
                    const day = index - firstWeekday + 1
                    if (day < 1 || day > daysInMonth) {
                      return <div key={index} className="calendar-empty" />
                    }

                    const key = dateKey(year, monthIndex, day)
                    const items = patientAppointments.filter(
                      (item) => item.date === key,
                    )

                    return (
                      <button
                        key={key}
                        className={`calendar-day ${selectedDate === key ? 'selected' : ''}`}
                        onClick={() =>
                          setSelectedDate((previous) => previous === key ? '' : key)
                        }
                        aria-label={`${monthIndex + 1}월 ${day}일`}
                        aria-pressed={selectedDate === key}
                      >
                        <span className="day-number">{day}</span>
                        {items.slice(0, 2).map((item) => (
                          <span
                            key={item.id}
                            className={`calendar-event ${item.type === '검사' ? 'exam' : 'visit'}`}
                          >
                            <span className="event-full">{item.time || ''} {item.title}</span>
                            <span className="event-short">{item.type} {item.time || ''}</span>
                          </span>
                        ))}
                        {items.length > 2 && (
                          <span className="more-events">+{items.length - 2}건</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="panel schedule-panel">
                <div className="panel-header">
                  <div>
                    <h2>{selectedDate ? '선택한 날짜의 일정' : '이번 달 일정'}</h2>
                    <p className="panel-caption">{shownAppointments.length}건</p>
                  </div>
                  {selectedDate && (
                    <button
                      className="text-button"
                      onClick={() => setSelectedDate('')}
                    >전체 보기</button>
                  )}
                </div>
                <div className="panel-body">
                  <AppointmentList items={shownAppointments} onOpen={(item) => openPreview(documents.find((d) => d.id === item.documentId))} />
                </div>
              </section>

              <section className="panel documents-panel">
                <div className="panel-header documents-header">
                  <h2>최근 등록한 문서</h2>
                  <button
                    className="upload-button"
                    onClick={() => changeMenu('records')}
                  >문서 사진 올리기</button>
                </div>
                <div className="panel-body">
                  <DocumentList
                    items={patientDocuments.slice(0, 3)}
                    onPreview={openPreview}
                  />
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'patients' && (
            <section className="panel page-panel">
              <div className="panel-header">
                <h1>환자 관리</h1>
                <button
                  className="upload-button"
                  onClick={(event) => openPatientForm(null, event)}
                >+ 환자 등록</button>
              </div>

              {notice && <p className="management-notice" role="status">{notice}</p>}

              <div className="panel-body">
                <div className="panel-header">
                  <h2>환자 목록</h2>
                  <span className="panel-caption">총 {patients.length}명</span>
                </div>

                {!patients.length ? (
                  <div className="management-empty">
                    <h3>등록된 환자가 없습니다.</h3>
                    <p>환자를 등록하면 문서와 일정을 환자별로 관리할 수 있습니다.</p>
                  </div>
                ) : (
                  <div className="patient-table-wrap">
                    <table className="patient-table">
                      <thead>
                        <tr>
                          <th>환자 이름</th>
                          <th>구분 이름</th>
                          <th>메모</th>
                          <th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((patient) => (
                          <tr key={patient.id}>
                            <td>
                              <strong>{patient.name}</strong>
                              {patient.id === patientId && (
                                <span className="selected-patient-badge">선택 중</span>
                              )}
                            </td>
                            <td>{patient.label || '—'}</td>
                            <td>{patient.memo || '—'}</td>
                            <td>
                              <div className="patient-actions">
                                <button
                                  className="secondary-button"
                                  onClick={(event) => openPatientForm(patient, event)}
                                >정보 수정</button>
                                <button
                                  className="danger-button"
                                  onClick={() => deletePatient(patient)}
                                >삭제</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeMenu === 'schedule' && (
            <section className="panel page-panel">
              <div className="panel-header"><h1>일정 관리</h1></div>
              <div className="panel-body">
                <AppointmentList items={patientAppointments} onOpen={(item) => openPreview(documents.find((d) => d.id === item.documentId))} />
                <p className="page-description">
                  문서의 OCR 결과를 확인하고 저장하면 일정이 표시됩니다.
                </p>
              </div>
            </section>
          )}

          {activeMenu === 'records' && (
            <section className="panel page-panel">
              <div className="panel-header">
                <h1>병원 기록</h1>
                <button
                  className="upload-button"
                  onClick={openDocumentForm}
                >문서 등록</button>
              </div>

              {notice && <p className="management-notice" role="status">{notice}</p>}

              <div className="panel-body">
                {!selectedPatient ? (
                  <div className="management-empty">
                    <h3>환자를 먼저 등록해주세요.</h3>
                    <button
                      className="upload-button"
                      onClick={() => changeMenu('patients')}
                    >환자 관리로 이동</button>
                  </div>
                ) : (
                  <DocumentList
                    items={patientDocuments}
                    onPreview={openPreview}
                    onDelete={deleteDocument}
                  />
                )}
              </div>
            </section>
          )}

          {activeMenu === 'claims' && (
            <InsuranceClaims
              key={patientId || 'no-patient'}
              receipts={receipts}
              patientName={selectedPatient?.name || ''}
              onPreview={openPreview}
              onGoRecords={() => changeMenu('records')}
            />
          )}
        </main>
      </div>

      {patientForm && (
        <Modal
          title={patientForm.id ? '환자 정보 수정' : '환자 등록'}
          onClose={closeModal}
        >
          <form className="management-form" onSubmit={savePatient}>
            <label>
              환자 이름 *
              <input
                value={patientForm.name}
                maxLength={50}
                required
                onChange={(event) =>
                  setPatientForm({ ...patientForm, name: event.target.value })
                }
              />
            </label>
            <label>
              구분 이름
              <input
                placeholder="예: 본인, 동생"
                maxLength={30}
                value={patientForm.label}
                onChange={(event) =>
                  setPatientForm({ ...patientForm, label: event.target.value })
                }
              />
            </label>
            <label>
              메모
              <textarea
                rows={3}
                maxLength={500}
                value={patientForm.memo}
                onChange={(event) =>
                  setPatientForm({ ...patientForm, memo: event.target.value })
                }
              />
            </label>
            {formError && <p className="error-message" role="alert">{formError}</p>}
            <div className="management-form-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                취소
              </button>
              <button className="upload-button" type="submit">
                {patientForm.id ? '저장' : '등록'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {documentForm && (
        <Modal title="문서 등록" onClose={closeModal}>
          <form className="management-form" onSubmit={saveDocument}>
            <p className="page-description">
              {selectedPatient?.name} 환자의 문서를 등록합니다.
              사진을 분석한 뒤 기본 정보와 일정을 확인하고 수정할 수 있습니다.
            </p>

            <label>
              문서 종류
              <select
                value={documentForm.type}
                onChange={(event) =>
                  setDocumentForm({ ...documentForm, type: event.target.value })
                }
              >
                {documentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              진료일 또는 조제일 (선택)
              <input
                type="date"
                value={documentForm.date}
                onChange={(event) =>
                  setDocumentForm({ ...documentForm, date: event.target.value })
                }
              />
            </label>

            <label>
              병원 또는 약국명 (선택)
              <input
                maxLength={100}
                value={documentForm.hospital}
                onChange={(event) =>
                  setDocumentForm({ ...documentForm, hospital: event.target.value })
                }
              />
            </label>

            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={selectPhoto}
            />

            <button
              type="button"
              className="secondary-button"
              disabled={readingPhoto || ocrBusy}
              onClick={() => photoInput.current.click()}
            >
              {readingPhoto ? '사진 읽는 중…' : '사진 선택'}
            </button>

            {documentForm.url && (
              <div className="registration-photo">
                <p>{documentForm.filename}</p>
                <img src={documentForm.url} alt="등록할 문서 미리보기" />
              </div>
            )}

            {formError && <p className="error-message" role="alert">{formError}</p>}

            <div className="management-form-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                취소
              </button>
              <button
                className="upload-button"
                type="submit"
                disabled={readingPhoto || ocrBusy}
              >
                {ocrBusy ? 'OCR 추출 중…' : '등록하고 OCR 추출'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {review && (
        <Modal title="OCR 결과 확인·수정" onClose={closeModal}>
          <p className="page-description">원본과 비교한 뒤 포함할 일정을 선택해 주세요. 저장은 현재 화면에서만 유지됩니다.</p>
          <OcrImageViewer key={review.document.id} imageUrl={review.document.url}
            fields={review.document.ocrFields || []} alt="확인할 영수증 원본" />
          <form className="management-form ocr-review-form" onSubmit={confirmReview}>
            <fieldset disabled={ocrBusy} className="review-fieldset">
              <div className="review-input-grid">
                <label>문서 날짜 *<input type="date" required value={review.date}
                  onChange={(e) => setReview({ ...review, date: e.target.value })} /></label>
                <label>병원명 *<input required maxLength={100} value={review.hospital}
                  onChange={(e) => setReview({ ...review, hospital: e.target.value })} /></label>
              </div>
              <h3>추출한 일정 {review.schedules.length}건</h3>
              {!review.schedules.length && <p className="empty-message">일정 후보가 없습니다. 아래 분석 버튼으로 저장된 OCR 결과를 분석할 수 있습니다.</p>}
              {review.schedules.map((item) => (
                <section className="review-schedule" key={item.id}>
                  <label className="review-check"><input type="checkbox" checked={item.include}
                    onChange={(e) => updateReviewSchedule(item.id, 'include', e.target.checked)} />
                    {item.type} 일정에 포함</label>
                  <div className="review-input-grid">
                    <label>날짜<input type="date" required={item.include} disabled={!item.include} value={item.date || ''}
                      onChange={(e) => updateReviewSchedule(item.id, 'date', e.target.value)} /></label>
                    <label>시간 (미기재 시 비워두기)<input type="time" disabled={!item.include} value={item.time}
                      onChange={(e) => updateReviewSchedule(item.id, 'time', e.target.value)} /></label>
                    {(item.type === '검사' ? [['examination', '검사명'], ['location', '장소']]
                      : [['department', '진료과'], ['doctor', '의사']]).map(([key,label]) => (
                      <label key={key}>{label}<input disabled={!item.include} value={item[key] || ''}
                        required={item.include && ['examination','department'].includes(key)}
                        onChange={(e) => updateReviewSchedule(item.id, key, e.target.value)} /></label>
                    ))}
                  </div>
                  {(item.warnings || []).map((warning,index) => <p className="review-warning" key={index}>{warning}</p>)}
                </section>
              ))}
              {review.document.ocrRawResponse && <button type="button" className="secondary-button" onClick={reparseDocument}>
                저장된 OCR 결과 다시 분석</button>}
              <p className="panel-caption">다시 분석하면 현재 수정 중인 일정 후보를 새 추출 결과로 교체합니다. CLOVA를 재호출하지 않습니다.</p>
              <details className="review-json"><summary>전체 OCR 텍스트 보기</summary>
                <pre>{review.document.ocrText || '인식된 텍스트가 없습니다.'}</pre></details>
              <details className="review-json"><summary>네 영역의 추출 결과 보기</summary>
                <pre>{JSON.stringify(review.document.parsedReceipt || {}, null, 2)}</pre></details>
              {formError && <p className="error-message" role="alert">{formError}</p>}
              <div className="management-form-actions">
                <button type="button" className="secondary-button" onClick={closeModal}>나중에 확인</button>
                <button type="submit" className="upload-button">확인하고 홈에 반영</button>
              </div>
            </fieldset>
            {ocrBusy && <p role="status">분석 중…</p>}
          </form>
        </Modal>
      )}


    </>
  )
}