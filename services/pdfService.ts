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

export const generatePdf = async (notaTecnicaHtml: string, files: (File | string | null)[], finalData?: ComparisonResult) => {
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PARECER TÉCNICO DE CONCILIAÇÃO PREVIDENCIÁRIA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // --- 2. Quadro de Conformidade (Audit Summary Table) ---
    if (finalData) {
        doc.setFontSize(10);
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, currentY, usableWidth, 7, 'F');
        doc.text('QUADRO DE CONFORMIDADE DA TRIANGULAÇÃO (CONFERÊNCIA TÉCNICA)', margin + 2, currentY + 5);
        currentY += 10;

        const colWidth = usableWidth / 4;
        const rowHeight = 7;
        const formatBrl = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Table Header
        doc.setFontSize(8);
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, currentY, usableWidth, rowHeight, 'F');
        doc.text('ITEM CONFERIDO', margin + 2, currentY + 5);
        doc.text('RH (RELAÇÃO)', margin + colWidth + 2, currentY + 5);
        doc.text('CONTAB. (LIQ/RET)', margin + colWidth * 2 + 2, currentY + 5);
        doc.text('DARF (GUIAS)', margin + colWidth * 3 + 2, currentY + 5);
        currentY += rowHeight;

        const tableRows = [
            { label: 'Segurados (Cód. 1082)', rh: finalData.segurados.rh, contab: finalData.retentionData?.valorRetido || 0, darf: finalData.segurados.guia },
            { label: 'Empresa (Cód. 1138)', rh: finalData.empresa.rh, contab: finalData.liquidacaoData ? (finalData.liquidacaoData.valorBruto - finalData.liquidacaoData.salarioFamilia - finalData.liquidacaoData.salarioMaternidade) : 0, darf: finalData.empresa.guia },
            { label: 'GILRAT / Acidente (Cód. 1646)', rh: finalData.acidente.rh, contab: finalData.acidente.rh, darf: finalData.acidente.guia },
            { label: 'Contrib. Individual (Cód. 1099)', rh: 0, contab: 0, darf: finalData.guiaData?.valorContribIndividual || 0 },
            { label: 'Deduções (FPAS / Sal. Família)', rh: finalData.relatorioData?.deducaoFpas || 0, contab: finalData.liquidacaoData ? (finalData.liquidacaoData.salarioFamilia + finalData.liquidacaoData.salarioMaternidade) : 0, darf: 0 },
            { label: 'TOTAL GERAL A RECOLHER', rh: finalData.total.rh, contab: finalData.totalContab + (finalData.guiaData?.valorContribIndividual || 0), darf: finalData.total.guia, isBold: true }
        ];

        tableRows.forEach(row => {
            if (row.isBold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
            doc.line(margin, currentY, margin + usableWidth, currentY);
            doc.text(row.label, margin + 2, currentY + 5);
            doc.text(formatBrl(row.rh), margin + colWidth + 2, currentY + 5);
            doc.text(row.label.includes('GILRAT') ? '(Embutido)' : formatBrl(row.contab), margin + colWidth * 2 + 2, currentY + 5);
            doc.text(row.label.includes('Deduções') && row.darf === 0 ? '(Deduzido)' : formatBrl(row.darf), margin + colWidth * 3 + 2, currentY + 5);
            currentY += rowHeight;
        });
        doc.line(margin, currentY, margin + usableWidth, currentY);
        doc.setFont('helvetica', 'bold');
        currentY += 10;
    }

    // --- 3. Render Technical Note Content with Formal Closure ---
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Repositioning Attachments List to the end of note
    const validFiles = files.filter((file): file is File | string => file !== null);
    const attachmentsHtml = validFiles.length > 0
        ? `<div style="margin-top: 15mm; border-top: 1pt solid #eee; padding-top: 5mm; page-break-inside: avoid;">
            <p style="font-weight: bold; font-size: 11pt; margin-bottom: 3mm;">DOCUMENTAÇÃO ANEXA:</p>
            <ul style="font-size: 10pt; color: #555; padding-left: 5mm; list-style-type: none;">
                ${validFiles.map(f => {
            const name = typeof f === 'string' ? decodeURIComponent(f.split('/').pop()?.split('?')[0] || 'Documento') : f.name;
            const suffix = typeof f === 'string' ? ' (Online)' : '';
            return `<li>• ${name}${suffix}</li>`;
        }).join('')}
            </ul>
           </div>`
        : '';

    // Fixed container with 13pt font and adjusted line-height
    const styledHtml = `
      <div style="font-family: Times, 'Times New Roman', serif; font-size: 13pt; color: #000000; width: ${usableWidth}mm; text-align: justify; line-height: 1.5; padding-bottom: 5mm;">
        ${notaTecnicaHtml}
        
        ${attachmentsHtml}

        <div style="margin-top: 25mm; display: block; border: none; page-break-inside: avoid;">
          <p>Senador Canedo (GO), ${dateStr}.</p>
          <br/><br/><br/>
          <div style="width: 100mm; border-top: 1pt solid #000; padding-top: 3mm; margin-top: 5mm;">
            <p style="font-weight: bold; margin: 0; font-size: 12pt;">RESPONSÁVEL PELA AUDITORIA</p>
            <p style="font-size: 10pt; color: #333; margin: 0;">Gerência de Contabilidade - SEFAZ</p>
          </div>
        </div>
      </div>
    `;

    await doc.html(styledHtml, {
        x: margin,
        y: currentY,
        width: usableWidth,
        windowWidth: 800, // Fixed resolution for better text wrapping
        margin: [margin, margin, 35, margin], // [top, left, bottom, right]
        autoPaging: 'text',
    });

    // Reset currentY after HTML render (this is approximate because doc.html handles pages)
    // For attachments, we usually want them on new pages anyway.

    // --- 4. Add Attachments ---
    for (const file of validFiles) {
        if (typeof file === 'string') continue; // Skip online files for now

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

                    // Ensure white background (prevents transparency turning black in JPEG)
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    // FIX: The type definitions for this version of pdf.js require the 'canvas'
                    // property in the render parameters, even though it may be redundant.
                    // Adding it satisfies the TypeScript compiler.
                    await page.render({ canvasContext: context, viewport: viewport, canvas: canvas }).promise;
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