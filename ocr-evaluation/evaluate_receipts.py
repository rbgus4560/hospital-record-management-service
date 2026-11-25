"""
1. 목적
   OCR 모델이나 파싱 규칙을 바꾼 뒤, 같은 영수증에서 인식과 추출 성능이 어떻게 달라졌는지 확인한다.

2. 입력
   저장된 OCR 결과와 사람이 영수증 원본을 보고 작성한 정답 JSON을 사용한다.

3. 주요 기능
   영역별 문자 오류율을 계산하고 진료·검사 일정의 일치·누락·추가 건수를 JSON 보고서로 저장한다.
"""

import argparse
import json
import math
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from ocr.snuh_receipt_parser import extract_receipt


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def characters(text):
    return "".join(unicodedata.normalize("NFC", text).split())


def edit_distance(expected, actual):
    previous = list(range(len(actual) + 1))
    for index, expected_char in enumerate(expected, start=1):
        current = [index]
        for neighbor, actual_char in enumerate(actual, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[neighbor] + 1,
                    previous[neighbor - 1] + (expected_char != actual_char),
                )
            )
        previous = current
    return previous[-1]


def raw_fields(raw):
    images = raw["images"]
    if len(images) != 1 or images[0].get("inferResult") != "SUCCESS":
        raise ValueError("영수증 한 장의 성공한 OCR 응답이 필요합니다.")
    fields = images[0]["fields"]
    if not isinstance(fields, list):
        raise TypeError("OCR fields 목록이 필요합니다.")
    return fields


def token_in_box(field, box):
    if box is None:
        return True
    points = field["boundingPoly"]["vertices"]
    x = sum(point["x"] for point in points) / len(points)
    y = sum(point["y"] for point in points) / len(points)
    left, top, right, bottom = box
    return left <= x < right and top <= y < bottom


def evaluate_region(fields, region):
    name = region["name"]
    expected = characters(region["transcript"])
    if not expected:
        raise ValueError(f"{name}: 원본 사진에서 옮겨 적은 정답 문자가 필요합니다.")
    box = region.get("box")
    if box is not None and (
        not isinstance(box, list)
        or len(box) != 4
        or any(
            type(value) not in (int, float) or not math.isfinite(value) for value in box
        )
        or not (0 <= box[0] < box[2] and 0 <= box[1] < box[3])
    ):
        raise ValueError(f"{name}: box는 [왼쪽, 위, 오른쪽, 아래] 순서로 입력해주세요.")
    actual = characters(
        "".join(
            field.get("inferText", "") for field in fields if token_in_box(field, box)
        )
    )
    errors = edit_distance(expected, actual)
    return {
        "name": name,
        "reference_characters": len(expected),
        "character_errors": errors,
        "cer_percent": percentage(errors, len(expected)),
        "expected_text": region["transcript"],
        "recognized_text_without_whitespace": actual,
    }


SCHEDULE_FIELDS = (
    "type",
    "date",
    "time",
    "department",
    "doctor",
    "examination",
    "location",
)
DETAIL_FIELDS = {"진료": {"department", "doctor"}, "검사": {"examination", "location"}}


def schedule_key(item, *, reference=False):
    kind = item.get("type")
    if reference:
        if kind not in DETAIL_FIELDS:
            raise ValueError("일정 종류는 진료 또는 검사로 입력해주세요.")
        allowed = {"type", "date", "time"} | DETAIL_FIELDS[kind]
        if item.keys() - allowed:
            raise ValueError(f"{kind} 일정에 맞는 정답 항목만 입력해주세요.")
        day = item.get("date")
        if not isinstance(day, str) or date.fromisoformat(day).isoformat() != day:
            raise ValueError("일정 날짜는 YYYY-MM-DD 형식으로 입력해주세요.")
        time = item.get("time")
        if time is not None and not re.fullmatch(
            r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", time
        ):
            raise ValueError("일정 시간은 HH:MM 형식으로 적거나 null로 두세요.")
    return tuple(
        " ".join(unicodedata.normalize("NFC", value).split()) or None
        if isinstance(value := item.get(field), str)
        else value
        for field in SCHEDULE_FIELDS
    )


def schedule_totals(expected, predicted, matched):
    return {
        "expected": expected,
        "predicted": predicted,
        "matched": matched,
        "missed": expected - matched,
        "extra": predicted - matched,
        "recall_percent": percentage(matched, expected) if expected else None,
        "precision_percent": percentage(matched, predicted) if predicted else None,
    }


def compare_schedules(references, candidates):
    if not isinstance(references, list):
        raise TypeError("expected_schedules에는 일정 목록을 입력해주세요.")
    expected = Counter(schedule_key(item, reference=True) for item in references)
    predicted = Counter(schedule_key(item) for item in candidates)

    def as_rows(items):
        return [
            dict(zip(SCHEDULE_FIELDS, key, strict=True)) for key in items.elements()
        ]

    return {
        **schedule_totals(
            expected.total(), predicted.total(), (expected & predicted).total()
        ),
        "missing_schedules": as_rows(expected - predicted),
        "extra_schedules": as_rows(predicted - expected),
    }


def percentage(numerator, denominator):
    return round(100 * numerator / denominator, 2)


def character_totals(regions):
    length = sum(region["reference_characters"] for region in regions)
    errors = sum(region["character_errors"] for region in regions)
    return {
        "reference_characters": length,
        "character_errors": errors,
        "cer_percent": percentage(errors, length),
    }


def evaluate(manifest_path):
    receipts = read_json(manifest_path)["receipts"]
    if not isinstance(receipts, list) or not receipts:
        raise ValueError("평가할 영수증을 receipts에 추가해주세요.")
    samples = []
    all_regions = []
    seen_ids = set()
    seen_sources = set()
    for receipt in receipts:
        sample_id = receipt["id"]
        try:
            if not isinstance(sample_id, str) or not sample_id.strip():
                raise ValueError("영수증 ID가 비어 있습니다.")
            source = (manifest_path.parent / receipt["ocr_json"]).resolve()
            if sample_id in seen_ids or source in seen_sources:
                raise ValueError("영수증 ID 또는 OCR 응답 파일이 중복됩니다.")
            seen_ids.add(sample_id)
            seen_sources.add(source)
            fields = raw_fields(read_json(source))
            regions = [evaluate_region(fields, region) for region in receipt["regions"]]
            if not regions or len({region["name"] for region in regions}) != len(
                regions
            ):
                raise ValueError(
                    "이름이 겹치지 않는 평가 영역을 한 개 이상 입력해주세요."
                )
            candidates = extract_receipt(fields)["schedule_candidates"]
            schedules = compare_schedules(receipt["expected_schedules"], candidates)
        except (OSError, ValueError, KeyError, TypeError, ZeroDivisionError) as error:
            raise ValueError(f"{sample_id}: {error}") from error
        all_regions.extend(regions)
        samples.append(
            {
                "id": sample_id,
                "characters": character_totals(regions),
                "regions": regions,
                "schedules": schedules,
            }
        )
    return {
        "receipt_count": len(samples),
        "characters": character_totals(all_regions),
        "schedules": schedule_totals(
            *(
                sum(item["schedules"][key] for item in samples)
                for key in ("expected", "predicted", "matched")
            )
        ),
        "receipts": samples,
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("ground_truth", type=Path, help="영수증 정답표 JSON")
    cli.add_argument("--output", type=Path, required=True, help="결과 JSON 경로")
    args = cli.parse_args()
    if args.ground_truth.resolve() == args.output.resolve():
        cli.error("정답표와 결과 파일 경로를 다르게 지정해주세요.")
    try:
        result = evaluate(args.ground_truth)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    except (OSError, ValueError, KeyError, TypeError) as error:
        cli.exit(2, f"평가 실패: {error}\n")
    totals = result["characters"]
    print(
        f"영수증 {result['receipt_count']}장 · 정답 {totals['reference_characters']}자 · CER {totals['cer_percent']}%"
    )
    schedules = result["schedules"]
    print(
        f"일정 완전 일치 {schedules['matched']}/{schedules['expected']}건 · "
        f"누락 {schedules['missed']}건 · 추가 {schedules['extra']}건"
    )


if __name__ == "__main__":
    main()
