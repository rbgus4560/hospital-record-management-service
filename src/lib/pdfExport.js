/** 영수증 이미지를 원본 비율에 맞춘 A4 PDF로 만들고 Blob 다운로드를 요청한다. */
import { jsPDF } from 'jspdf'

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('원본 사진을 읽지 못했습니다.'))
    image.src = url
  })
}

export async function createPdf(items) {
  let pdf

  for (let index = 0; index < items.length; index += 1) {
    const image = await loadImage(items[index].url)
    const orientation = image.naturalWidth > image.naturalHeight ? 'landscape' : 'portrait'

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
    const scale = Math.min((pageWidth - 16) / canvas.width, (pageHeight - 16) / canvas.height)

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

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
