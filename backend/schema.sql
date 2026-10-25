-- 환자·문서·확정 일정의 PostgreSQL 구조. 데이터 보존 관계는 RESTRICT/CASCADE 외래 키로 관리한다.
CREATE TABLE IF NOT EXISTS patients (
 id UUID PRIMARY KEY,
 name TEXT NOT NULL CHECK (length(trim(name)) > 0),
 label TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
 id UUID PRIMARY KEY,
 patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
 document_type TEXT NOT NULL, document_date DATE, hospital TEXT NOT NULL DEFAULT '',
 filename TEXT NOT NULL,
 image_mime TEXT NOT NULL CHECK (image_mime IN ('jpeg','png')),
 image_bytes BYTEA NOT NULL CHECK (octet_length(image_bytes) <= 10485760),
 ocr_text TEXT NOT NULL DEFAULT '',
 ocr_fields JSONB NOT NULL DEFAULT '[]',
 ocr_raw_response JSONB NOT NULL DEFAULT '{}',
 parsed_receipt JSONB NOT NULL DEFAULT '{}',
 confirmed BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (NOT confirmed OR (document_date IS NOT NULL AND length(trim(hospital)) > 0))
);
CREATE INDEX IF NOT EXISTS documents_patient_date_idx ON documents(patient_id, document_date);
CREATE TABLE IF NOT EXISTS appointments (
 id UUID PRIMARY KEY,
 document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 appointment_type TEXT NOT NULL CHECK (appointment_type IN ('진료','검사')),
 appointment_date DATE NOT NULL, appointment_time TIME,
 department TEXT NOT NULL DEFAULT '', doctor TEXT NOT NULL DEFAULT '',
 examination TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
 CHECK ((appointment_type = '진료' AND length(trim(department)) > 0)
 OR (appointment_type = '검사' AND length(trim(examination)) > 0))
);
CREATE INDEX IF NOT EXISTS appointments_document_idx ON appointments(document_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(appointment_date);
