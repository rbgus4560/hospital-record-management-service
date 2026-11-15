import ModalDialog from '../../shared-components/ModalDialog'
import OcrImageViewer from './OcrImageViewer'

export default function OcrReviewDialog({
  review,
  setReview,
  closeModal,
  confirmReview,
  ocrBusy,
  updateReviewSchedule,
  reparseDocument,
  formError,
}) {
  return (
    <ModalDialog title="OCR 결과 확인·수정" onClose={closeModal} className="review-modal">
      <p className="page-description">
        왼쪽 원본과 비교해 오른쪽 내용을 수정하고 포함할 일정을 선택해주세요. 확인한 내용은 DB에
        저장됩니다.
      </p>
      <div className="review-columns">
        <div className="review-original">
          <OcrImageViewer
            key={review.document.id}
            imageUrl={review.document.url}
            fields={review.document.ocrFields || []}
            alt="확인할 영수증 원본"
          />
        </div>
        <form className="management-form ocr-review-form" onSubmit={confirmReview}>
          <fieldset disabled={ocrBusy} className="review-fieldset">
            <div className="review-input-grid">
              <label>
                문서 날짜 *
                <input
                  type="date"
                  required
                  value={review.date}
                  onChange={(e) => setReview({ ...review, date: e.target.value })}
                />
              </label>
              <label>
                병원명 *
                <input
                  required
                  maxLength={100}
                  value={review.hospital}
                  onChange={(e) => setReview({ ...review, hospital: e.target.value })}
                />
              </label>
            </div>
            <h3>추출한 일정 {review.schedules.length}건</h3>
            {!review.schedules.length && (
              <p className="empty-message">
                일정 후보가 없습니다. 아래 분석 버튼으로 저장된 OCR 결과를 분석할 수 있습니다.
              </p>
            )}
            {review.schedules.map((item) => (
              <section className="review-schedule" key={item.id}>
                <label className="review-check">
                  <input
                    type="checkbox"
                    checked={item.include}
                    onChange={(e) => updateReviewSchedule(item.id, 'include', e.target.checked)}
                  />
                  {item.type} 일정에 포함
                </label>
                <div className="review-input-grid">
                  <label>
                    날짜
                    <input
                      type="date"
                      required={item.include}
                      disabled={!item.include}
                      value={item.date || ''}
                      onChange={(e) => updateReviewSchedule(item.id, 'date', e.target.value)}
                    />
                  </label>
                  <label>
                    시간 (미기재 시 비워두기)
                    <input
                      type="time"
                      disabled={!item.include}
                      value={item.time}
                      onChange={(e) => updateReviewSchedule(item.id, 'time', e.target.value)}
                    />
                  </label>
                  {(item.type === '검사'
                    ? [
                        ['examination', '검사명'],
                        ['location', '장소'],
                      ]
                    : [
                        ['department', '진료과'],
                        ['doctor', '의사'],
                      ]
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        disabled={!item.include}
                        value={item[key] || ''}
                        required={item.include && ['examination', 'department'].includes(key)}
                        onChange={(e) => updateReviewSchedule(item.id, key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                {(item.warnings || []).map((warning, index) => (
                  <p className="review-warning" key={index}>
                    {warning}
                  </p>
                ))}
              </section>
            ))}
            {review.document.ocrRawResponse && (
              <button type="button" className="secondary-button" onClick={reparseDocument}>
                저장된 OCR 결과 다시 분석
              </button>
            )}
            <p className="panel-caption">
              다시 분석하면 현재 수정 중인 일정 후보를 새 추출 결과로 교체합니다. CLOVA를 재호출하지
              않습니다.
            </p>
            <details className="review-json">
              <summary>전체 OCR 텍스트 보기</summary>
              <pre>{review.document.ocrText || '인식된 텍스트가 없습니다.'}</pre>
            </details>
            <details className="review-json">
              <summary>네 영역의 추출 결과 보기</summary>
              <pre>{JSON.stringify(review.document.parsedReceipt || {}, null, 2)}</pre>
            </details>
            {formError && (
              <p className="error-message" role="alert">
                {formError}
              </p>
            )}
            <div className="management-form-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                나중에 확인
              </button>
              <button type="submit" className="upload-button">
                확인하고 홈에 반영
              </button>
            </div>
          </fieldset>
          {ocrBusy && <p role="status">분석 중…</p>}
        </form>
      </div>
    </ModalDialog>
  )
}
