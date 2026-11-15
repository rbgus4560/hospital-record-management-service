"""README 구성도 생성. 원본 벡터(SVG)와 한글 폰트를 적용한 PNG를 함께 출력한다."""

from pathlib import Path
from html import escape
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 2400, 1510
img = Image.new("RGB", (W, H), "#ffffff")
draw = ImageDraw.Draw(img)
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
    '<rect width="100%" height="100%" fill="white"/>',
]
font_dir = Path("C:/Windows/Fonts")


def font(size, bold=False):
    return ImageFont.truetype(
        str(font_dir / ("malgunbd.ttf" if bold else "malgun.ttf")), size
    )


def rect(box, fill, stroke="#d5dfeb", radius=18, width=2):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=stroke, width=width)
    svg.append(
        f'<rect x="{x1}" y="{y1}" width="{x2 - x1}" height="{y2 - y1}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
    )


def text(x, y, value, size=27, color="#283e56", bold=False, center=False):
    f = font(size, bold)
    if center:
        x -= draw.textlength(value, font=f) / 2
    draw.text((x, y), value, font=f, fill=color)
    svg.append(
        f'<text x="{x}" y="{y + size}" fill="{color}" font-family="Malgun Gothic, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}">{escape(value)}</text>'
    )


def arrow(x1, y1, x2, y2, color="#4773ad", both=False):
    draw.line((x1, y1, x2, y2), fill=color, width=4)
    svg.append(
        f'<path d="M {x1} {y1} L {x2} {y2}" stroke="{color}" stroke-width="4" fill="none"/>'
    )

    def tip(x, y, a):
        pts = [
            (x, y),
            (x - 14 * math.cos(a - 0.48), y - 14 * math.sin(a - 0.48)),
            (x - 14 * math.cos(a + 0.48), y - 14 * math.sin(a + 0.48)),
        ]
        draw.polygon(pts, fill=color)
        svg.append(
            '<polygon points="'
            + " ".join(f"{px},{py}" for px, py in pts)
            + f'" fill="{color}"/>'
        )

    a = math.atan2(y2 - y1, x2 - x1)
    tip(x2, y2, a)
    if both:
        tip(x1, y1, a + math.pi)


def line(points, color="#4773ad", width=4):
    draw.line(points, fill=color, width=width, joint="curve")
    svg.append(
        '<polyline points="'
        + " ".join(f"{x},{y}" for x, y in points)
        + f'" stroke="{color}" stroke-width="{width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def ellipse(box, fill="white", stroke="#4773ad", width=4):
    x1, y1, x2, y2 = box
    draw.ellipse(box, fill=fill, outline=stroke, width=width)
    svg.append(
        f'<ellipse cx="{(x1 + x2) / 2}" cy="{(y1 + y2) / 2}" rx="{(x2 - x1) / 2}" ry="{(y2 - y1) / 2}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
    )


def icon(cx, cy, kind, color):
    if kind == "camera":
        rect((cx - 60, cy - 36, cx + 60, cy + 34), "white", color, 12, 4)
        ellipse((cx - 23, cy - 25, cx + 23, cy + 21), "#edf4fd", color, 4)
        line([(cx - 23, cy + 36), (cx - 23, cy + 48), (cx + 23, cy + 48)], color, 4)
    elif kind == "app":
        rect((cx - 66, cy - 43, cx + 66, cy + 38), "white", color, 10, 4)
        line([(cx - 65, cy - 19), (cx + 65, cy - 19)], color, 3)
        for dx in [-48, -33, -18]:
            ellipse((cx + dx - 3, cy - 33, cx + dx + 3, cy - 27), color, color, 1)
        ellipse((cx - 14, cy - 7, cx + 14, cy + 18), "#edf4fd", color, 3)
        line(
            [
                (cx - 30, cy + 29),
                (cx - 20, cy + 19),
                (cx + 20, cy + 19),
                (cx + 30, cy + 29),
            ],
            color,
            3,
        )
    elif kind == "server":
        for dy in [-43, -10, 23]:
            rect((cx - 60, cy + dy, cx + 60, cy + dy + 26), "white", color, 6, 3)
            ellipse((cx - 46, cy + dy + 9, cx - 38, cy + dy + 17), color, color, 1)
            line([(cx - 20, cy + dy + 13), (cx + 40, cy + dy + 13)], color, 3)
    elif kind == "ai":
        rect((cx - 38, cy - 38, cx + 38, cy + 38), "#edf4fd", color, 10, 4)
        for t in [-22, 0, 22]:
            for side in [-1, 1]:
                line([(cx + side * 38, cy + t), (cx + side * 53, cy + t)], color, 3)
                line([(cx + t, cy + side * 38), (cx + t, cy + side * 53)], color, 3)
        text(cx, cy - 22, "AI", 30, color, True, True)
    elif kind == "db":
        rect((cx - 54, cy - 35, cx + 54, cy + 31), "white", color, 1, 3)
        ellipse((cx - 54, cy + 12, cx + 54, cy + 49), "white", color, 3)
        rect((cx - 51, cy - 30, cx + 51, cy + 28), "white", "white", 0, 1)
        ellipse((cx - 54, cy - 49, cx + 54, cy - 12), "#edf4fd", color, 3)
        line([(cx - 54, cy - 29), (cx - 54, cy + 29)], color, 3)
        line([(cx + 54, cy - 29), (cx + 54, cy + 29)], color, 3)
    elif kind == "files":
        rect((cx - 45, cy - 48, cx + 50, cy + 35), "#edf4fd", color, 6, 3)
        rect((cx - 60, cy - 31, cx + 35, cy + 52), "white", color, 6, 3)
        for dy in [-9, 7, 23]:
            line([(cx - 42, cy + dy), (cx + 17, cy + dy)], color, 3)
    elif kind == "monitor":
        rect((cx - 66, cy - 43, cx + 66, cy + 31), "white", color, 8, 4)
        line(
            [(cx, cy + 31), (cx, cy + 49), (cx - 30, cy + 49), (cx + 30, cy + 49)],
            color,
            4,
        )
        line(
            [
                (cx - 43, cy + 10),
                (cx - 22, cy - 8),
                (cx - 4, cy + 4),
                (cx + 25, cy - 23),
                (cx + 43, cy - 6),
            ],
            color,
            4,
        )


def card(cx, cy, title, kind, detail, color="#3668a8", width=290):
    rect(
        (cx - width / 2, cy - 105, cx + width / 2, cy + 112), "white", "#d8e3ef", 18, 2
    )
    icon(cx, cy - 27, kind, color)
    text(cx, cy + 36, title, 29, color, True, True)
    text(cx, cy + 78, detail, 22, "#61758a", False, True)


def label(cx, y, title, color="#3668a8", size=25):
    tw = draw.textlength(title, font=font(size, True))
    rect(
        (cx - tw / 2 - 12, y - 3, cx + tw / 2 + 12, y + size + 9),
        "white",
        "white",
        5,
        1,
    )
    text(cx, y, title, size, color, True, True)


def route(points, color="#3668a8"):
    line(points, color)
    arrow(*points[-2], *points[-1], color)


BLUE = "#3668a8"
GREEN = "#27806a"
AMBER = "#b57a2c"
text(65, 35, "병원 영수증에서 일정 확인·PDF까지", 47, "#172d49", True)
text(
    67,
    102,
    "사진 업로드 → CLOVA OCR → 좌표 기반 파싱 → 사용자 확인 → 임시 기록·다운로드",
    26,
    "#64778b",
)
rect((55, 190, 715, 1350), "#f3f7fc", "#c4d4e9", 24)
rect((790, 190, 1450, 1350), "#f3f9f6", "#bed9cf", 24)
rect((1525, 190, 2345, 670), "#fcf8f1", "#e2d0b1", 24)
rect((1525, 790, 2345, 1350), "#f8f5fc", "#d6c5e6", 24)
text(95, 220, "브라우저 · React", 32, BLUE, True)
text(830, 220, "로컬 Python 백엔드", 32, GREEN, True)
text(1565, 220, "외부 OCR 서비스", 32, AMBER, True)
text(1565, 820, "브라우저 다운로드", 32, "#80609d", True)
card(385, 440, "영수증 업로드", "files", "JPG / PNG", BLUE, 470)
card(1120, 440, "FastAPI", "server", "입력 검증 · OCR 중계", GREEN, 470)
card(1935, 440, "CLOVA OCR", "ai", "텍스트·좌표·신뢰도 반환", AMBER, 550)
arrow(620, 440, 885, 440, BLUE, True)
label(752, 380, "① 이미지 / 결과", BLUE, 23)
arrow(1355, 440, 1660, 440, AMBER, True)
label(1508, 380, "② HTTPS", AMBER, 23)
card(1120, 860, "영수증 파서", "app", "영역·날짜·금액 규칙 추출", GREEN, 470)
arrow(1120, 552, 1120, 750, GREEN, True)
label(1120, 637, "③ OCR 좌표 → 후보", GREEN, 24)
card(385, 860, "확인 · 수정", "app", "원본·인식 영역·일정 후보", BLUE, 470)
arrow(885, 860, 620, 860, GREEN)
label(752, 798, "④ 추출 결과", GREEN, 23)
card(385, 1200, "환자별 기록 · 일정", "app", "React 메모리 · DB 미연동", BLUE, 510)
arrow(385, 972, 385, 1090, BLUE)
label(385, 1016, "⑤ 확인 후 반영", BLUE, 24)
card(1120, 1200, "OCR 원본 JSON", "files", "백엔드 디버그 보관", GREEN, 470)
route([(1355, 500), (1410, 500), (1410, 1060), (1120, 1060), (1120, 1090)], GREEN)
card(1935, 1110, "PDF / ZIP", "files", "선택 영수증 합치기·개별 출력", "#80609d", 550)
route(
    [(640, 1200), (730, 1200), (730, 1030), (1640, 1030), (1640, 1110), (1660, 1110)],
    "#80609d",
)
label(1520, 992, "⑥ 선택한 영수증 내보내기", "#80609d", 23)
text(
    67,
    1400,
    "사용자 확인 전 추출값은 후보입니다. 진단·의료 판단 또는 보험 청구 전송 기능이 아닙니다.",
    24,
    "#64778b",
)
text(
    67,
    1440,
    "DB·LLM 요약은 현재 코드에 없음 · 화면 메모리는 새로고침 시 유지되지 않음",
    24,
    "#64778b",
)

svg.append("</svg>")
img.save(ROOT / "images/system-architecture.png")
(ROOT / "images/system-architecture.svg").write_text("\n".join(svg), encoding="utf-8")
print("Created PNG + SVG")
