export function encodeCsv(rows: (string | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell ?? '';
          if (/[",\n\r]/.test(v)) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
