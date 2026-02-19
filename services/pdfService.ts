import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { ComparisonResult } from '../types';

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

export const generatePdf = async (notaTecnicaText: string, files: (File | string | null)[], finalData?: ComparisonResult) => {
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

    const checkPageBreak = (heightNeeded: number) => {
        if (currentY + heightNeeded > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            return true;
        }
        return false;
    };

    // --- 1. Header (Manual) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Prefeitura Municipal de Senador Canedo', pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Gerencia de Contabilidade - Sefaz', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PARECER TÉCNICO DE CONCILIAÇÃO PREVIDENCIÁRIA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // --- 2. Quadro de Conformidade (Audit Summary Table) ---
    if (finalData) {
        doc.setFontSize(10);
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, currentY, usableWidth, 7, 'F');
        doc.text('QUADRO DE CONFORMIDADE DA TRIANGULAÇÃO (CONFERÊNCIA TÉCNICA)', margin + 2, currentY + 5);
        currentY += 7; // Header height

        const col1W = usableWidth * 0.35; // Item
        const col2W = usableWidth * 0.20; // RH
        const col3W = usableWidth * 0.20; // Contab
        const col4W = usableWidth * 0.25; // Guia

        const formatBrl = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Table Header
        doc.setFontSize(8);
        doc.setFillColor(220, 220, 220);
        doc.rect(margin, currentY, usableWidth, 7, 'F');
        doc.text('ITEM CONFERIDO', margin + 2, currentY + 5);
        doc.text('RH (RELAÇÃO)', margin + col1W + 2, currentY + 5);
        doc.text('CONTAB. (LIQ/RET)', margin + col1W + col2W + 2, currentY + 5);
        doc.text('DARF (GUIAS)', margin + col1W + col2W + col3W + 2, currentY + 5);
        currentY += 7;

        const tableRows = [
            { label: 'Segurados (Cód. 1082)', rh: finalData.segurados.rh, contab: finalData.retentionData?.valorRetido || 0, darf: finalData.segurados.guia },
            { label: 'Empresa (Cód. 1138)', rh: finalData.empresa.rh, contab: finalData.liquidacaoData ? (finalData.liquidacaoData.valorBruto - finalData.liquidacaoData.salarioFamilia - finalData.liquidacaoData.salarioMaternidade) : 0, darf: finalData.empresa.guia },
            { label: 'GILRAT / Acidente (Cód. 1646)', rh: finalData.acidente.rh, contab: finalData.acidente.rh, darf: finalData.acidente.guia },
            { label: 'Contrib. Individual (Cód. 1099)', rh: 0, contab: 0, darf: finalData.guiaData?.valorContribIndividual || 0 },
            { label: 'Deduções (FPAS / Sal. Família)', rh: finalData.relatorioData?.deducaoFpas || 0, contab: finalData.liquidacaoData ? (finalData.liquidacaoData.salarioFamilia + finalData.liquidacaoData.salarioMaternidade) : 0, darf: 0 },
            { label: 'TOTAL GERAL A RECOLHER', rh: finalData.total.rh, contab: finalData.totalContab + (finalData.guiaData?.valorContribIndividual || 0), darf: finalData.total.guia, isBold: true }
        ];

        doc.setFont('helvetica', 'normal');
        tableRows.forEach((row, index) => {
            const rowH = 7;
            if (index % 2 === 0) doc.setFillColor(250, 250, 250); else doc.setFillColor(255, 255, 255);
            doc.rect(margin, currentY, usableWidth, rowH, 'F');

            if (row.isBold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');

            doc.text(row.label, margin + 2, currentY + 5);
            doc.text(formatBrl(row.rh), margin + col1W + 2, currentY + 5);
            doc.text(row.label.includes('GILRAT') ? '(Embutido)' : formatBrl(row.contab), margin + col1W + col2W + 2, currentY + 5);
            doc.text(row.label.includes('Deduções') && row.darf === 0 ? '(Deduzido)' : formatBrl(row.darf), margin + col1W + col2W + col3W + 2, currentY + 5);

            doc.setDrawColor(200, 200, 200);
            doc.line(margin, currentY + rowH, margin + usableWidth, currentY + rowH);

            currentY += rowH;
        });
        currentY += 10;
    }

    // --- 3. Body Text (Improved Layout) ---
    doc.setFont('times', 'normal');
    doc.setFontSize(12);

    // STRIP HTML: Ensure we only have clean text
    const cleanContent = (() => {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(notaTecnicaText, 'text/html');

        // Replace <p> and <br> with newlines to preserve structure
        const pTags = parsed.querySelectorAll('p, div, br, h1, h2, h3');
        pTags.forEach(tag => {
            if (tag.tagName.toLowerCase() === 'br') {
                tag.parentNode?.replaceChild(document.createTextNode('\n'), tag);
            } else {
                const newline = document.createTextNode('\n\n');
                tag.parentNode?.insertBefore(newline, tag);
            }
        });

        return parsed.body.textContent || parsed.body.innerText || notaTecnicaText;
    })();

    // Split text into paragraphs based on double newlines or single if it looks like a list
    const paragraphs = cleanContent.split(/\n\s*\n/).filter(p => p.trim() !== '');

    for (const p of paragraphs) {
        checkPageBreak(15);
        const text = p.trim();
        if (!text) continue;

        // Detect if it's a heading (all caps or starting with "X. ")
        const isHeading = /^[0-9]\.|^[A-Z\s]{5,}$/.test(text.substring(0, 20)) || text.includes('OBJETIVO') || text.includes('CONCLUSÃO');

        if (isHeading) {
            doc.setFont('times', 'bold');
            doc.setFontSize(13);
            currentY += 4;
            doc.text(text, margin, currentY);
            currentY += 8;

            // Subtle line under main sections
            if (/^[0-9]\./.test(text)) {
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(margin, currentY - 6, margin + 40, currentY - 6);
            }
        } else {
            doc.setFont('times', 'normal');
            doc.setFontSize(11); // Slightly smaller for better flow

            // Clean up text if it has excessive internal newlines
            const cleanParagraph = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
            const lines = doc.splitTextToSize(cleanParagraph, usableWidth);

            doc.text(lines, margin, currentY, { align: 'left', maxWidth: usableWidth });
            currentY += (lines.length * 6) + 4;
        }
    }

    // --- 4. Attachments List ---
    const validFiles = files.filter((file): file is File | string => file !== null);
    if (validFiles.length > 0) {
        checkPageBreak(30);
        currentY += 5;
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, margin + usableWidth, currentY);
        currentY += 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('DOCUMENTAÇÃO ANEXA:', margin, currentY);
        currentY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        validFiles.forEach(f => {
            const name = typeof f === 'string' ? decodeURIComponent(f.split('/').pop()?.split('?')[0] || 'Documento') : f.name;
            const suffix = typeof f === 'string' ? ' (Online)' : '';
            checkPageBreak(6);
            doc.text(`• ${name}${suffix}`, margin + 5, currentY);
            currentY += 6;
        });
    }

    // --- 5. Signature ---
    checkPageBreak(40);
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    currentY += 15;
    doc.setFont('times', 'normal');
    doc.text(`Senador Canedo (GO), ${dateStr}.`, margin, currentY);

    currentY += 25;
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, margin + 80, currentY); // Signature line
    currentY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RESPONSÁVEL PELA AUDITORIA', margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Gerência de Contabilidade - SEFAZ', margin, currentY);


    // --- 6. Footer & Attachments (Images/PDFs) ---
    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    // Add Attachments Content (Images)
    for (const file of validFiles) {
        if (typeof file === 'string') continue;

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

                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    const imgData = canvas.toDataURL('image/jpeg', 0.8);
                    const imgHeight = (canvas.height * usableWidth) / canvas.width;
                    // Check if image fits, otherwise scale or new page (already new page)
                    const maxImgHeight = pageHeight - 40;
                    let finalH = imgHeight;
                    let finalW = usableWidth;

                    if (imgHeight > maxImgHeight) {
                        const ratio = maxImgHeight / imgHeight;
                        finalH = maxImgHeight;
                        finalW = usableWidth * ratio;
                    }

                    doc.addImage(imgData, 'JPEG', margin, 25, finalW, finalH);
                }
            } else if (file.type.startsWith('image/')) {
                doc.addPage();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(`Anexo: ${file.name}`, margin, 15);
                const imgData = await readFileAsDataURL(file);

                // Get proportions
                const imgProps = doc.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const imgHeight = usableWidth * ratio;

                doc.addImage(imgData, 'JPEG', margin, 25, usableWidth, imgHeight);
            }
        } catch (e) {
            console.error(e);
        }
    }

    doc.save('Parecer_Tecnico_Conciliacao.pdf');
};
