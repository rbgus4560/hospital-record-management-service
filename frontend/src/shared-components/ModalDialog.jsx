/**
 * 1. 목적
 *    등록·수정·검수에 쓰는 공통 팝업을 제공한다.
 *
 * 2. 입력
 *    팝업 제목, 내부 콘텐츠와 닫기 동작을 받는다.
 *
 * 3. 주요 기능
 *    배경 클릭·Escape 닫기와 Tab 키 포커스 순환을 처리한다.
 */
import { useRef } from 'react'

export default function ModalDialog({ title, children, onClose, className = '' }) {
  const dialog = useRef(null)

  return (
    <div
      className="management-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialog}
        className={`management-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-modal-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()

          if (event.key === 'Tab') {
            const elements = Array.from(
              dialog.current.querySelectorAll(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
              ),
            )
            const first = elements[0]
            const last = elements[elements.length - 1]

            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <div className="panel-header">
          <h2 id="management-modal-title">{title}</h2>
          <button className="secondary-button" onClick={onClose} autoFocus>
            닫기
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
