import ExcelJS from 'exceljs';
import { downloadExcelBuffer } from './excelReport';

export interface CopyToExcelOptions {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  title?: string;
  tableName?: string;
}

/**
 * Copies structured table data to the system clipboard in both TSV and HTML Table formats.
 * When pasted in Microsoft Excel, Google Sheets, or Apple Numbers (Ctrl+V / Cmd+V),
 * all columns, cells, and headers will be neatly formatted and aligned.
 */
export async function copyTableToExcelClipboard({
  headers,
  rows,
  title,
}: CopyToExcelOptions): Promise<boolean> {
  const cleanCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/\t|\r|\n/g, ' ').trim();
  };

  // 1. TSV Format (Standard for spreadsheet paste)
  const tsvRows: string[] = [];
  if (title) {
    tsvRows.push(title);
  }
  tsvRows.push(headers.map(cleanCell).join('\t'));
  for (const row of rows) {
    tsvRows.push(row.map(cleanCell).join('\t'));
  }
  const tsvContent = tsvRows.join('\r\n');

  // 2. HTML Table Format (Excel preserves styling, cell backgrounds, and borders)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: 'TH Sarabun New', 'Cordia New', 'Segoe UI', sans-serif; font-size: 14pt; }
        th { background-color: #2E5B88; color: #FFFFFF; font-weight: bold; border: 1px solid #000000; padding: 6px 10px; text-align: center; }
        td { border: 1px solid #CCCCCC; padding: 5px 8px; }
        .num { text-align: center; }
        .text { text-align: left; }
        .gpa { font-weight: bold; text-align: center; background-color: #F2F7FA; }
        .pass { background-color: #E2EFDA; color: #276A3C; font-weight: bold; text-align: center; }
        .attention { background-color: #FCE4D6; color: #C65911; font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>
      ${title ? `<h3 style="font-family:'TH Sarabun New', sans-serif; font-size:16pt; margin-bottom:8px;">${title}</h3>` : ''}
      <table border="1">
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              ${row
                .map((cell) => {
                  const cleaned = cleanCell(cell);
                  return `<td>${cleaned}</td>`;
                })
                .join('')}
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `.trim();

  // 3. Write to navigator.clipboard with fallback
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
      const textBlob = new Blob([tsvContent], { type: 'text/plain;charset=utf-8' });
      const htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob,
        }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem write failed, falling back to text/plain writeText:', err);
  }

  // Fallback: writeText
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(tsvContent);
      return true;
    }
  } catch (err) {
    console.warn('writeText failed, falling back to textarea execCommand:', err);
  }

  // Fallback: execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = tsvContent;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('All clipboard copy attempts failed:', err);
    return false;
  }
}

/**
 * Exports structured table data directly into a styled .xlsx file
 */
export async function exportTableToXlsxFile({
  filename,
  sheetName = 'Sheet1',
  title,
  headers,
  rows,
}: {
  filename: string;
  sheetName?: string;
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClassCare 360';
  workbook.created = new Date();

  const safeSheetName = sheetName.replace(/[\\/?*\[\]]/g, '').slice(0, 31);
  const ws = workbook.addWorksheet(safeSheetName, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  let currentRow = 1;

  if (title) {
    ws.mergeCells(currentRow, 1, currentRow, headers.length);
    const titleCell = ws.getCell(currentRow, 1);
    titleCell.value = title;
    titleCell.font = { name: 'TH Sarabun New', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    currentRow += 2;
  }

  // Header Row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { name: 'TH Sarabun New', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' }, // Navy Blue
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' },
    };
  });
  headerRow.height = 28;

  // Data Rows
  rows.forEach((r) => {
    const row = ws.addRow(r);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { name: 'TH Sarabun New', size: 13 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
  });

  // Auto-fit Column Widths
  headers.forEach((h, idx) => {
    let maxLen = h.length * 1.5;
    rows.forEach((r) => {
      const s = String(r[idx] ?? '');
      if (s.length > maxLen) maxLen = s.length;
    });
    ws.getColumn(idx + 1).width = Math.min(45, Math.max(12, maxLen + 3));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
