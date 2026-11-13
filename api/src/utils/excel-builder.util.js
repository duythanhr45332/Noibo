const ExcelJS = require('exceljs');

/**
 * Utility class to build formatted Excel workbooks for VPCC system.
 */
class ExcelBuilder {
  /**
   * Generates an ExcelJS Workbook from structured column definitions and data rows.
   * 
   * @param {Object} options
   * @param {string} [options.sheetName='Sheet1']
   * @param {string} [options.title] Optional main title displayed on top of the sheet
   * @param {Array<{header: string, key: string, alignment?: string, minWidth?: number, maxWidth?: number, formatter?: Function, numFormat?: string}>} options.columns
   * @param {Array<Object>} options.data
   * @returns {Promise<ExcelJS.Workbook>}
   */
  static async createWorkbook({ sheetName = 'Danh sách', title, columns, data = [] }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VPCC System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    let startRow = 1;

    // Optional Title Header Row
    if (title) {
      worksheet.mergeCells(1, 1, 1, columns.length);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = title.toUpperCase();
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;
      startRow = 3; // Leave row 2 as spacing
    }

    // Set Table Column Headers
    const headerRow = worksheet.getRow(startRow);
    headerRow.height = 26;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' }, // Dark slate background
      };
      cell.alignment = { vertical: 'middle', horizontal: col.alignment || 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });

    // Populate Data Rows
    data.forEach((rowItem, rIdx) => {
      const rowNum = startRow + 1 + rIdx;
      const row = worksheet.getRow(rowNum);
      row.height = 22;

      // Alternating row background for readability
      const isEven = rIdx % 2 === 0;
      const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF9FAFB';

      columns.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        let rawVal = rowItem[col.key];

        if (col.formatter) {
          rawVal = col.formatter(rawVal, rowItem, rIdx);
        }

        cell.value = rawVal !== undefined && rawVal !== null ? rawVal : '';
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: col.alignment || 'left' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };

        if (col.numFormat) {
          cell.numFmt = col.numFormat;
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    // Auto Column Width Calculation
    columns.forEach((col, cIdx) => {
      let maxLen = col.header.length;
      data.forEach((rowItem, rIdx) => {
        let val = rowItem[col.key];
        if (col.formatter) {
          val = col.formatter(val, rowItem, rIdx);
        }
        if (val !== undefined && val !== null) {
          const strLen = String(val).length;
          if (strLen > maxLen) maxLen = strLen;
        }
      });
      const calcWidth = Math.min(Math.max(maxLen + 4, col.minWidth || 12), col.maxWidth || 50);
      worksheet.getColumn(cIdx + 1).width = calcWidth;
    });

    return workbook;
  }

  /**
   * Helper to write workbook directly to an Express HTTP response stream.
   * 
   * @param {Object} res Express Response Object
   * @param {ExcelJS.Workbook} workbook
   * @param {string} filename Output file name (e.g. 'danh-sach-ho-so.xlsx')
   */
  static async sendResponse(res, workbook, filename) {
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  }
}

module.exports = ExcelBuilder;
