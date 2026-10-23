import { useState } from 'react'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import './InsuranceClaims.css'

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('원본 사진을 읽지 못했습니다.'))
    image.src = url
  })
}

async function createPdf(items) {
  let pdf

  for (let index = 0; index < items.length; index += 1) {
    const image = await loadImage(items[index].url)
    const orientation =
      image.naturalWidth > image.naturalHeight ? 'landscape' : 'portrait'

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
    } else {
      pdf.addPage('a4', orientation)
    }

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const context = canvas.getContext('2d')
    if (!context) throw new Error('사진 변환에 실패했습니다.')

    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const scale = Math.min(
      (pageWidth - 16) / canvas.width,
      (pageHeight - 16) / canvas.height,
    )

    const width = canvas.width * scale
    const height = canvas.height * scale

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      (pageWidth - width) / 2,
      (pageHeight - height) / 2,
      width,
      height,
    )

    canvas.width = 0
    canvas.height = 0
  }

  return pdf
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

function safeName(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80)
}

export default function InsuranceClaims({
  receipts,
  patientName,
  onPreview,
  onGoRecords,
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const [previewId, setPreviewId] = useState(null)
  const [downloadMode, setDownloadMode] = useState('merged')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selected = receipts.filter((item) => selectedIds.includes(item.id))
  const preview = receipts.find((item) => item.id === previewId)
  const allSelected = receipts.length > 0 && selected.length === receipts.length

  function toggle(id) {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    )
  }

  async function download() {
    if (!selected.length) return
    setBusy(true)
    setMessage('')

    try {
      const sorted = [...selected].sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
      )

      if (downloadMode === 'merged') {
        const pdf = await createPdf(sorted)
        downloadBlob(
          pdf.output('blob'),
          `${safeName(patientName)}_보험청구_영수증모음.pdf`,
        )
      } else {
        const zip = new JSZip()

        for (let index = 0; index < sorted.length; index += 1) {
          const item = sorted[index]
          const pdf = await createPdf([item])
          zip.file(
            `${String(index + 1).padStart(2, '0')}_${item.date}_${safeName(item.type)}.pdf`,
            pdf.output('arraybuffer'),
          )
        }

        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, `${safeName(patientName)}_보험청구_개별영수증.zip`)
      }

      setMessage('파일을 생성했습니다. 다운로드한 내용을 확인해주세요.')
    } catch (error) {
      setMessage(error.message || '파일 생성에 실패했습니다.')
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
                onChange={() =>
                  setSelectedIds(allSelected ? [] : receipts.map((item) => item.id))
                }
              />
              전체 선택
            </label>

            <div className="panel-body">
              {!receipts.length && (
                <p className="claims-empty">
                  {patientName
                    ? '등록된 영수증이 없습니다.'
                    : '환자를 먼저 등록해주세요.'}
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
                    <span className="claims-file-icon" aria-hidden="true">▤</span>
                    <span className="claims-row-text">
                      <strong>{item.type}</strong>
                      <span>{item.date} · {item.hospital}</span>
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
              >크게 보기</button>
            </div>

            {preview ? (
              <>
                <p className="page-description">
                  {preview.type}<br />
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

          <button
            className="upload-button"
            disabled={!selected.length || busy}
            onClick={download}
          >
            {busy
              ? '생성 중…'
              : downloadMode === 'merged' ? 'PDF 다운로드' : 'ZIP 다운로드'}
          </button>
        </footer>

        <p className="claims-status" role="status">
          {message || '선택한 영수증은 진료일 순으로 생성됩니다.'}
        </p>
      </div>
    </div>
  )
}