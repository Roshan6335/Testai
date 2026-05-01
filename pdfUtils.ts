import * as pdfjsLib from 'pdfjs-dist';

// Setting the worker source to CDN for simplicity in the browser
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts all text from a given PDF file in the browser.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += `[Page ${i}]\n${pageText}\n\n`;
        }

        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = function() {
      reject(new Error("Failed to read file"));
    };

    fileReader.readAsArrayBuffer(file);
  });
}
