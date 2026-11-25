/**
 * 1. 목적
 *    MediLog 메뉴와 환자별 작업 흐름을 연결한다.
 *
 * 2. 입력
 *    서버에서 받은 환자·문서·일정과 사용자의 메뉴 선택 및 폼 입력을 받는다.
 *
 * 3. 주요 기능
 *    화면 전환, 기록 등록, OCR 검수와 일정 확정 상태를 관리한다.
 */
import NavigationIcon from './shared-components/NavigationIcon'
import { useEffect, useRef, useState } from 'react'
import { api, documentPayload, appointmentPayload } from './api/hospitalRecordsApi'
import InsuranceClaimsPage from './screens/insurance-claims/InsuranceClaimsPage'
import HomeCalendarPage from './screens/home-calendar/HomeCalendarPage'
import PatientManagementPage from './screens/patient-management/PatientManagementPage'
import PatientRegistrationForm from './screens/patient-management/PatientRegistrationForm'
import AppointmentManagementPage from './screens/appointment-management/AppointmentManagementPage'
import HospitalRecordsPage from './screens/hospital-records/HospitalRecordsPage'
import DocumentUploadForm from './screens/hospital-records/DocumentUploadForm'
import DemoReceiptForm from './screens/hospital-records/DemoReceiptForm'
import { createDemoReceiptImage } from './screens/hospital-records/demoReceiptImage'
import OcrReviewDialog from './screens/hospital-records/OcrReviewDialog'
import './shared-styles/appLayout.css'
import './shared-styles/managementForms.css'

const menus = [
  { id: 'home', name: '홈' },
  { id: 'patients', name: '환자 관리' },
  { id: 'schedule', name: '진료·검사' },
  { id: 'records', name: '병원 기록' },
  { id: 'claims', name: '보험 청구 준비' },
]

const documentTypes = ['진료비 계산서·영수증', '약제비 계산서·영수증', '처방전']

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

export default function HospitalRecordsApp() {
  const [activeMenu, setActiveMenu] = useState('home')
  const [dbLoading, setDbLoading] = useState(true)
  const [dbError, setDbError] = useState('')
  const [dbSaving, setDbSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const mutationLock = useRef(false)
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [documents, setDocuments] = useState([])
  const [selectedDocumentId, setSelectedDocumentId] = useState('')

  // 사용자가 확인한 일정만 홈에 표시합니다.
  const [appointments, setAppointments] = useState([])

  const [month, setMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState('')

  const [patientForm, setPatientForm] = useState(null)
  const [documentForm, setDocumentForm] = useState(null)
  const [demoName, setDemoName] = useState(null)
  const [demoImage, setDemoImage] = useState('')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [readingPhoto, setReadingPhoto] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [review, setReview] = useState(null)

  const photoInput = useRef(null)
  const modalTrigger = useRef(null)
  const photoRequest = useRef(0)

  useEffect(() => {
    let cancelled = false
    api('/api/state')
      .then((state) => {
        if (cancelled) return
        setPatients(state.patients)
        setDocuments(state.documents)
        setAppointments(state.appointments)
        setPatientId((current) =>
          state.patients.some((p) => p.id === current) ? current : state.patients[0]?.id || '',
        )
        setDbError('')
        setDbLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setDbError(error.message)
        setDbLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // DB 결과를 확인하기 전에는 화면 상태를 바꾸지 않는다.
  async function mutate(operation, reportError = setFormError) {
    if (mutationLock.current) return
    mutationLock.current = true
    setDbSaving(true)
    try {
      await operation()
    } catch (error) {
      reportError(error.message)
    } finally {
      mutationLock.current = false
      setDbSaving(false)
    }
  }

  const selectedPatient = patients.find((item) => item.id === patientId)

  const patientDocuments = documents
    .filter((item) => item.patientId === patientId)
    .sort((a, b) => b.createdAt - a.createdAt)

  const patientAppointments = appointments
    .filter((item) => item.patientId === patientId)
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))

  const receipts = patientDocuments.filter((item) => item.type !== '처방전')

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
    setDemoName(null)
    setDemoImage('')
    setDocumentForm(null)
    setFormError('')

    requestAnimationFrame(() => modalTrigger.current?.focus())
  }

  function openPatientForm(patient, event) {
    modalTrigger.current = event.currentTarget
    setFormError('')
    setPatientForm(patient ? { ...patient } : { id: '', name: '', label: '', memo: '' })
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

    void mutate(async () => {
      const saved = await api(value.id ? `/api/patients/${value.id}` : '/api/patients', {
        method: value.id ? 'PUT' : 'POST',
        body: value,
      })
      setPatients((previous) =>
        value.id
          ? previous.map((item) => (item.id === saved.id ? saved : item))
          : [...previous, saved],
      )
      if (!patientId) setPatientId(saved.id)
      closeModal()
      setNotice('환자 정보를 DB에 저장했습니다.')
    })
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

    void mutate(async () => {
      await api(`/api/patients/${patient.id}`, { method: 'DELETE' })
      const remaining = patients.filter((item) => item.id !== patient.id)
      setPatients(remaining)
      if (patientId === patient.id) {
        setPatientId(remaining[0]?.id || '')
        setSelectedDate('')
      }
      setNotice('환자를 삭제했습니다.')
    }, setNotice)
  }

  function openDemoReceipt(event) {
    modalTrigger.current = event.currentTarget
    setFormError('')
    setDemoName('')
  }

  async function previewDemoReceipt(event) {
    event.preventDefault()
    const name = demoName.trim()
    if (!name || readingPhoto) return
    const request = ++photoRequest.current
    setFormError('')
    setReadingPhoto(true)
    try {
      const url = await createDemoReceiptImage(name)
      if (request !== photoRequest.current) return
      setDemoImage(url)
    } catch {
      if (request === photoRequest.current) setFormError('샘플 영수증을 만들지 못했습니다.')
    } finally {
      if (request === photoRequest.current) setReadingPhoto(false)
    }
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

    if (!documentForm.url) {
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
      const result = await api('/api/ocr', {
        method: 'POST',
        body: { image_data: documentForm.url },
      })

      const item = {
        ...documentForm,
        id: crypto.randomUUID(),
        hospital: documentForm.hospital.trim(),
        parsedReceipt: result,
        confirmed: false,
        ocrText: result.text,
        ocrFields: result.fields,
        ocrRawResponse: result.raw_response,
        ocrDebugSaved: result.debug_saved,
        ocrDebugFilename: result.debug_filename,
      }

      const stored = await api('/api/documents', {
        method: 'POST',
        body: { document: documentPayload(item) },
      })
      setDocuments((previous) => [...previous, stored])
      setDocumentForm(null)
      setReview(makeReview(stored))

      setNotice('OCR 원본과 추출 결과를 DB에 저장했습니다. 내용을 확인하고 일정을 확정해주세요.')
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

    void mutate(async () => {
      await api(`/api/documents/${item.id}`, { method: 'DELETE' })
      setDocuments((previous) => previous.filter((value) => value.id !== item.id))
      setAppointments((previous) => previous.filter((value) => value.documentId !== item.id))
      setNotice('문서와 연결된 일정을 삭제했습니다.')
    }, setNotice)
  }

  function openPreview(item, event) {
    modalTrigger.current = event?.currentTarget || document.activeElement
    setFormError('')
    setReview(makeReview(item))
  }

  // 미확정 문서는 파서 후보로, 확정 문서는 DB 일정으로 검수 화면을 구성한다.
  function makeReview(item) {
    const parsed = item.parsedReceipt || {}
    const info = parsed.document_info || {}
    const visitDate = info.visit_datetime?.value?.match(/\d{4}-\d{2}-\d{2}/)?.[0]
    return {
      document: item,
      hospital: item.confirmed ? item.hospital : info.hospital_name?.value || item.hospital || '',
      date: item.confirmed ? item.date : visitDate || item.date || '',
      schedules: item.confirmed
        ? appointments.filter((a) => a.documentId === item.id).map((a) => ({ ...a, include: true }))
        : (parsed.schedule_candidates || []).map((a) => ({
            ...a,
            id: crypto.randomUUID(),
            include: true,
            time: a.time || '',
            department: a.department || '',
            doctor: a.doctor || '',
            examination: a.examination || '',
            location: a.location || '',
          })),
    }
  }

  function updateReviewSchedule(id, key, value) {
    setReview((previous) => ({
      ...previous,
      schedules: previous.schedules.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }))
  }

  // 외부 OCR을 재호출하지 않고 보존한 응답을 재분석한다.
  async function reparseDocument() {
    if (!review.document.ocrRawResponse || ocrBusy) return
    setOcrBusy(true)
    setFormError('')
    try {
      const result = await api('/api/ocr/parse', {
        method: 'POST',
        body: { raw_response: review.document.ocrRawResponse },
      })
      const updated = { ...review.document, parsedReceipt: result }
      const stored = await api(`/api/documents/${updated.id}`, {
        method: 'PUT',
        body: { document: documentPayload(updated) },
      })
      const item = stored.document
      setDocuments((previous) => previous.map((d) => (d.id === item.id ? item : d)))
      setReview((previous) => ({
        ...previous,
        document: item,
        schedules: (result.schedule_candidates || []).map((a) => ({
          ...a,
          id: crypto.randomUUID(),
          include: true,
          time: a.time || '',
          department: a.department || '',
          doctor: a.doctor || '',
          examination: a.examination || '',
          location: a.location || '',
        })),
      }))
    } catch (error) {
      setFormError(error.message)
    } finally {
      setOcrBusy(false)
    }
  }

  // 문서와 일정이 서버에서 함께 저장된 뒤 화면 상태를 반영한다.
  function confirmReview(event) {
    event.preventDefault()
    if (ocrBusy) return
    const schedules = review.schedules.filter((a) => a.include)
    if (
      !review.date ||
      !review.hospital.trim() ||
      schedules.some(
        (a) => !a.date || !(a.type === '검사' ? a.examination.trim() : a.department.trim()),
      )
    ) {
      setFormError('문서 날짜·병원명과 포함할 일정의 날짜·진료과 또는 검사명을 확인해주세요.')
      return
    }
    const item = {
      ...review.document,
      date: review.date,
      hospital: review.hospital.trim(),
      confirmed: true,
    }
    const saved = schedules.map((a) => ({
      ...a,
      patientId: item.patientId,
      documentId: item.id,
      hospital: item.hospital,
      title: a.type === '검사' ? a.examination.trim() : a.department.trim(),
      needs_review: false,
    }))
    void mutate(async () => {
      const stored = await api(`/api/documents/${item.id}`, {
        method: 'PUT',
        body: {
          document: documentPayload(item),
          appointments: saved.map(appointmentPayload),
        },
      })
      setDocuments((previous) => previous.map((d) => (d.id === item.id ? stored.document : d)))
      setAppointments((previous) => [
        ...previous.filter((a) => a.documentId !== item.id),
        ...stored.appointments,
      ])
      const first = [...stored.appointments].sort((a, b) => a.date.localeCompare(b.date))[0]
      if (first) {
        const [y, m] = first.date.split('-').map(Number)
        setMonth(new Date(y, m - 1, 1))
      }
      setPatientId(item.patientId)
      setSelectedDate('')
      closeModal()
      setActiveMenu('home')
      setNotice(`${stored.appointments.length}건의 일정을 DB에 저장했습니다.`)
    })
  }

  function setAppointmentCompleted(appointment, completed) {
    void mutate(async () => {
      const stored = await api(`/api/appointments/${appointment.id}/completion`, {
        method: 'PUT',
        body: { completed },
      })
      setAppointments((previous) =>
        previous.map((item) => (item.id === appointment.id ? stored.appointment : item)),
      )
      setDocuments((previous) =>
        previous.map((item) => (item.id === stored.document.id ? stored.document : item)),
      )
    }, setNotice)
  }

  const modalOpen = Boolean(patientForm || demoName !== null || documentForm || review)

  return (
    <>
      {(dbLoading || dbError || dbSaving) && (
        <div className="connection-notice" role={dbError ? 'alert' : 'status'}>
          {dbLoading ? 'DB에서 기록을 불러오는 중…' : dbError || '저장 중…'}
          {dbError && (
            <button
              onClick={() => {
                setDbLoading(true)
                setDbError('')
                setReloadKey((value) => value + 1)
              }}
            >
              다시 연결
            </button>
          )}
        </div>
      )}
      <fieldset
        disabled={dbLoading || dbSaving || Boolean(dbError)}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="app-layout" inert={modalOpen ? true : undefined}>
          <aside className="sidebar">
            <div className="brand">
              <NavigationIcon name="hospital" className="brand-icon" />
              MediLog
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
                {!patients.length && <option value="">등록된 환자 없음</option>}
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                    {patient.label ? ` (${patient.label})` : ''}
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
                  <NavigationIcon name={menu.id} />
                  <span>{menu.name}</span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="secondary-button demo-receipt-button"
              onClick={openDemoReceipt}
            >
              체험용 영수증 만들기
            </button>
          </aside>

          <main className="main-content">
            {activeMenu === 'home' && (
              <HomeCalendarPage
                month={month}
                setMonth={setMonth}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                notice={notice}
                selectedPatient={selectedPatient}
                patientAppointments={patientAppointments}
                patientDocuments={patientDocuments}
                openPreview={openPreview}
                changeMenu={changeMenu}
              />
            )}

            {activeMenu === 'patients' && (
              <PatientManagementPage
                patients={patients}
                patientId={patientId}
                notice={notice}
                openPatientForm={openPatientForm}
                deletePatient={deletePatient}
              />
            )}

            {activeMenu === 'schedule' && (
              <AppointmentManagementPage
                key={patientId}
                onCompletedChange={setAppointmentCompleted}
                saving={dbSaving}
                notice={notice}
                patientAppointments={patientAppointments}
                documents={documents}
                openPreview={openPreview}
              />
            )}

            {activeMenu === 'records' && (
              <HospitalRecordsPage
                key={patientId}
                patients={patients}
                patientId={patientId}
                onPatientChange={(id) => {
                  setPatientId(id)
                  setSelectedDocumentId('')
                }}
                notice={notice}
                selectedPatient={selectedPatient}
                patientDocuments={patientDocuments}
                selectedDocumentId={selectedDocumentId}
                setSelectedDocumentId={setSelectedDocumentId}
                openDocumentForm={openDocumentForm}
                deleteDocument={deleteDocument}
                openPreview={openPreview}
                changeMenu={changeMenu}
              />
            )}

            {activeMenu === 'claims' && (
              <InsuranceClaimsPage
                key={patientId || 'no-patient'}
                patientId={patientId}
                receipts={receipts}
                patientName={selectedPatient?.name || ''}
                onPreview={openPreview}
                onGoRecords={() => changeMenu('records')}
              />
            )}
          </main>
        </div>

        {patientForm && (
          <PatientRegistrationForm
            patientForm={patientForm}
            setPatientForm={setPatientForm}
            savePatient={savePatient}
            closeModal={closeModal}
            formError={formError}
          />
        )}

        {demoName !== null && (
          <DemoReceiptForm
            name={demoName}
            image={demoImage}
            setName={setDemoName}
            preview={previewDemoReceipt}
            busy={readingPhoto}
            error={formError}
            closeModal={closeModal}
          />
        )}

        {documentForm && (
          <DocumentUploadForm
            documentForm={documentForm}
            setDocumentForm={setDocumentForm}
            documentTypes={documentTypes}
            selectedPatient={selectedPatient}
            saveDocument={saveDocument}
            closeModal={closeModal}
            photoInput={photoInput}
            selectPhoto={selectPhoto}
            readingPhoto={readingPhoto}
            ocrBusy={ocrBusy}
            formError={formError}
          />
        )}

        {review && (
          <OcrReviewDialog
            review={review}
            setReview={setReview}
            closeModal={closeModal}
            confirmReview={confirmReview}
            ocrBusy={ocrBusy}
            updateReviewSchedule={updateReviewSchedule}
            reparseDocument={reparseDocument}
            formError={formError}
          />
        )}
      </fieldset>
    </>
  )
}
