/** 제목과 메뉴에서 사용하는 청록색 SVG 아이콘. 장식 요소라 접근성 이름은 메뉴 텍스트가 담당한다. */
export default function NavigationIcon({ name, className = '' }) {
  const paths = {
    hospital: (
      <>
        <path d="M4 21V5h16v16M2 21h20M9 21v-5h6v5" />
        <path d="M12 7v6M9 10h6" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" />
      </>
    ),
    schedule: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 11h18m-13 5 3 3 5-5" />
      </>
    ),
    records: (
      <>
        <path d="M6 3h9l4 4v14H6ZM14 3v5h5M9 12h7M9 16h7" />
      </>
    ),
    claims: (
      <>
        <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
  }
  return (
    <svg
      className={`navigation-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
