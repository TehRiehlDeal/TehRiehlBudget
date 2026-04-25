import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodeCsv, downloadCsv } from './csv';

describe('encodeCsv', () => {
  it('encodes a plain row', () => {
    expect(encodeCsv([['a', 'b', 'c']])).toBe('a,b,c');
  });

  it('encodes multiple rows separated by newlines', () => {
    expect(encodeCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\nc,d');
  });

  it('quotes a cell containing a comma', () => {
    expect(encodeCsv([['hello, world', 'x']])).toBe('"hello, world",x');
  });

  it('escapes quotes by doubling and wrapping the cell', () => {
    expect(encodeCsv([['he said "hi"', 'x']])).toBe('"he said ""hi""",x');
  });

  it('quotes a cell containing a newline', () => {
    expect(encodeCsv([['line1\nline2', 'x']])).toBe('"line1\nline2",x');
  });

  it('treats null and undefined as empty cells', () => {
    expect(
      encodeCsv([[null as unknown as string, undefined as unknown as string, 'ok']]),
    ).toBe(',,ok');
  });

  it('handles numbers cast to strings', () => {
    expect(encodeCsv([[String(42), String(3.14)]])).toBe('42,3.14');
  });
});

describe('downloadCsv', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    clickSpy = vi.fn();
    createElementSpy = vi.spyOn(document, 'createElement');
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    createElementSpy.mockRestore();
  });

  it('builds a Blob, sets the filename on a temporary anchor, and clicks it', () => {
    const fakeAnchor = {
      href: '',
      download: '',
      click: clickSpy,
    };
    createElementSpy.mockReturnValue(fakeAnchor as unknown as HTMLElement);

    downloadCsv('test.csv', 'a,b\n1,2');

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(fakeAnchor.download).toBe('test.csv');
    expect(fakeAnchor.href).toBe('blob:mock');
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
