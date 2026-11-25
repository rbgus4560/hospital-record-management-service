/**
 * 1. 목적
 *    빈 영수증 양식으로 실제 OCR을 실행할 수 있는 데모 PNG를 만든다.
 *
 * 2. 입력
 *    체험 환자 이름과 프로젝트에 포함된 PNG 양식을 사용한다.
 *
 * 3. 주요 기능
 *    양식에 이름, 가상 금액과 일정 데이터를 그려 미리보기·다운로드용 이미지를 반환한다.
 */
const templateUrl = `${import.meta.env.BASE_URL}medilog-demo-receipt-template.png`

const demoReceiptDate = '2026-11-26'

export async function createDemoReceiptImage(name) {
  const image = new Image()
  image.src = templateUrl
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth * 2
  canvas.height = image.naturalHeight * 2
  const context = canvas.getContext('2d')
  if (!context) throw new Error('영수증 이미지를 만들 수 없습니다.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  // 양식의 미리보기 좌표를 PNG 해상도에 맞춰 변환한다.
  context.scale(canvas.width / 1055, canvas.height / 1491)
  context.fillStyle = '#151f2b'
  context.font = '20px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
  context.textBaseline = 'alphabetic'
  context.fillText('DEMO-001', 160, 129)
  context.fillText(name, 160, 167, 153)
  context.fillText('가정의학과', 465, 129)
  context.fillText(`${demoReceiptDate} 09:00`, 465, 167)
  context.fillText('DEMO-2026', 835, 129)

  // 숫자 한 묶음으로 읽히도록 금액에 천 단위 구분점을 찍지 않는다.
  context.textAlign = 'right'
  for (const [value, y] of [
    ['36000', 283],
    ['24000', 324],
    ['12000', 366],
    ['12000', 427],
  ]) {
    context.fillText(value, 1027, y)
  }
  context.textAlign = 'left'

  for (const [text, x, y] of [
    ['2026-12-03 (목) 14:45', 65, 1203],
    ['가정의학과', 65, 1229],
    ['담당의 A', 65, 1255],
    ['2026-12-03 (목) 15:30', 65, 1297],
    ['내과', 65, 1322],
    ['담당의 B', 65, 1348],
    ['2026-12-03 채혈실검사', 420, 1203],
    ['[본관 2층 채혈실]', 420, 1229],
    ['(총 1건)', 420, 1255],
  ]) {
    context.fillText(text, x, y)
  }
  return canvas.toDataURL('image/png')
}
