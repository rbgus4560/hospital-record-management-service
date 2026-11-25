/**
 * 1. 목적
 *    홈에서 날짜를 기준으로 일정과 등록 문서를 확인한다.
 *
 * 2. 입력
 *    캘린더의 기준 날짜와 환자별 일정·문서 데이터를 받는다.
 *
 * 3. 주요 기능
 *    월간 달력과 선택 날짜의 기록을 표시하고 병원 기록 화면으로 이동할 수 있게 한다.
 */
import { DocumentList, AppointmentList } from '../../shared-components/DocumentAndAppointmentLists'
import './HomeCalendarPage.css'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function HomeCalendarPage({
  month,
  setMonth,
  selectedDate,
  setSelectedDate,
  notice,
  selectedPatient,
  patientAppointments,
  patientDocuments,
  openPreview,
  changeMenu,
}) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7)
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`

  const pendingAppointments = patientAppointments.filter((item) => !item.completed)
  const shownAppointments = pendingAppointments.filter(
    (item) => item.date.startsWith(monthPrefix) && (!selectedDate || item.date === selectedDate),
  )

  return (
    <div className="dashboard-grid">
      <section className="panel calendar-panel">
        <div className="panel-header">
          <div className="month-navigation">
            <button
              aria-label="이전 달"
              onClick={() => {
                setMonth(new Date(year, monthIndex - 1, 1))
                setSelectedDate('')
              }}
            >
              ‹
            </button>
            <h2>
              {year}년 {monthIndex + 1}월
            </h2>
            <button
              aria-label="다음 달"
              onClick={() => {
                setMonth(new Date(year, monthIndex + 1, 1))
                setSelectedDate('')
              }}
            >
              ›
            </button>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              const today = new Date()
              setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
              setSelectedDate('')
            }}
          >
            오늘
          </button>
        </div>

        <div className="home-status" role="status">
          {notice ||
            (selectedPatient
              ? `${selectedPatient.name} 환자의 확인된 일정`
              : '환자를 등록하고 문서를 올려주세요.')}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="legend-dot visit-dot" />
            진료
          </span>
          <span>
            <i className="legend-dot exam-dot" />
            검사
          </span>
        </div>

        <div
          className="calendar-grid"
          style={{
            gridTemplateRows: `34px repeat(${weekCount}, minmax(0, 1fr))`,
          }}
        >
          {weekdays.map((day, index) => (
            <div
              key={day}
              className={`weekday ${index === 0 ? 'sunday' : ''} ${index === 6 ? 'saturday' : ''}`}
            >
              {day}
            </div>
          ))}

          {Array.from({ length: weekCount * 7 }, (_, index) => {
            const day = index - firstWeekday + 1
            if (day < 1 || day > daysInMonth) {
              return <div key={index} className="calendar-empty" />
            }

            const key = dateKey(year, monthIndex, day)
            const items = pendingAppointments.filter((item) => item.date === key)

            return (
              <button
                key={key}
                className={`calendar-day ${selectedDate === key ? 'selected' : ''}`}
                onClick={() => setSelectedDate((previous) => (previous === key ? '' : key))}
                aria-label={`${monthIndex + 1}월 ${day}일`}
                aria-pressed={selectedDate === key}
              >
                <span className="day-number">{day}</span>
                {items.slice(0, 2).map((item) => (
                  <span
                    key={item.id}
                    className={`calendar-event ${item.type === '검사' ? 'exam' : 'visit'}`}
                  >
                    <span className="event-full">
                      {item.time || ''} {item.title}
                    </span>
                    <span className="event-short">
                      {item.type} {item.time || ''}
                    </span>
                  </span>
                ))}
                {items.length > 2 && <span className="more-events">+{items.length - 2}건</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel schedule-panel">
        <div className="panel-header">
          <div>
            <h2>{selectedDate ? '선택한 날짜의 일정' : '이번 달 일정'}</h2>
            <p className="panel-caption">예정 {shownAppointments.length}건</p>
          </div>
          {selectedDate && (
            <button className="text-button" onClick={() => setSelectedDate('')}>
              전체 보기
            </button>
          )}
        </div>
        <div className="panel-body">
          <AppointmentList items={shownAppointments} />
        </div>
      </section>

      <section className="panel documents-panel">
        <div className="panel-header documents-header">
          <h2>최근 등록한 문서</h2>
          <button className="upload-button" onClick={() => changeMenu('records')}>
            문서 사진 올리기
          </button>
        </div>
        <div className="panel-body">
          <DocumentList items={patientDocuments.slice(0, 3)} onPreview={openPreview} />
        </div>
      </section>
    </div>
  )
}
