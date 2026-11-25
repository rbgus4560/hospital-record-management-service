/**
 * 1. 목적
 *    등록 환자를 확인하고 관리할 수 있게 한다.
 *
 * 2. 입력
 *    환자 목록과 등록·수정·삭제를 요청하는 동작을 받는다.
 *
 * 3. 주요 기능
 *    환자 정보를 목록으로 표시하고 선택한 관리 동작을 상위 화면에 전달한다.
 */
import './PatientManagementPage.css'

export default function PatientManagementPage({
  patients,
  patientId,
  notice,
  openPatientForm,
  deletePatient,
}) {
  return (
    <section className="panel page-panel">
      <div className="panel-header">
        <h1>환자 관리</h1>
        <button className="upload-button" onClick={(event) => openPatientForm(null, event)}>
          + 환자 등록
        </button>
      </div>

      {notice && (
        <p className="management-notice" role="status">
          {notice}
        </p>
      )}

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
                        >
                          정보 수정
                        </button>
                        <button className="danger-button" onClick={() => deletePatient(patient)}>
                          정보 삭제
                        </button>
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
  )
}
