/**
 * Academic Print Service
 * Provides flawless, popup-blocker-proof document printing via an invisible iframe.
 * Isolates the target A4 sheet from dark modal containers, scrollbars, and web chrome.
 */

export interface PrintDocumentOptions {
  title: string;
  orientation?: 'portrait' | 'landscape';
  pageMarginMm?: number;
}

export function printElementAsDocument(
  container: HTMLElement | null,
  options: PrintDocumentOptions,
): Promise<boolean> {
  if (!container) {
    window.print();
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const orientation = options.orientation || 'portrait';
      const marginMm = options.pageMarginMm ?? (orientation === 'landscape' ? 6 : 8);

      // Create a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        iframe.remove();
        window.print();
        resolve(false);
        return;
      }

      // Collect all active stylesheets and font links
      const styleTags = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style'),
      )
        .map((node) => node.outerHTML)
        .join('\n');

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${options.title}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 ${orientation};
              margin: ${marginMm}mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: 'Sarabun', 'TH Sarabun New', 'Prompt', serif, sans-serif !important;
              width: 100% !important;
            }
            .no-print,
            button,
            .print-hidden {
              display: none !important;
            }
            .print-page-break,
            .page-break,
            [class*="print:page-break-after-always"] {
              page-break-after: always !important;
              break-after: page !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            /* Reset container widths for printing */
            .w-\\[210mm\\], .min-w-\\[210mm\\],
            .w-\\[297mm\\], .min-w-\\[297mm\\] {
              width: 100% !important;
              min-width: 0 !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body>
          <div class="print-root">
            ${container.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 300);
            });
          </script>
        </body>
        </html>
      `);
      frameDoc.close();

      // Clean up iframe after printing is done
      const cleanup = () => {
        try {
          iframe.remove();
        } catch {}
        resolve(true);
      };

      // In case user cancels or finishes print
      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = cleanup;
      }
      setTimeout(cleanup, 60000);
    } catch (err) {
      console.error('Print service failed, falling back to window.print:', err);
      window.print();
      resolve(false);
    }
  });
}
