import { ColumnType } from './report.service';

/** Display formatting shared by the table, summary tiles and chart (matches the PDF export). */
export function formatValue(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'money':
      return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'int':
      return Number(value).toLocaleString('en-IN');
    case 'decimal':
      return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    case 'percent':
      return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
    case 'date': {
      const s = String(value);
      if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
      return shortDate(s);
    }
    default:
      return String(value);
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Sep 2026" — fixed month names (Intl now prints "Sept" for en-GB/en-IN). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export const isNumeric = (type: ColumnType) => type === 'money' || type === 'int' || type === 'decimal' || type === 'percent';
