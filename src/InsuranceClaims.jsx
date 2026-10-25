/** 보험 청구용 영수증 선택·미리보기·파일명 편집·PDF/ZIP 생성 흐름을 관리한다. 보험사 전송 기능은 없다. */
import { useState } from 'react'
import { createPdf, downloadBlob } from './lib/pdfExport'
import JSZip from 'jszip'
import './InsuranceClaims.css'
import { receiptFilename, bundleFilename, customDownloadFilename } from './downloadNames'

export default function InsuranceClaims({ receipts, patientName, onPreview, onGoRecords }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [previewId, setPreviewId] = useState(null)
  const [downloadMode, setDownloadMode] = useState('merged')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [customName, setCustomName] = useState(null)

  const selected = receipts.filter((item) => selectedIds.includes(item.id))
  const preview = receipts.find((item) => item.id === previewId)
  const allSelected = receipts.length > 0 && selected.length === receipts.length
  const extension = downloadMode === 'merged' ? 'pdf' : 'zip'
  const suggestedFilename = bundleFilename(patientName, selected, extension)
  const suggestedBase = suggestedFilename.slice(0, -(extension.length + 1))
  const filename =
    customName === null
      ? suggestedFilename
      : customDownloadFilename(customName, extension, suggestedFilename)

  function toggle(id) {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    )
  }

  async function download() {
    if (!selected.length || busy) return
    setBusy(true)
    setMessage('')

    try {
      const sorted = [...selected].sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
      )

      let blob
      if (downloadMode === 'merged') {
        const pdf = await createPdf(sorted)
        blob = pdf.output('blob')
      } else {
        const zip = new JSZip()

        for (let index = 0; index < sorted.length; index += 1) {
          const item = sorted[index]
          const pdf = await createPdf([item])
          zip.file(receiptFilename(patientName, item, index), pdf.output('arraybuffer'))
        }

        blob = await zip.generateAsync({ type: 'blob' })
      }

      downloadBlob(blob, filename)
      setMessage(
        `${filename} 다운로드를 요청했습니다. 저장 위치는 브라우저의 다운로드 설정을 따릅니다.`,
      )
    } catch (error) {
      setMessage(
        error.name === 'AbortError'
          ? '저장을 취소했습니다.'
          : error.message || '파일 저장에 실패했습니다.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="claims-shell">
      <div className="claims-content">
        <header className="claims-heading">
          <div>
            <h1>보험 청구 준비</h1>
            <p>병원 기록에 등록한 영수증을 선택하고 PDF로 내려받으세요.</p>
          </div>
          <button className="secondary-button" onClick={onGoRecords}>
            병원 기록으로 이동
          </button>
        </header>

        <div className="claims-columns">
          <section className="panel claims-list-panel">
            <div className="panel-header">
              <h2>영수증 목록</h2>
              <span className="panel-caption">
                총 {receipts.length}건 · 선택 {selected.length}건
              </span>
            </div>

            <label className="claims-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = selected.length > 0 && !allSelected
                  }
                }}
                disabled={!receipts.length || busy}
                onChange={() => setSelectedIds(allSelected ? [] : receipts.map((item) => item.id))}
              />
              전체 선택
            </label>

            <div className="panel-body">
              {!receipts.length && (
                <p className="claims-empty">
                  {patientName ? '등록된 영수증이 없습니다.' : '환자를 먼저 등록해주세요.'}
                </p>
              )}

              {receipts.map((item) => (
                <div
                  className={`claims-row ${previewId === item.id ? 'is-previewed' : ''}`}
                  key={item.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    disabled={busy}
                    aria-label={`${item.date} ${item.type} 선택`}
                  />

                  <button
                    className="claims-row-button"
                    onClick={() => setPreviewId(item.id)}
                    aria-pressed={previewId === item.id}
                  >
                    <span className="claims-file-icon" aria-hidden="true">
                      ▤
                    </span>
                    <span className="claims-row-text">
                      <strong>{item.type}</strong>
                      <span>
                        {item.date} · {item.hospital}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel claims-preview-panel">
            <div className="panel-header">
              <h2>영수증 미리보기</h2>
              <button
                className="text-button"
                disabled={!preview}
                onClick={(event) => onPreview(preview, event)}
              >
                크게 보기
              </button>
            </div>

            {preview ? (
              <>
                <p className="page-description">
                  {preview.type}
                  <br />
                  {preview.date} · {preview.hospital}
                </p>
                <button
                  className="claims-image-area"
                  onClick={(event) => onPreview(preview, event)}
                  aria-label="영수증 원본 크게 보기"
                >
                  <img src={preview.url} alt={preview.type} />
                </button>
              </>
            ) : (
              <div className="claims-empty claims-preview-empty">
                목록에서 영수증 제목을 선택하면 원본이 표시됩니다.
              </div>
            )}
          </section>
        </div>

        <footer className="claims-download-panel">
          <div className="claims-download-options">
            <strong>다운로드 방식</strong>
            <label>
              <input
                type="radio"
                name="download-mode"
                checked={downloadMode === 'merged'}
                disabled={busy}
                onChange={() => setDownloadMode('merged')}
              />
              하나의 PDF로 합치기
            </label>
            <label>
              <input
                type="radio"
                name="download-mode"
                checked={downloadMode === 'separate'}
                disabled={busy}
                onChange={() => setDownloadMode('separate')}
              />
              각각 PDF로 받기 (ZIP)
            </label>
          </div>

          <div className="claims-filename-control">
            <label htmlFor="download-filename">파일 이름</label>
            <div className="claims-filename-input">
              <input
                id="download-filename"
                type="text"
                disabled={busy || !selected.length}
                maxLength={60}
                value={customName ?? suggestedBase}
                onChange={(event) => setCustomName(event.target.value)}
              />
              <span>.{extension}</span>
              <button
                type="button"
                className="text-button"
                disabled={busy || !selected.length}
                onClick={() => setCustomName(null)}
              >
                자동 이름
              </button>
            </div>
            <p className="panel-caption">
              {selected.length
                ? `저장 파일: ${filename}`
                : '영수증을 선택하면 파일 이름을 정할 수 있습니다.'}
            </p>
          </div>

          <button className="upload-button" disabled={!selected.length || busy} onClick={download}>
            {busy ? '생성 중…' : downloadMode === 'merged' ? 'PDF 다운로드' : 'ZIP 다운로드'}
          </button>
        </footer>

        <p className="claims-status" role="status">
          {message || '선택한 영수증은 진료일 순으로 생성됩니다.'}
        </p>
      </div>
    </div>
  )
}
