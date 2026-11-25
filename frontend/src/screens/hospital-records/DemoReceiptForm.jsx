/**
 * 1. 목적
 *    체험에 사용할 가상 환자의 이름을 받는다.
 *
 * 2. 입력
 *    체험 환자 이름과 생성된 영수증 이미지, 미리보기·닫기 동작을 받는다.
 *
 * 3. 주요 기능
 *    이름 입력과 영수증 미리보기를 보여 주고 PNG 다운로드를 제공한다.
 */
import ModalDialog from '../../shared-components/ModalDialog'

export default function DemoReceiptForm({
  name,
  image,
  setName,
  preview,
  busy,
  error,
  closeModal,
}) {
  if (image) {
    return (
      <ModalDialog
        title="체험용 영수증 미리보기"
        onClose={closeModal}
        className="demo-preview-modal"
      >
        <div className="management-form">
          <div className="demo-preview-image">
            <img src={image} alt="체험용 영수증 미리보기" />
          </div>
          <div className="management-form-actions">
            <button type="button" className="secondary-button" onClick={closeModal}>
              닫기
            </button>
            <a
              className="upload-button demo-download"
              href={image}
              download="MediLog-체험용-영수증.png"
            >
              PNG 내려받기
            </a>
          </div>
        </div>
      </ModalDialog>
    )
  }

  return (
    <ModalDialog title="체험용 영수증 만들기" onClose={closeModal}>
      <form className="management-form" onSubmit={preview}>
        <label>
          환자 이름
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 체험환자"
            maxLength={50}
            disabled={busy}
            required
          />
        </label>
        <p className="page-description">실명 대신 별명을 입력해도 됩니다.</p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="management-form-actions">
          <button type="button" className="secondary-button" onClick={closeModal} disabled={busy}>
            취소
          </button>
          <button className="upload-button" type="submit" disabled={busy || !name.trim()}>
            {busy ? '미리보기 만드는 중…' : '영수증 미리보기'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}
