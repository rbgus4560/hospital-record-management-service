/**
 * 1. 목적
 *    프런트엔드에서 검사할 코드와 규칙을 정한다.
 *
 * 2. 입력
 *    ESLint가 프로젝트의 JS·JSX 소스를 검사할 때 읽는다.
 *
 * 3. 주요 기능
 *    브라우저 환경과 React 관련 검사 규칙을 적용하고 빌드 결과를 검사에서 제외한다.
 */
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.setup.local', 'work', 'outputs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
