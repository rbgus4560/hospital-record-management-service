/**
 * 1. 목적
 *    React 개발 서버와 배포용 빌드 설정을 정의한다.
 *
 * 2. 입력
 *    Vite가 개발 서버를 시작하거나 번들을 만들 때 읽는다.
 *
 * 3. 주요 기능
 *    React 플러그인을 등록해 JSX 소스를 처리한다.
 */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
