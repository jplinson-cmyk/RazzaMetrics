/**
 * Exports data objects to a downloadable CSV file.
 */
export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  data: T[],
  columns?: { key: keyof T; header: string }[]
): void {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const effectiveColumns = columns || Object.keys(data[0]).map(key => ({
    key: key as keyof T,
    header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
  }));

  const headers = effectiveColumns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');

  const rows = data.map(item => {
    return effectiveColumns.map(col => {
      const val = item[col.key];
      if (typeof val === 'number' && !Number.isFinite(val)) return '"Not Available"';
      if (val === null || val === undefined) return '""';
      // Spreadsheet formula injection protection for untrusted queries, URLs and anchors.
      const text = Array.isArray(val) ? val.join('; ') : typeof val === 'object' ? JSON.stringify(val) : String(val);
      const safe = /^[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
      return `"${safe.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${filename}-${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
