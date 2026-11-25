/**
 * 1. 목적
 *    브라우저에서 MediLog 화면을 시작한다.
 *
 * 2. 입력
 *    HTML의 루트 요소, 앱 컴포넌트와 공통 스타일을 사용한다.
 *
 * 3. 주요 기능
 *    React 루트를 만들고 앱을 마운트한다.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared-styles/global.css'
import HospitalRecordsApp from './HospitalRecordsApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HospitalRecordsApp />
  </StrictMode>,
)
