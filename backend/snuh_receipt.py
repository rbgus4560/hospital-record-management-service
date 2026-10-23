"""서울대 영수증의 다음 진료/검사 일정 후보 추출. 추가 패키지 불필요."""
import json
import math
import re
import sys
from datetime import date
from pathlib import Path
from statistics import median


def extract_schedules(fields):
    tokens = []
    for index, field in enumerate(fields):
        if not isinstance(field, dict):
            continue
        try:
            points = field['boundingPoly']['vertices']
            xs = [float(p['x']) for p in points]
            ys = [float(p['y']) for p in points]
            if len(xs) < 3 or not all(math.isfinite(v) for v in xs + ys):
                continue
            tokens.append(dict(index=index, text=str(field.get('inferText', '')).strip(),
                               x=sum(xs)/len(xs), y=sum(ys)/len(ys),
                               height=max(ys)-min(ys), left=min(xs), right=max(xs),
                               confidence=float(field.get('inferConfidence', 0))))
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            continue
    def compact(text):
        return re.sub(r'\s+', '', text)

    def heading(keyword):
        for t in tokens:
            if keyword not in compact(t['text']):
                continue
            # 같은 줄에서 가까이 있는 제목 글자들을 확인합니다.
            nearby = sorted([p for p in tokens if abs(p['y']-t['y']) < max(t['height'], 1)*0.6
                             and t['left']-t['height']*8 < p['x'] <= t['right']],
                            key=lambda p: p['x'])
            if '다음에오실'+keyword in compact(''.join(p['text'] for p in nearby)):
                return dict(x=(nearby[0]['left']+t['right'])/2,
                            y=t['y'], height=max(t['height'], 1))
        return None

    visit, exam = heading('진료일'), heading('검사일')
    warnings, regions, candidates = [], [], []
    if not visit or not exam or exam['x'] <= visit['x']:
        return {'parser': 'snuh_receipt_v1', 'schedule_candidates': [], 'regions': [],
                'warnings': ['진료일·검사일 제목을 찾지 못했습니다. 원본을 확인해 주세요.']}
    distance = exam['x']-visit['x']
    boundary = (visit['x']+exam['x'])/2
    for kind, anchor, left, right in (
        ('진료', visit, visit['x']-distance/2, boundary),
        ('검사', exam, boundary, exam['x']+distance/2),
    ):
        # 제목 간격을 이용한 상대 영역. 다른 양식/하단 안내문에서는 검증 필요.
        region = dict(type=kind, left=left, right=right, top=anchor['y']+anchor['height']/2,
                      bottom=max(t['y']+t['height']/2 for t in tokens))
        regions.append(region)
        subset = [t for t in tokens if left <= t['x'] < right and t['y'] > region['top']]
        h = median([t['height'] for t in subset if t['height'] > 0]) if subset else anchor['height']
        dates = []
        for t in sorted(subset, key=lambda p: p['y']):
            match = re.fullmatch(r'(20\d{2})[-./](\d{1,2})[-./](\d{1,2})', compact(t['text']))
            if match:
                try:
                    parsed = date(*map(int, match.groups())).isoformat()
                    dates.append((t, parsed))
                except ValueError:
                    warnings.append('유효하지 않은 날짜가 있어 원본 확인이 필요합니다.')
        for position, (start, day) in enumerate(dates):
            end = dates[position+1][0]['y']-h*0.5 if position+1 < len(dates) else start['y']+h*3.5
            block = [t for t in subset if start['y']-h*0.5 <= t['y'] < end]
            rows = []
            for t in sorted(block, key=lambda p: (p['y'], p['x'])):
                row = next((r for r in rows if abs(median(p['y'] for p in r)-t['y']) < h*0.55), None)
                if row is None:
                    rows.append([t])
                else:
                    row.append(t)
            lines = [' '.join(p['text'] for p in sorted(r, key=lambda p: p['x'])
                              if not re.fullmatch(r'\d', p['text'])) for r in rows]
            time_value = next((t['text'] for t in block
                               if re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', t['text'])), None)
            details = [line for line in lines[1:] if line and not line.startswith('(총')]
            item = dict(type=kind, date=day, time=time_value, department=None, doctor=None,
                        examination=None, location=None, needs_review=True,
                        source_field_indices=[t['index'] for t in block], source_lines=lines,
                        warnings=[])
            if kind == '진료':
                item['department'] = details[0] if details else None
                item['doctor'] = details[1] if len(details) > 1 else None
                if not all((item['department'], item['doctor'], time_value)):
                    item['warnings'].append('진료 정보가 누락되었을 수 있습니다.')
            else:
                first = sorted(rows[0], key=lambda p: p['x']) if rows else []
                name = [t['text'] for t in first if '검사' in t['text']]
                item['examination'] = ' '.join(name) or None
                # 줄바꿈된 장소도 보존. 임의의 글자 교정은 하지 않음.
                location_parts = []
                for line in lines:
                    if '[' in line:
                        location_parts.append(line[line.index('['):])
                    elif location_parts:
                        location_parts.append(line)
                    if location_parts and ']' in location_parts[-1]:
                        break
                if location_parts:
                    item['location'] = ' '.join(location_parts).split(']')[0].lstrip('[').strip()
                if not item['location']:
                    item['warnings'].append('검사 장소를 확인해 주세요.')
            if any(t['confidence'] < 0.9 for t in block):
                item['warnings'].append('인식 신뢰도가 낮은 글자가 있습니다. 원본과 비교해 주세요.')
            candidates.append(item)
    return {'parser': 'snuh_receipt_v1', 'schedule_candidates': candidates,
            'regions': regions, 'warnings': warnings}


# 네 영역 추출에 사용하는 공통 도구입니다.
def compact_text(value):
    return re.sub(r'\s+', '', value)


def make_tokens(fields):
    result = []
    for index, field in enumerate(fields):
        try:
            points = field['boundingPoly']['vertices']
            xs = [float(p['x']) for p in points]
            ys = [float(p['y']) for p in points]
            if len(xs) < 3 or not all(math.isfinite(v) for v in xs + ys):
                continue
            result.append(dict(index=index, text=str(field.get('inferText', '')).strip(),
                               x=median(xs), y=median(ys), h=max(ys)-min(ys),
                               confidence=float(field.get('inferConfidence', 0))))
        except (KeyError, TypeError, ValueError):
            continue
    return result


def group_rows(tokens):
    """글자 높이를 기준으로 같은 줄을 묶고 왼쪽부터 정렬합니다."""
    rows = []
    for token in sorted(tokens, key=lambda t: (t['y'], t['x'])):
        row = next((r for r in rows if abs(median(t['y'] for t in r)-token['y'])
                    < max(median(t['h'] for t in r), token['h'], 1)*0.55), None)
        if row is None:
            rows.append([token])
        else:
            row.append(token)
    return [sorted(row, key=lambda t: t['x']) for row in rows]


def row_text(row):
    return ''.join(compact_text(t['text']) for t in row)


def candidate(value=None, tokens=None, warnings=None):
    """값과 그 근거를 함께 반환합니다. null은 0이나 미해당을 뜻하지 않습니다."""
    tokens = tokens or []
    messages = list(warnings or [])
    if value is None:
        messages.append('빈칸 또는 미인식입니다. 원본을 확인해 주세요.')
    if any(t['confidence'] < 0.9 for t in tokens):
        messages.append('인식 신뢰도가 낮은 글자가 포함되어 있습니다.')
    return dict(value=value, needs_review=True,
                source_field_indices=[t['index'] for t in tokens],
                raw_text=' '.join(t['text'] for t in tokens), warnings=messages)


def money_value(text):
    """금액 뒤의 합계 기호는 분리하되 글자를 숫자로 추측하지 않습니다."""
    text = compact_text(text)
    match = re.fullmatch(r'(-?\d[\d,]*)([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭]?)', text)
    if not match:
        return None
    digits = match.group(1)
    if ',' in digits and not re.fullmatch(r'-?\d{1,3}(,\d{3})+', digits):
        return None
    return int(digits.replace(',', ''))


def extract_document_info(tokens, registration, payment_heading):
    """상단 표를 행으로 묶고, 라벨 오른쪽 값을 열별로 연결합니다."""
    scale = (payment_heading['x']-registration['x'])/2956
    x_at = lambda x: registration['x']+(x-450)*scale
    top = [t for t in tokens if t['y'] < payment_heading['y']-payment_heading['h']]
    result = {}
    def value_after(key, label, left, right):
        area = [t for t in top if x_at(left) <= t['x'] < x_at(right)]
        rows = group_rows(area)
        target = next((r for r in rows if label in row_text(r)), None)
        if target is None:
            result[key] = candidate()
            return
        # 라벨이 여러 토큰으로 분리되어 있을 수 있습니다.
        joined, stop = '', None
        for i, t in enumerate(target):
            joined += compact_text(t['text'])
            if label in joined:
                stop = i
                break
        values = target[stop+1:] if stop is not None else []
        text = ' '.join(t['text'] for t in values).strip(' :') or None
        result[key] = candidate(text, values)
    value_after('registration_number', '등록번호', 150, 1200)
    value_after('patient_name', '환자성명', 150, 1200)
    value_after('drg_number', '질병군(DRG)번호', 150, 1200)
    value_after('department_and_doctor', '진료과목', 1200, 2300)
    value_after('patient_category', '환자구분', 1200, 2300)
    value_after('assistance_category', '보조구분', 1200, 2300)
    value_after('visit_datetime', '진료일시', 1200, 2300)
    value_after('issue_number', '발행번호', 2300, 3450)
    value_after('support_organization', '지원단체', 2300, 3450)
    value_after('payment_datetime', '수납일시', 2300, 3450)
    value_after('same_day_number', '당일번호', 2300, 3450)
    hospital = [t for t in top if compact_text(t['text']) == '서울대학교병원']
    result['hospital_name'] = candidate(hospital[0]['text'] if hospital else None, hospital[:1])
    title = [t for t in top if t['y'] < registration['y']-registration['h']*2
             and x_at(1000) < t['x'] < x_at(2900)]
    result['document_title'] = candidate(' '.join(t['text'] for t in sorted(title,key=lambda t:t['x'])) or None, title)
    night = [t for t in top if '□야간' in t['text'] or '□공휴일' in t['text']]
    result['night_holiday_printed_text'] = candidate(' '.join(t['text'] for t in night) or None, night,
                                                    ['체크 여부는 OCR 텍스트만으로 확정하지 않습니다.'])
    return result


def extract_payment_info(tokens, registration, heading, schedules):
    """금액 요약과 결제 표를 읽습니다. 출력이 위로 밀린 값은 후보로 표시합니다."""
    scale = (heading['x']-registration['x'])/2956
    x_at = lambda x: registration['x']+(x-450)*scale
    bottom = min((r['top'] for r in schedules['regions']), default=float('inf'))
    region = [t for t in tokens if x_at(2900) < t['x'] and heading['y'] < t['y'] < bottom]
    labels = group_rows([t for t in region if t['x'] < x_at(3470)])
    values = [t for t in region if t['x'] >= x_at(3470)]
    h = median(t['h'] for t in region) if region else 1
    result, used = {}, set()
    specs = [
        ('total_medical_cost','진료비총액',True),
        ('insurer_total','공단부담총액',True),
        ('patient_total','환자부담총액',True),
        ('previously_paid','이미납부한금액',True),
        ('organization_payment','지원단체부담금',True),
        ('organization_discount','지원단체감액',True),
        ('blood_donation_discount','헌혈감액',True),
        ('outpatient_adjustment','외래정산금',True),
        ('vat','부가가치세',True),
        ('amount_due','납부할금액',True),
        ('merchant_number','가맹점번호',False),
        ('masked_card_number','카두번호',False),
        ('card_type','카드종류',False),
        ('approval_number','승인번호',False),
        ('cash_receipt_number','자진발급번호',False),
        ('payment_method_code','결제방법',False),
        ('unpaid_amount','납부하지않은금액',True),
    ]
    for key, label, is_money in specs:
        rows = [r for r in labels if label in row_text(r)]
        if not rows:
            result[key] = candidate()
            continue
        y = median(t['y'] for t in rows[0])
        options = [t for t in values if t['index'] not in used and abs(t['y']-y) <= h*(1.05 if is_money else 0.55)
                   and (not is_money or money_value(t['text']) is not None)]
        options.sort(key=lambda t: abs(t['y']-y))
        if not options:
            result[key] = candidate()
            continue
        t = options[0]; used.add(t['index'])
        warnings = []
        if abs(t['y']-y)>h*0.45:
            warnings.append('라벨과 값의 세로 위치가 어긋나 있습니다. 연결이 맞는지 확인해 주세요.')
        result[key] = candidate(money_value(t['text']) if is_money else t['text'], [t], warnings)
    # 납부한 금액은 현금/카드 줄이 별도로 있고 전체 라벨과 거리가 있습니다.
    for key,label in [('paid_cash','현금'),('paid_card','카드')]:
        label_tokens = [t for t in region if compact_text(t['text'])==label]
        nearby = []
        if label_tokens:
            y=label_tokens[0]['y']
            nearby=sorted([t for t in values if abs(t['y']-y)<h*0.8 and money_value(t['text']) is not None],
                          key=lambda t:abs(t['y']-y))
        result[key]=candidate(money_value(nearby[0]['text']) if nearby else None,nearby[:1])
    # 전체 납부액은 현금 공란을 0으로 가정하여 합산하지 않습니다.
    result['amount_paid']=candidate(None, warnings=['현금·카드 금액을 확인한 뒤 전체 납부액을 확정해 주세요.'])
    result['virtual_account']=candidate(None,warnings=['계좌 영역은 라벨 아래 값을 별도로 확인해야 합니다.'])
    result['cash_refund_signature']=candidate(None,warnings=['서명 여부는 OCR만으로 판정하지 않습니다.'])
    recognized=[t for t in values if t['index'] not in used]
    return result, recognized


def extract_fee_items(tokens, registration, heading):
    """표의 항목 행과 부담금 열을 대조합니다. 빈 셀은 null로 유지합니다."""
    scale=(heading['x']-registration['x'])/2956
    x_at=lambda x:registration['x']+(x-450)*scale
    table=[t for t in tokens if t['y']>heading['y'] and t['x']<x_at(2900)]
    total_anchors=[t for t in table if re.search(r'\d[①②③④]',t['text'])]
    if total_anchors:
        table=[t for t in table if t['y'] <= max(p['y']+p['h']*1.5 for p in total_anchors)]
    rows=group_rows([t for t in table if x_at(300)<t['x']<x_at(800)])
    columns=[('patient_copay',800,1310),('insurer_share',1310,1851),
             ('full_patient_payment',1851,2385),('non_covered',2385,2900)]
    # 항목명은 양식 정의이며 금액은 모두 OCR에서 읽습니다.
    specs=[('진찰료','진찰료'),('입원료 / 1인실','1인실'),('입원료 / 2·3인실','2.3인실'),
           ('입원료 / 4인실 이상','4인실이상'),('식대','식대'),
           ('투약 및 조제료 / 행위료','투약및행위료'),('투약 및 조제료 / 약품비','조제료약품비'),
           ('주사료 / 행위료','행위료'),('주사료 / 약품비','약품비'),
           ('마취료','마취료'),('처치 및 수술료','처치및수술료'),('검사료','검사료'),
           ('영상진단료','영상진단료'),('방사선치료료','방사선치료료'),('치료재료대','치료재료대'),
           ('재활 및 물리치료료','재활및물리치료료'),('정신요법료','정신요법료'),
           ('전혈 및 혈액성분제제료','전혈및혈액성분제제료'),('CT 진단·판독료','CT진단·판독료'),
           ('MRI 진단·판독료','MRI진단·판독료'),('PET 진단·판독료','PET진단.판독료'),
           ('초음파진단료','초음파진단료'),('제증명수수료','제증명수수료'),
           ('보철·교정료','보철·교정료'),('CD 필름','CD필름'),
           ('선별급여','요양급여(선별급여)'),('65세 이상 등 정액','65세이상등정액'),
           ('정액수가 / 요양병원','정액수가(요양병원)'),('정액수가 / 완화의료','정액수가(완화의료)'),
           ('질병군포괄수가','질병군포괄수가'),('기타','타')]
    amounts=[t for t in table if t['x']>=x_at(800) and money_value(t['text']) is not None]
    used_rows=set();used_values=set();items=[]
    for name,label in specs:
        possible=[r for r in rows if label in row_text(r) and id(r) not in used_rows]
        # 짧은 하위 항목은 독립적으로 읽힌 행만 사용합니다.
        if label in ('행위료','약품비','타'):
            possible=[r for r in possible if (row_text(r)==label or (label=='행위료' and row_text(r)=='주사료행위료'))]
        row=possible[0] if possible else []
        if row:used_rows.add(id(row))
        y=median(t['y'] for t in row) if row else None
        h=median(t['h'] for t in row) if row else 1
        item=dict(item_name=name,label_found=bool(row),
                  source_field_indices=[t['index'] for t in row],needs_review=True)
        for key,left,right in columns:
            nearby=[t for t in amounts if y is not None and t['index'] not in used_values
                    and x_at(left)<=t['x']<x_at(right) and abs(t['y']-y)<h*0.65]
            nearby.sort(key=lambda t:abs(t['y']-y))
            if len(nearby)==1:
                used_values.add(nearby[0]['index'])
                item[key]=candidate(money_value(nearby[0]['text']),nearby)
            else:
                item[key]=candidate(None,nearby,
                    ['같은 셀에 여러 금액 후보가 있습니다.'] if len(nearby)>1 else [])
        items.append(item)
    totals={}
    total_tokens=[t for t in amounts if re.search('[①②③④]',t['text'])]
    for key,left,right in columns:
        found=[t for t in total_tokens if x_at(left)<=t['x']<x_at(right)]
        totals[key]=candidate(money_value(found[0]['text']) if len(found)==1 else None,found)
        used_values.update(t['index'] for t in found)
    extra=[t for t in table if '공단추가부담금' in compact_text(t['text'])]
    found=[]
    if extra:
        found=[t for t in amounts if abs(t['y']-extra[0]['y'])<extra[0]['h']*0.7
               and extra[0]['x']<t['x']<extra[0]['x']+scale*600]
    totals['additional_insurer_adjustment']=candidate(money_value(found[0]['text']) if len(found)==1 else None,found)
    used_values.update(t['index'] for t in found)
    totals['ceiling_excess']=candidate()
    unassigned=[t for t in amounts if t['index'] not in used_values]
    return items,totals,unassigned


def extract_receipt(fields):
    """네 영역을 추출하고, 확정하지 못한 OCR 토큰도 보존합니다."""
    schedules=extract_schedules(fields)
    tokens=make_tokens(fields)
    result=dict(parser='snuh_receipt_v2',document_info={},fee_items=[],fee_totals={},
                payment_info={},schedule_candidates=schedules['schedule_candidates'],
                regions=schedules['regions'],warnings=list(schedules['warnings']),needs_review=True)
    registration=next((t for t in tokens if compact_text(t['text'])=='등록번호'),None)
    heading=next((t for t in tokens if compact_text(t['text'])=='금액산정내용'),None)
    if not registration or not heading or heading['x']<=registration['x']:
        result['warnings'].append('기본 정보·진료비 영역의 기준 제목을 찾지 못했습니다.')
        return result
    scale=(heading['x']-registration['x'])/2956
    x_at=lambda x:registration['x']+(x-450)*scale
    top=min(t['y']-t['h']/2 for t in tokens)
    total_rows=[t for t in tokens if re.search(r'\d[①②③④]',t['text'])]
    table_bottom=max((t['y']+t['h']*1.5 for t in total_rows),default=heading['y'])
    result['regions']=[
        dict(type='기본 정보',left=x_at(150),right=x_at(3950),top=top,bottom=heading['y']-heading['h']),
        dict(type='항목별 진료비',left=x_at(150),right=x_at(2900),top=heading['y'],bottom=table_bottom),
        dict(type='금액·결제 정보',left=x_at(2900),right=x_at(3950),top=heading['y'],bottom=table_bottom),
        *schedules['regions']]
    result['document_info']=extract_document_info(tokens,registration,heading)
    result['payment_info'],payment_extra=extract_payment_info(tokens,registration,heading,schedules)
    result['fee_items'],result['fee_totals'],fee_extra=extract_fee_items(tokens,registration,heading)
    result['unassigned_candidates']={
        'fee_table':[dict(text=t['text'],source_field_index=t['index']) for t in fee_extra],
        'payment_area':[dict(text=t['text'],source_field_index=t['index']) for t in payment_extra]}
    result['warnings'].append('서울대 해당 영수증 배치용 초기 규칙입니다. 원본 확인 후 저장해 주세요.')
    return result


if __name__=='__main__':
    if len(sys.argv)!=2:
        raise SystemExit('사용법: python snuh_receipt.py OCR결과.json')
    path=Path(sys.argv[1])
    if not path.is_file():
        raise SystemExit(f'OCR 파일을 찾을 수 없습니다: {path}')
    raw=json.loads(path.read_text(encoding='utf-8-sig'))
    print(json.dumps(extract_receipt(raw['images'][0]['fields']),ensure_ascii=False,indent=2))
