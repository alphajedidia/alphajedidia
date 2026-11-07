// Save a generated file (MIDI, WAV, .solfa) through a temporary object URL.

/** Trigger a download of `blob` as `fileName`. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some mobile browsers read the URL after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Download a .solfa text file. */
export function downloadText(text: string, fileName: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName);
}
