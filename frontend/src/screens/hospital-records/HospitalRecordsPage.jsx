import { DocumentList } from '../../shared-components/DocumentAndAppointmentLists'
import './HospitalRecordsPage.css'

export default function HospitalRecordsPage({
  notice,
  selectedPatient,
  patientDocuments,
  selectedDocumentId,
  setSelectedDocumentId,
  openDocumentForm,
  deleteDocument,
  openPreview,
  changeMenu,
}) {
  return (
    <section className="panel page-panel">
      <div className="panel-header">
        <h1>병원 기록</h1>
        <div className="record-header-actions">
          <button className="upload-button" onClick={openDocumentForm}>
            문서 등록
          </button>
          <button
            className="record-delete-button"
            disabled={!patientDocuments.some((item) => item.id === selectedDocumentId)}
            onClick={() => {
              const item = patientDocuments.find((document) => document.id === selectedDocumentId)
              if (item) deleteDocument(item)
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

      <div className="panel-body">
        {!selectedPatient ? (
          <div className="management-empty">
            <h3>환자를 먼저 등록해주세요.</h3>
            <button className="upload-button" onClick={() => changeMenu('patients')}>
              환자 관리로 이동
            </button>
          </div>
        ) : (
          <DocumentList
            items={patientDocuments}
            onPreview={openPreview}
            selectedId={selectedDocumentId}
            onSelect={setSelectedDocumentId}
          />
        )}
      </div>
    </section>
  )
}
