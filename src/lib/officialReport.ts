import type { SchoolReportIdentity } from './scheduleSettings';

export type OfficialReportOrientation = 'portrait' | 'landscape';

export interface OfficialReportSignature {
  name?: string | null;
  role: string;
}

export function escapeOfficialHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseLocalDate(value: string | Date) {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
}

export function formatThaiOfficialDate(value: string | Date | null | undefined, fallback = '-') {
  if (!value) return fallback;
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).format(date);
}

export function formatThaiOfficialShortDate(value: string | Date | null | undefined, fallback = '-') {
  if (!value) return fallback;
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).format(date);
}

export function formatThaiOfficialDateTime(value: string | Date = new Date()) {
  const date = parseLocalDate(value);
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

export function buildOfficialDocumentCode(prefix: string, dateFrom: string, suffix?: string | null) {
  const year = Number(dateFrom.slice(0, 4));
  const buddhistYear = Number.isFinite(year) ? year + 543 : new Date().getFullYear() + 543;
  const month = dateFrom.slice(5, 7) || '00';
  const normalizedSuffix = String(suffix || '')
    .replace(/[^0-9A-Za-zก-๙]/g, '')
    .slice(0, 12);
  return [prefix.toUpperCase(), buddhistYear, month, normalizedSuffix].filter(Boolean).join('-');
}

export function maskThaiCitizenId(value: unknown, reveal = false) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 13);
  if (!digits) return '-';
  if (reveal && digits.length === 13) return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
  return digits.length === 13 ? `${digits[0]}-xxxx-xxxxx-xx-${digits[12]}` : 'ข้อมูลไม่ครบ 13 หลัก';
}

export function buildOfficialReportCss({
  dense = false,
  marginMm = 10,
  orientation = 'landscape',
}: {
  dense?: boolean;
  marginMm?: number;
  orientation?: OfficialReportOrientation;
} = {}) {
  const safeMarginMm = Math.max(6, marginMm);
  return `
    @font-face { font-family: "TH Sarabun New"; font-style: normal; font-weight: 400; src: url("/fonts/THSarabun.ttf") format("truetype"); }
    @font-face { font-family: "TH Sarabun New"; font-style: normal; font-weight: 700; src: url("/fonts/THSarabun-Bold.ttf") format("truetype"); }
    @page { margin: ${safeMarginMm}mm; size: A4 ${orientation}; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    html { background: #dfe3e8; }
    body { background: #dfe3e8; }
    body { color: #0f172a; font-family: "TH Sarabun New", "Sarabun", "Noto Sans Thai", Tahoma, sans-serif; font-size: ${dense ? '10pt' : '12.5pt'}; line-height: 1.15; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, h3, p { margin: 0; }
    .official-sheet {
      background: #fff;
      display: flex;
      flex-direction: column;
      margin: 6mm auto;
      min-height: ${orientation === 'landscape' ? `${210 - (safeMarginMm * 2)}mm` : `${297 - (safeMarginMm * 2)}mm`};
      padding-bottom: 7mm;
      position: relative;
      width: ${orientation === 'landscape' ? `${297 - (safeMarginMm * 2)}mm` : `${210 - (safeMarginMm * 2)}mm`};
    }
    .official-header {
      align-items: center;
      border-bottom: ${dense ? '.9mm' : '1.2mm'} solid #0891b2;
      display: grid;
      gap: ${dense ? '6px' : '10px'};
      grid-template-columns: ${dense ? '18mm 1fr 18mm' : '23mm 1fr 23mm'};
      padding: ${dense ? '0 1.5mm 1.5mm' : '0 2mm 2.5mm'};
      position: relative;
      text-align: center;
    }
    .official-header::after {
      background: #a3e635;
      border-radius: 99px;
      bottom: ${dense ? '-.9mm' : '-1.2mm'};
      content: "";
      height: ${dense ? '.9mm' : '1.2mm'};
      left: 0;
      position: absolute;
      width: ${dense ? '14mm' : '18mm'};
    }
    .official-logo-frame {
      align-items: center;
      background: #fff;
      border-radius: 50%;
      display: flex;
      height: ${dense ? '16mm' : '20mm'};
      justify-content: center;
      margin: 0 auto;
      overflow: hidden;
      width: ${dense ? '16mm' : '20mm'};
    }
    .official-logo {
      background: #fff;
      border-radius: 50%;
      display: block;
      height: ${dense ? '15mm' : '19mm'};
      object-fit: contain;
      width: ${dense ? '15mm' : '19mm'};
    }
    .official-logo-placeholder {
      align-items: center;
      border: 1px solid #555;
      border-radius: 50%;
      display: flex;
      font-size: ${dense ? '7.5pt' : '8.5pt'};
      height: ${dense ? '14mm' : '17mm'};
      justify-content: center;
      margin: 0 auto;
      text-align: center;
      width: ${dense ? '14mm' : '17mm'};
    }
    .official-title {
      color: #0f2742;
      font-size: ${dense ? '15pt' : '18pt'};
      font-weight: 700;
      line-height: 1.05;
    }
    .official-school {
      color: #164e63;
      font-size: ${dense ? '12pt' : '14.5pt'};
      font-weight: 700;
      margin-top: ${dense ? '.4mm' : '.8mm'};
    }
    .official-subtitle {
      color: #475569;
      font-size: ${dense ? '10pt' : '12pt'};
      margin-top: ${dense ? '.3mm' : '.6mm'};
    }
    .official-meta {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 2mm;
      display: grid;
      font-size: ${dense ? '9pt' : '11.5pt'};
      gap: ${dense ? '.8mm 6mm' : '1.2mm 8mm'};
      grid-template-columns: 1fr 1fr;
      margin: ${dense ? '1.5mm 0 2mm' : '2.5mm 0 3mm'};
      padding: ${dense ? '1.2mm 2.5mm' : '2mm 3mm'};
    }
    .official-meta > div:nth-child(even) { text-align: right; }
    .official-section-title { border-bottom: 1px solid #555; font-size: 13.5pt; font-weight: 700; margin: 2.5mm 0 1.2mm; padding-bottom: .6mm; }
    .official-table { border: 1px solid #cbd5e1; border-collapse: separate; border-radius: 2mm; border-spacing: 0; overflow: hidden; table-layout: fixed; width: 100%; }
    .official-table th, .official-table td { border: 0; border-bottom: 1px solid #dbe3ec; border-right: 1px solid #dbe3ec; font-size: ${dense ? '9pt' : '11pt'}; padding: ${dense ? '1mm 1mm' : '1.5mm 1.5mm'}; vertical-align: top; word-break: break-word; }
    .official-table tr > :last-child { border-right: 0; }
    .official-table tbody tr:last-child > *, .official-table tfoot tr:last-child > * { border-bottom: 0; }
    .official-table th { background: #e6f7fb; color: #0f2742; font-weight: 700; text-align: center; }
    .official-table thead th { border-top: .8mm solid #0f2742; }
    .official-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .official-table tbody tr:nth-child(even) th { background: #e6f7fb; color: #0f2742; }
    .official-table tfoot td { background: #e6f7fb; color: #0f2742; font-weight: 700; }
    .official-center { text-align: center; }
    .official-right { text-align: right; }
    .official-nowrap { white-space: nowrap; }
    
    /* บล็อกรับรองและลายเซ็น: ป้องกันการหักครึ่งหรือแยกหน้า 100% */
    .official-closing-block {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      margin-top: ${dense ? '1.5mm' : '2.5mm'};
    }
    .official-certification {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-left: 1.4mm solid #0891b2;
      border-radius: 2mm;
      break-inside: avoid !important;
      color: #134e4a;
      font-size: ${dense ? '9pt' : '11pt'};
      margin-top: ${dense ? '1.2mm' : '2.5mm'};
      page-break-inside: avoid !important;
      padding: ${dense ? '1mm 2.5mm' : '1.8mm 3mm'};
    }
    .official-signatures {
      break-inside: avoid !important;
      display: grid;
      font-size: ${dense ? '9.5pt' : '11pt'};
      gap: ${dense ? '6mm' : '8mm'};
      grid-template-columns: repeat(3, 1fr);
      margin: ${dense ? '3mm 6mm 0' : '6mm 8mm 0'};
      page-break-inside: avoid !important;
      text-align: center;
    }
    .official-signature-item, .official-signatures > div {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .official-signature-prompt {
      white-space: nowrap;
    }
    .official-signature-line {
      border-bottom: 1px dotted #333;
      display: inline-block;
      min-width: ${dense ? '32mm' : '38mm'};
    }
    .official-signature-name {
      margin-top: ${dense ? '.6mm' : '1mm'};
      white-space: nowrap;
    }
    .official-signature-role {
      color: #334155;
      font-size: ${dense ? '9pt' : '10pt'};
      font-weight: 600;
      margin-top: ${dense ? '.3mm' : '.5mm'};
      white-space: nowrap;
    }
    .official-footer {
      border-top: .8px solid #cbd5e1;
      bottom: 0;
      break-inside: avoid !important;
      color: #64748b;
      display: flex;
      font-size: ${dense ? '7.5pt' : '8.5pt'};
      justify-content: space-between;
      left: 0;
      page-break-inside: avoid !important;
      padding-top: .8mm;
      position: absolute;
      right: 0;
    }
    .official-page-number::after { content: counter(page); }
    .official-kpi-grid {
      display: grid;
      gap: ${dense ? '1.5mm' : '2mm'};
      grid-template-columns: repeat(4, 1fr);
      margin: ${dense ? '1.5mm 0 2mm' : '2.5mm 0'};
    }
    .official-kpi {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 2mm;
      padding: ${dense ? '1.2mm 2mm' : '2mm'};
      text-align: center;
    }
    .official-kpi span { display: block; font-size: ${dense ? '8.5pt' : '10pt'}; }
    .official-kpi strong { display: block; font-size: ${dense ? '13pt' : '15pt'}; margin-top: ${dense ? '.4mm' : '.8mm'}; }
    .official-decision { border: 1px solid #555; min-height: 18mm; padding: 2mm 3mm; }
    tr { break-inside: avoid; }
    @media screen { .official-sheet { box-shadow: 0 2mm 7mm rgba(15, 23, 42, .18); } }
    @media print {
      html, body { background: #fff; }
      .official-sheet {
        box-shadow: none;
        margin: 0 auto;
        padding-bottom: 7mm;
      }
      .official-closing-block,
      .official-signatures,
      .official-signature-item,
      .official-signatures > div,
      .official-certification,
      .official-footer {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  `;
}

export function buildOfficialHeaderHtml({
  classroomName,
  dateFrom,
  dateTo,
  documentCode,
  identity,
  schoolName,
  subtitle,
  title,
}: {
  classroomName?: string | null;
  dateFrom: string;
  dateTo: string;
  documentCode: string;
  identity: SchoolReportIdentity;
  schoolName: string;
  subtitle?: string;
  title: string;
}) {
  const logo = identity.schoolLogoDataUrl
    ? `<img class="official-logo" src="${escapeOfficialHtml(identity.schoolLogoDataUrl)}" alt="ตราโรงเรียน" />`
    : '<div class="official-logo-placeholder">ตรา<br />โรงเรียน</div>';
  return `
    <header class="official-header">
      <div class="official-logo-frame">${logo}</div>
      <div>
        <h1 class="official-title">${escapeOfficialHtml(title)}</h1>
        <div class="official-school">${escapeOfficialHtml(identity.schoolName || schoolName)}</div>
        ${subtitle ? `<div class="official-subtitle">${escapeOfficialHtml(subtitle)}</div>` : ''}
      </div>
      <div></div>
    </header>
    <section class="official-meta">
      <div>ชั้น/หน่วยงาน: ${escapeOfficialHtml(classroomName || identity.classroomName || '-')}</div>
      <div>รหัสเอกสาร: ${escapeOfficialHtml(documentCode)}</div>
      <div>ช่วงข้อมูล: ${escapeOfficialHtml(formatThaiOfficialDate(dateFrom))} ถึง ${escapeOfficialHtml(formatThaiOfficialDate(dateTo))}</div>
      <div>ปีการศึกษา: ${escapeOfficialHtml(identity.academicYear || '-')}</div>
    </section>`;
}

export function buildOfficialSignaturesHtml(signatures: OfficialReportSignature[]) {
  return `<section class="official-signatures">${signatures.slice(0, 3).map((signature) => `
    <div class="official-signature-item">
      <div class="official-signature-prompt">ลงชื่อ <span class="official-signature-line"></span></div>
      <div class="official-signature-name">(${escapeOfficialHtml(signature.name || '................................................')})</div>
      <div class="official-signature-role">${escapeOfficialHtml(signature.role)}</div>
    </div>`).join('')}</section>`;
}

export function buildOfficialFooterHtml({
  confidential = false,
  documentCode,
  generatedAt = new Date(),
}: {
  confidential?: boolean;
  documentCode: string;
  generatedAt?: Date;
}) {
  return `<footer class="official-footer">
    <span>${confidential ? 'ข้อมูลส่วนบุคคล ใช้ภายในสถานศึกษา · ' : ''}พิมพ์จากระบบ ClassCare 360 · ${escapeOfficialHtml(formatThaiOfficialDateTime(generatedAt))}</span>
    <span>${escapeOfficialHtml(documentCode)} · หน้า <span class="official-page-number"></span></span>
  </footer>`;
}
