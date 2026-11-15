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
