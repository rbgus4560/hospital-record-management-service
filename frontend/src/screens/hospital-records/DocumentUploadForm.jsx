/**
 * 1. 목적
 *    환자에게 연결할 병원 문서의 등록 입력을 받는다.
 *
 * 2. 입력
 *    문서 종류·날짜·병원 이름과 사용자가 고른 사진을 받는다.
 *
 * 3. 주요 기능
 *    사진 미리보기와 입력 상태를 보여 주고 등록 및 OCR 추출을 요청한다.
 */
import ModalDialog from '../../shared-components/ModalDialog'

export default function DocumentUploadForm({
  documentForm,
  setDocumentForm,
  documentTypes,
  selectedPatient,
  saveDocument,
  closeModal,
  photoInput,
  selectPhoto,
  readingPhoto,
  ocrBusy,
  formError,
}) {
  return (
    <ModalDialog title="문서 등록" onClose={closeModal}>
      <form className="management-form" onSubmit={saveDocument}>
        <p className="page-description">
          {selectedPatient?.name} 환자의 문서를 등록합니다. 사진을 분석한 뒤 기본 정보와 일정을
          확인하고 수정할 수 있습니다.
        </p>

        <label>
          문서 종류
          <select
            value={documentForm.type}
            onChange={(event) => setDocumentForm({ ...documentForm, type: event.target.value })}
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
            onChange={(event) => setDocumentForm({ ...documentForm, date: event.target.value })}
          />
        </label>

        <label>
          병원 또는 약국명 (선택)
          <input
            maxLength={100}
            value={documentForm.hospital}
            onChange={(event) => setDocumentForm({ ...documentForm, hospital: event.target.value })}
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

        {formError && (
          <p className="error-message" role="alert">
            {formError}
          </p>
        )}

        <div className="management-form-actions">
          <button type="button" className="secondary-button" onClick={closeModal}>
            취소
          </button>
          <button className="upload-button" type="submit" disabled={readingPhoto || ocrBusy}>
            {ocrBusy ? 'OCR 추출 중…' : '등록하고 OCR 추출'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}
