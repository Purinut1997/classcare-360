import ExcelJS from 'exceljs';
import { formatThaiOfficialDate, formatThaiOfficialDateTime, type OfficialReportSignature } from './officialReport';

export interface ExcelSheetConfig {
  sheetName: string;
  title: string;
  subtitle?: string;
  documentCode: string;
  columns: string[];
  rows: any[][];
}

export interface ExcelReportConfig {
  schoolName: string;
  classroomName?: string;
  dateFrom: string;
  dateTo: string;
  academicYear?: string;
  identity: { schoolLogoDataUrl?: string; schoolName?: string; classroomName?: string; academicYear?: string };
  signatures?: OfficialReportSignature[];
  sheets: ExcelSheetConfig[];
}

function parseBase64Image(dataUrl: string) {
  const matches = dataUrl.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return null;
  }
  return {
    extension: matches[1] === 'jpeg' ? 'jpeg' : matches[1] === 'png' ? 'png' : 'png',
    base64: matches[2],
  };
}

export async function generateExcelReportBuffer(config: ExcelReportConfig): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClassCare 360';
  workbook.created = new Date();

  let logoImageId: number | null = null;
  if (config.identity?.schoolLogoDataUrl) {
    const parsedImage = parseBase64Image(config.identity.schoolLogoDataUrl);
    if (parsedImage) {
      logoImageId = workbook.addImage({
        base64: parsedImage.base64,
        extension: parsedImage.extension as any,
      });
    }
  }

  for (const sheetConfig of config.sheets) {
    // Excel sheet names max length is 31 chars
    const safeSheetName = sheetConfig.sheetName.replace(/[\\/?*\[\]]/g, '').slice(0, 31);
    const ws = workbook.addWorksheet(safeSheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape', margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } }
    });

    // We will use 10 columns for the header layout structure by default
    // If the data table has more columns, we will span accordingly
    const totalCols = Math.max(10, sheetConfig.columns.length);
    
    // Set default column widths slightly wider
    for (let i = 1; i <= totalCols; i++) {
      ws.getColumn(i).width = 12;
    }

    let currentRow = 1;

    // --- HEADER SECTION ---
    
    // Add Logo (spans A1:B4)
    if (logoImageId !== null) {
      ws.addImage(logoImageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 80, height: 80 },
      });
    }

    // Title
    ws.mergeCells(currentRow, 3, currentRow, totalCols);
    const titleCell = ws.getCell(currentRow, 3);
    titleCell.value = sheetConfig.title;
    titleCell.font = { name: 'TH Sarabun New', size: 18, bold: true, color: { argb: 'FF0F2742' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    // School Name
    ws.mergeCells(currentRow, 3, currentRow, totalCols);
    const schoolCell = ws.getCell(currentRow, 3);
    schoolCell.value = config.identity?.schoolName || config.schoolName;
    schoolCell.font = { name: 'TH Sarabun New', size: 14, bold: true, color: { argb: 'FF164E63' } };
    schoolCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    // Subtitle
    if (sheetConfig.subtitle) {
      ws.mergeCells(currentRow, 3, currentRow, totalCols);
      const subtitleCell = ws.getCell(currentRow, 3);
      subtitleCell.value = sheetConfig.subtitle;
      subtitleCell.font = { name: 'TH Sarabun New', size: 12, color: { argb: 'FF475569' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      currentRow++;
    } else {
      currentRow++;
    }

    // Empty row for spacing
    currentRow++;
    currentRow++; // Move below the logo area

    // --- META SECTION ---
    ws.mergeCells(currentRow, 1, currentRow, Math.floor(totalCols / 2));
    const metaClassroom = ws.getCell(currentRow, 1);
    metaClassroom.value = `ชั้น/หน่วยงาน: ${config.classroomName || config.identity?.classroomName || '-'}`;
    metaClassroom.font = { name: 'TH Sarabun New', size: 12 };

    ws.mergeCells(currentRow, Math.floor(totalCols / 2) + 1, currentRow, totalCols);
    const metaDocCode = ws.getCell(currentRow, Math.floor(totalCols / 2) + 1);
    metaDocCode.value = `รหัสเอกสาร: ${sheetConfig.documentCode}`;
    metaDocCode.font = { name: 'TH Sarabun New', size: 12 };
    metaDocCode.alignment = { horizontal: 'right' };
    currentRow++;

    ws.mergeCells(currentRow, 1, currentRow, Math.floor(totalCols / 2));
    const metaDate = ws.getCell(currentRow, 1);
    metaDate.value = `ช่วงข้อมูล: ${formatThaiOfficialDate(config.dateFrom)} ถึง ${formatThaiOfficialDate(config.dateTo)}`;
    metaDate.font = { name: 'TH Sarabun New', size: 12 };

    ws.mergeCells(currentRow, Math.floor(totalCols / 2) + 1, currentRow, totalCols);
    const metaYear = ws.getCell(currentRow, Math.floor(totalCols / 2) + 1);
    metaYear.value = `ปีการศึกษา: ${config.identity?.academicYear || config.academicYear || '-'}`;
    metaYear.font = { name: 'TH Sarabun New', size: 12 };
    metaYear.alignment = { horizontal: 'right' };
    currentRow++;

    currentRow++; // Spacing before table

    // --- TABLE SECTION ---
    
    // Headers
    const headerRow = ws.getRow(currentRow);
    sheetConfig.columns.forEach((colName, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = colName;
      cell.font = { name: 'TH Sarabun New', size: 12, bold: true, color: { argb: 'FF0F2742' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F2742' } },
        left: { style: 'thin', color: { argb: 'FFDBE3EC' } },
        bottom: { style: 'thin', color: { argb: 'FFDBE3EC' } },
        right: { style: 'thin', color: { argb: 'FFDBE3EC' } }
      };
    });
    currentRow++;

    // Data Rows
    sheetConfig.rows.forEach((rowData, rowIndex) => {
      const row = ws.getRow(currentRow);
      const isEven = rowIndex % 2 === 1; // 0-indexed, so 1 is the 2nd row (even visually)
      
      rowData.forEach((val, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = val;
        cell.font = { name: 'TH Sarabun New', size: 11 };
        cell.alignment = { vertical: 'top', wrapText: true };
        
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        
        cell.border = {
          left: { style: 'thin', color: { argb: 'FFDBE3EC' } },
          bottom: { style: 'thin', color: { argb: 'FFDBE3EC' } },
          right: { style: 'thin', color: { argb: 'FFDBE3EC' } }
        };
      });
      currentRow++;
    });

    currentRow++; // Spacing after table

    // --- SIGNATURES SECTION ---
    if (config.signatures && config.signatures.length > 0) {
      currentRow++;
      const sigRow = ws.getRow(currentRow);
      
      // Calculate spacing for up to 3 signatures
      const sigsToPrint = config.signatures.slice(0, 3);
      const colsPerSig = Math.floor(totalCols / sigsToPrint.length);
      
      sigsToPrint.forEach((sig, idx) => {
        const startCol = (idx * colsPerSig) + 1;
        const endCol = startCol + colsPerSig - 1;
        
        ws.mergeCells(currentRow, startCol, currentRow, endCol);
        const cell1 = ws.getCell(currentRow, startCol);
        cell1.value = 'ลงชื่อ ................................................';
        cell1.font = { name: 'TH Sarabun New', size: 12 };
        cell1.alignment = { horizontal: 'center' };
        
        ws.mergeCells(currentRow + 1, startCol, currentRow + 1, endCol);
        const cell2 = ws.getCell(currentRow + 1, startCol);
        cell2.value = `(${sig.name || '................................................'})`;
        cell2.font = { name: 'TH Sarabun New', size: 12 };
        cell2.alignment = { horizontal: 'center' };
        
        ws.mergeCells(currentRow + 2, startCol, currentRow + 2, endCol);
        const cell3 = ws.getCell(currentRow + 2, startCol);
        cell3.value = sig.role;
        cell3.font = { name: 'TH Sarabun New', size: 12 };
        cell3.alignment = { horizontal: 'center' };
      });
      
      currentRow += 3;
    }

    // --- FOOTER SECTION ---
    currentRow++;
    ws.mergeCells(currentRow, 1, currentRow, Math.floor(totalCols / 2));
    const footerLeft = ws.getCell(currentRow, 1);
    footerLeft.value = `พิมพ์จากระบบ ClassCare 360 · ${formatThaiOfficialDateTime(new Date())}`;
    footerLeft.font = { name: 'TH Sarabun New', size: 10, color: { argb: 'FF666666' } };

    ws.mergeCells(currentRow, Math.floor(totalCols / 2) + 1, currentRow, totalCols);
    const footerRight = ws.getCell(currentRow, Math.floor(totalCols / 2) + 1);
    footerRight.value = `${sheetConfig.documentCode} · แผ่น 1`;
    footerRight.font = { name: 'TH Sarabun New', size: 10, color: { argb: 'FF666666' } };
    footerRight.alignment = { horizontal: 'right' };
    
    // Auto-fit column widths based on content length
    sheetConfig.columns.forEach((colName, index) => {
      let maxLength = colName.length * 1.5;
      sheetConfig.rows.forEach((row) => {
        const valStr = String(row[index] || '');
        if (valStr.length > maxLength) maxLength = valStr.length;
      });
      // Cap at 40 width
      ws.getColumn(index + 1).width = Math.min(40, Math.max(10, maxLength));
    });
  }

  return await workbook.xlsx.writeBuffer();
}

export function downloadExcelBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
