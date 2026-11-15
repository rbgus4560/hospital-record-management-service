/** OCR 좌표를 원본 이미지 위에 표시하고 선택한 글자·인식 신뢰도를 보여준다. 업무 필드의 정확도 판정은 하지 않는다. */
import { useState } from 'react'
import './OcrImageViewer.css'

export default function OcrImageViewer({ imageUrl, fields = [], alt = '병원 문서 원본' }) {
  const [imageSize, setImageSize] = useState(null)
  const [showBoxes, setShowBoxes] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(null)

  const selectedField = selectedIndex === null ? null : fields[selectedIndex]

  const confidence = selectedField?.inferConfidence

  function getPoints(field) {
    const vertices = field.boundingPoly?.vertices

    if (
      !Array.isArray(vertices) ||
      vertices.length < 3 ||
      vertices.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
    ) {
      return null
    }

    return vertices.map((point) => `${point.x},${point.y}`).join(' ')
  }

  return (
    <section className="ocr-viewer">
      <div className="ocr-viewer-toolbar">
        <label>
          <input
            type="checkbox"
            checked={showBoxes}
            onChange={(event) => setShowBoxes(event.target.checked)}
          />
          OCR 인식 영역 표시
        </label>

        <span>인식된 글자 묶음 {fields.length}개</span>
      </div>

      <p className="ocr-viewer-guide">
        테두리를 클릭하면 인식된 글자를 확인할 수 있습니다. 신뢰도는 글자 인식의 참고값이며, 항목
        연결의 정확도를 뜻하지 않습니다.
      </p>

      <div className="ocr-image-frame">
        <img
          src={imageUrl}
          alt={alt}
          onLoad={(event) => {
            setImageSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }}
        />

        {showBoxes && imageSize && (
          <svg
            className="ocr-box-overlay"
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            aria-label="OCR 인식 영역"
          >
            {fields.map((field, index) => {
              const points = getPoints(field)
              if (!points) return null

              return (
                <polygon
                  key={index}
                  points={points}
                  className={selectedIndex === index ? 'ocr-box is-selected' : 'ocr-box'}
                  tabIndex={0}
                  role="button"
                  aria-label={`인식 글자 ${field.inferText || '빈 값'}`}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedIndex(index)
                    }
                  }}
                >
                  <title>{field.inferText || '인식된 글자 없음'}</title>
                </polygon>
              )
            })}
          </svg>
        )}
      </div>

      <div className="ocr-selected-field" aria-live="polite">
        {selectedField ? (
          <>
            <strong>인식 글자</strong>
            <p>{selectedField.inferText || '빈 값'}</p>

            <span>
              인식 신뢰도:{' '}
              {typeof confidence === 'number'
                ? `${(confidence * 100).toFixed(1)}%`
                : '제공되지 않음'}
            </span>
          </>
        ) : (
          <p>확인할 글자의 테두리를 클릭해주세요.</p>
        )}
      </div>
    </section>
  )
}
