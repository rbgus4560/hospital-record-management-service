/**
 * 1. 목적
 *    환자의 기본 정보를 등록하거나 수정할 때 쓰는 폼이다.
 *
 * 2. 입력
 *    신규 입력 또는 기존 환자 정보와 저장 동작을 받는다.
 *
 * 3. 주요 기능
 *    입력 필드를 표시하고 값 변경, 저장 요청과 닫기를 처리한다.
 */
import ModalDialog from '../../shared-components/ModalDialog'

export default function PatientRegistrationForm({
  patientForm,
  setPatientForm,
  savePatient,
  closeModal,
  formError,
}) {
  return (
    <ModalDialog title={patientForm.id ? '환자 정보 수정' : '환자 등록'} onClose={closeModal}>
      <form className="management-form" onSubmit={savePatient}>
        <label>
          환자 이름 *
          <input
            value={patientForm.name}
            maxLength={50}
            required
            onChange={(event) => setPatientForm({ ...patientForm, name: event.target.value })}
          />
        </label>
        <label>
          구분 이름
          <input
            placeholder="예: 본인, 동생"
            maxLength={30}
            value={patientForm.label}
            onChange={(event) => setPatientForm({ ...patientForm, label: event.target.value })}
          />
        </label>
        <label>
          메모
          <textarea
            rows={3}
            maxLength={500}
            value={patientForm.memo}
            onChange={(event) => setPatientForm({ ...patientForm, memo: event.target.value })}
          />
        </label>
        {formError && (
          <p className="error-message" role="alert">
            {formError}
          </p>
        )}
        <div className="management-form-actions">
          <button type="button" className="secondary-button" onClick={closeModal}>
            취소
          </button>
          <button className="upload-button" type="submit">
            {patientForm.id ? '저장' : '등록'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}
