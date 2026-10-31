/* Apps Script の SpreadsheetApp などを、テスト用にまねした最小限の作り物 */
'use strict';

const GasMock = (() => {
  let spreadsheet;
  let props;

  class MockRange {
    constructor(sheet, row, col, nRows, nCols) {
      Object.assign(this, { sheet, row, col, nRows, nCols });
    }
    getValues() {
      const out = [];
      for (let r = 0; r < this.nRows; r += 1) {
        const src = this.sheet.data[this.row - 1 + r] || [];
        const row = [];
        for (let c = 0; c < this.nCols; c += 1) {
          const v = src[this.col - 1 + c];
          row.push(v === undefined || v === null ? '' : v instanceof Date ? new Date(v.getTime()) : v);
        }
        out.push(row);
      }
      return out;
    }
    setValues(values) {
      if (values.length !== this.nRows) throw new Error(`setValues: 行数が違う ${values.length} != ${this.nRows}`);
      values.forEach((rowVals, r) => {
        if (rowVals.length !== this.nCols) throw new Error(`setValues: 列数が違う ${rowVals.length} != ${this.nCols}`);
        const rowIndex = this.row - 1 + r;
        this.sheet.data[rowIndex] = this.sheet.data[rowIndex] || [];
        rowVals.forEach((v, c) => {
          this.sheet.data[rowIndex][this.col - 1 + c] = MockRange.store(v);
        });
      });
      return this;
    }
    /** スプレッドシートの自動変換をまねる（' で始まる文字は、そのまま文字として入る） */
    static store(v) {
      if (v instanceof Date) return new Date(v.getTime());
      if (typeof v !== 'string') return v;
      if (v.startsWith("'")) return v.slice(1);
      if (v.startsWith('=')) return '#FORMULA';
      if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
      if (/^\d{1,2}\/\d{1,2}$/.test(v)) return new Date(2026, 0, 1);
      return v;
    }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setNumberFormat() { return this; }
  }

  class MockSheet {
    constructor(name) {
      this.name = name;
      this.data = [];
      this.maxRows = 1000;
    }
    getName() { return this.name; }
    getLastRow() {
      for (let r = this.data.length; r >= 1; r -= 1) {
        const row = this.data[r - 1];
        if (row && row.some((v) => v !== '' && v !== null && v !== undefined)) return r;
      }
      return 0;
    }
    getMaxRows() { return this.maxRows; }
    insertRowsAfter(after, n) { this.maxRows += n; }
    getRange(row, col, nRows = 1, nCols = 1) {
      if (row < 1 || col < 1 || nRows < 1 || nCols < 1) throw new Error(`getRange: 範囲が不正 ${row},${col},${nRows},${nCols}`);
      if (row + nRows - 1 > this.maxRows) throw new Error(`getRange: シートの行数(${this.maxRows})をこえています`);
      return new MockRange(this, row, col, nRows, nCols);
    }
    setFrozenRows() {}
  }

  class MockSpreadsheet {
    constructor() { this.sheets = [new MockSheet('シート1')]; }
    getSheetByName(name) { return this.sheets.find((s) => s.name === name) || null; }
    insertSheet(name) {
      const s = new MockSheet(name);
      this.sheets.push(s);
      return s;
    }
    getSheets() { return this.sheets.slice(); }
    deleteSheet(sheet) { this.sheets = this.sheets.filter((s) => s !== sheet); }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/mock'; }
  }

  function reset() {
    spreadsheet = new MockSpreadsheet();
    props = {};
  }
  reset();

  window.SpreadsheetApp = { getActive: () => spreadsheet, flush() {} };
  window.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
    }),
  };
  window.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  window.Logger = { log() {} };
  window.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text) => ({ text, mime: 'text/plain', setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } }),
  };
  // 呼ぶたびにちがう値を返す（合言葉と見る用の鍵が、同じにならないように）
  let uuidCount = 0;
  window.Utilities = {
    getUuid: () => {
      uuidCount += 1;
      return `${(0x1a2b3c00 + uuidCount).toString(16)}-e89b-42d3-a456-426614174000`;
    },
  };

  return { reset, get spreadsheet() { return spreadsheet; }, get props() { return props; } };
})();
