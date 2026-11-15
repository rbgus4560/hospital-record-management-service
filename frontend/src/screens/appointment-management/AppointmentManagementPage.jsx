import { AppointmentList } from '../../shared-components/DocumentAndAppointmentLists'

export default function AppointmentManagementPage({ patientAppointments, documents, openPreview }) {
  return (
    <section className="panel page-panel">
      <div className="panel-header">
        <h1>일정 관리</h1>
      </div>
      <div className="panel-body">
        <AppointmentList
          items={patientAppointments}
          onOpen={(item) => openPreview(documents.find((d) => d.id === item.documentId))}
        />
        <p className="page-description">문서의 OCR 결과를 확인하고 저장하면 일정이 표시됩니다.</p>
      </div>
    </section>
  )
}
