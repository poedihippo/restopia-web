import { AxiosResponse } from 'axios';

/**
 * Parses the Content-Disposition header to extract the filename.
 * Fallback to a default name if not found.
 */
function getFilenameFromHeader(contentDisposition: string | undefined, defaultFilename = 'export.xlsx'): string {
  if (!contentDisposition) return defaultFilename;
  
  const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
  if (matches != null && matches[1]) {
    return matches[1].replace(/['"]/g, '');
  }
  
  return defaultFilename;
}

/**
 * Triggers a browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  // Document codes contain "/" (0019/CB/10/2026) — not allowed in file names.
  a.download = filename.replace(/[\/\\]/g, '-');
  
  document.body.appendChild(a);
  a.click();
  
  window.URL.revokeObjectURL(url);
  a.remove();
}

/**
 * Helper to download an Axios response containing a Blob.
 * It will attempt to read the filename from the Content-Disposition header.
 */
export function downloadFileFromResponse(response: AxiosResponse<Blob>, defaultFilename = 'export.xlsx') {
  const contentDisposition = response.headers['content-disposition'];
  const filename = getFilenameFromHeader(contentDisposition, defaultFilename);
  
  downloadBlob(response.data, filename);
}
