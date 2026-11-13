/**
 * Downloads a binary Blob as a file with a given default filename.
 * Attempts to parse the Content-Disposition header if available.
 * 
 * @param blob The binary blob returned from Axios response
 * @param defaultFilename Fallback filename if header is missing
 * @param contentDisposition Optional Content-Disposition header string
 */
export function downloadBlob(
  blob: Blob,
  defaultFilename: string,
  contentDisposition?: string
) {
  let filename = defaultFilename;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2]);
    }
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
