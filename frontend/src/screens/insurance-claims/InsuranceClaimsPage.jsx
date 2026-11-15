/** 보험 청구용 영수증 선택·미리보기·파일명 편집·PDF/ZIP 생성 흐름을 관리한다. 보험사 전송 기능은 없다. */
import { useEffect, useState } from 'react'
import { api, apiUrl } from '../../api/hospitalRecordsApi'
import { createPdf, downloadBlob } from './receiptPdfExport'
import JSZip from 'jszip'
import './InsuranceClaimsPage.css'
import { receiptFilename, bundleFilename, customDownloadFilename } from './claimDownloadFilenames'

export default function InsuranceClaimsPage({
  patientId,
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
  const [customName, setCustomName] = useState(null)

  const [bundles, setBundles] = useState([])
  const [savingUsedId, setSavingUsedId] = useState(null)
  const bundlePath = `/api/patients/${patientId}/claim-bundles`

  useEffect(() => {
    if (!patientId) return
    const controller = new AbortController()

    api(bundlePath, { signal: controller.signal })
      .then((saved) => {
        if (!controller.signal.aborted) {
          setBundles((current) => [
            ...current,
            ...saved.filter((item) => !current.some((existing) => existing.id === item.id)),
          ])
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message)
      })

    return () => controller.abort()
  }, [bundlePath, patientId])

  async function markUsed(id) {
    setSavingUsedId(id)
    setMessage('')
    try {
      const saved = await api(`${bundlePath}/${id}/used`, { method: 'PUT' })
      setBundles((previous) => previous.map((item) => (item.id === id ? saved : item)))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSavingUsedId(null)
    }
  }

  const bundledReceiptIds = new Set(
    bundles.flatMap((bundle) => bundle.receipts.map((item) => item.id)),
  )
  const availableReceipts = receipts.filter((item) => !bundledReceiptIds.has(item.id))
  const selected = availableReceipts.filter((item) => selectedIds.includes(item.id))
  const preview = availableReceipts.find((item) => item.id === previewId)
  const allSelected = availableReceipts.length > 0 && selected.length === availableReceipts.length
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
        (a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt,
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

      if (blob.size > 50 * 1024 * 1024) {
        throw new Error('청구 묶음은 50MB까지 저장할 수 있습니다. 영수증을 나눠서 선택해주세요.')
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('생성한 파일을 읽을 수 없습니다.'))
        reader.readAsDataURL(blob)
      })
      const saved = await api(bundlePath, {
        method: 'POST',
        body: {
          filename,
          documentIds: sorted.map((item) => item.id),
          fileBase64: dataUrl.split(',', 2)[1],
        },
      })
      setBundles((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)])
      setSelectedIds([])
      setCustomName(null)
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
            <p>병원 기록에 등록한 영수증을 선택하고 PDF 또는 ZIP으로 묶어 내려받으세요.</p>
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
                묶기 전 {availableReceipts.length}건 · 선택 {selected.length}건
              </span>
            </div>

            {availableReceipts.length > 0 && (
              <label className="claims-select-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = selected.length > 0 && !allSelected
                    }
                  }}
                  disabled={busy}
                  onChange={() =>
                    setSelectedIds(allSelected ? [] : availableReceipts.map((item) => item.id))
                  }
                />
                전체 선택
              </label>
            )}

            <div className="panel-body">
              {!availableReceipts.length && !bundles.length && (
                <p className="claims-empty">
                  {patientName ? '등록된 영수증이 없습니다.' : '환자를 먼저 등록해주세요.'}
                </p>
              )}

              {availableReceipts.map((item) => (
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

              {bundles.length > 0 && (
                <section className="claims-bundles" aria-label="청구용 파일 목록">
                  <h3>청구용 파일 목록</h3>
                  {bundles.map((bundle) => (
                    <article className="claims-bundle" key={bundle.id}>
                      <details>
                        <summary>
                          <span className="claims-row-text">
                            <strong>{bundle.filename}</strong>
                            <span>
                              {bundle.fileType.toUpperCase()} · 영수증 {bundle.receipts.length}건
                              {' · '}
                              {new Date(bundle.createdAt).toLocaleDateString('ko-KR')}
                            </span>
                          </span>
                        </summary>
                        <div className="claims-bundle-details">
                          <ul>
                            {bundle.receipts.map((item) => (
                              <li key={item.id}>
                                {item.date || '날짜 미입력'} · {item.hospital} · {item.type}
                              </li>
                            ))}
                          </ul>
                          <a href={apiUrl(`${bundlePath}/${bundle.id}/file`)}>다시 다운로드</a>
                        </div>
                      </details>
                      <div className="claims-bundle-action">
                        {bundle.usedAt ? (
                          <span
                            className="claims-used"
                            title={new Date(bundle.usedAt).toLocaleString('ko-KR')}
                          >
                            사용 완료
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={savingUsedId !== null}
                            onClick={() => markUsed(bundle.id)}
                          >
                            {savingUsedId === bundle.id ? '저장 중…' : '사용 완료'}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </section>
              )}
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
