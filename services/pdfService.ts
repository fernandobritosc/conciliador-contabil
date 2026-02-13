import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdf.js from a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Helper to read file as ArrayBuffer
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Helper to read file as DataURL
const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const generatePdf = async (notaTecnicaHtml: string, files: (File | null)[]) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - 2 * margin;

    let currentY = margin;

    // --- 1. Render Header ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Prefeitura Municipal de Senador Canedo', pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Gerencia de Contabilidade - Sefaz', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setLineWidth(0.2);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    // --- 2. Render Main Title ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PARECER TÉCNICO DE CONCILIAÇÃO PREVIDENCIÁRIA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // --- 3. Render User's Edited Content Directly ---
    // Pass the HTML string directly to jsPDF, wrapped with necessary styles.
    // This is more reliable than creating and managing a temporary DOM element.
    const styledHtml = `
      <div style="font-family: Times, 'Times New Roman', serif; font-size: 12pt; color: #000000; width: ${usableWidth}mm; text-align: justify;">
        ${notaTecnicaHtml}
      </div>
    `;

    await doc.html(styledHtml, {
        x: margin,
        y: currentY,
        width: usableWidth,
        windowWidth: usableWidth * (96 / 25.4), // approx mm to px conversion
        autoPaging: 'text',
    });
    
    // --- 4. Add Attachments ---
    const validFiles = files.filter((file): file is File => file !== null);
    for (const file of validFiles) {
        try {
            if (file.type === 'application/pdf') {
                const pdfData = await readFileAsArrayBuffer(file);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    doc.addPage();
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text(`Anexo: ${file.name} (Página ${i} de ${pdf.numPages})`, margin, 15);
                    
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d')!;
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    // FIX: The type definitions for this version of pdf.js require the 'canvas'
                    // property in the render parameters, even though it may be redundant.
                    // Adding it satisfies the TypeScript compiler.
                    await page.render({ canvasContext: context, viewport: viewport, canvas: canvas });
                    const imgData = canvas.toDataURL('image/jpeg', 0.9);
                    const imgHeight = (canvas.height * usableWidth) / canvas.width;
                    doc.addImage(imgData, 'JPEG', margin, 25, usableWidth, imgHeight);
                }
            } else if (file.type.startsWith('image/')) {
                doc.addPage();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(`Anexo: ${file.name}`, margin, 15);
                const imgData = await readFileAsDataURL(file);
                const imgProps = doc.getImageProperties(imgData);
                const imgHeight = (imgProps.height * usableWidth) / imgProps.width;
                doc.addImage(imgData, 'JPEG', margin, 25, usableWidth, imgHeight);
            }
        } catch (e) {
            console.error(`Error processing file ${file.name}:`, e);
            doc.addPage();
            doc.setTextColor(255, 0, 0);
            doc.text(`Erro ao processar o anexo: "${file.name}".`, margin, 15);
            doc.setTextColor(0, 0, 0);
        }
    }

    // --- 5. Add Footer to all pages ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        doc.setLineWidth(0.2);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    }

    doc.save('Parecer_Tecnico_Conciliacao.pdf');
};