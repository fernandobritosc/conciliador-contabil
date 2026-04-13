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

    const margin = 25;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - 2 * margin;
    const bottomMarginLimit = pageHeight - 30;
    let currentY = margin;

    // --- FUNÇÕES AUXILIARES DE ESTRUTURA ---

    const drawHeader = (isFirstPage: boolean) => {
        doc.setPage(doc.getNumberOfPages());

        if (isFirstPage) {
            // Logotipo ou Brasão (Simulado com um retângulo e iniciais)
            doc.setFillColor(15, 23, 42);
            doc.rect(margin, margin, 15, 15, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('SC', margin + 4.5, margin + 9.5);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text('PREFEITURA MUNICIPAL DE SENADOR CANEDO', margin + 20, margin + 6);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(70, 70, 70);
            doc.text('ESTADO DE GOIÁS | SECRETARIA MUNICIPAL DE FINANÇAS', margin + 20, margin + 11);
            doc.text('Gerência de Contabilidade - Auditoria de Folha de Pagamento', margin + 20, margin + 15);

            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(1);
            doc.line(margin, margin + 22, pageWidth - margin, margin + 22);
            currentY = margin + 35;
        } else {
            // Página 2+ não precisa de cabeçalho especial - começa direto no conteúdo
            currentY = margin + 10;
        }
    };

    const drawFooter = () => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
            doc.text(`Documento extraído via AUDITOR CONTÁBIL / FOLHA - Página ${i} de ${totalPages}`, margin, pageHeight - 12);
            doc.text('Gerência de Contabilidade - SEFAZ', pageWidth - margin, pageHeight - 12, { align: 'right' });
        }
    };

    const checkPageBreak = (heightNeeded: number) => {
        if (currentY + heightNeeded > bottomMarginLimit) {
            doc.addPage();
            drawHeader(false);
            return true;
        }
        return false;
    };

    // Renderiza texto com quebra de linha correta, sem cortar na margem
    const renderWrappedText = (
        text: string,
        font: 'times' | 'helvetica',
        style: 'normal' | 'bold',
        size: number,
        lineHeight: number,
        extraSpacingAfter: number = 0,
        indent: number = 0
    ) => {
        doc.setFont(font, style);
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, usableWidth - indent);
        lines.forEach((line: string, idx: number) => {
            checkPageBreak(lineHeight);
            doc.text(line, margin + indent, currentY);
            currentY += lineHeight;
        });
        currentY += extraSpacingAfter;
    };

    // --- INÍCIO DA RENDERIZAÇÃO ---
    drawHeader(true);

    // Espaço após cabeçalho
    currentY += 5;

    // Título Central
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('NOTA TÉCNICA CONTÁBIL', pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // --- QUADRO DE TRIANGULAÇÃO ---
    if (finalData) {
        checkPageBreak(80);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setFillColor(240, 245, 255);
        doc.rect(margin, currentY, usableWidth, 10, 'F');
        doc.setTextColor(15, 23, 42);
        doc.text('1. DEMONSTRATIVO DE TRIANGULAÇÃO DE VALORES', margin + 4, currentY + 6.5);
        currentY += 12;

        const colW = [usableWidth * 0.30, usableWidth * 0.23, usableWidth * 0.23, usableWidth * 0.24];
        const headers = ['ITEM DE CONFERÊNCIA', 'RH (ORIGEM)', 'CONTÁBIL', 'DARF (PAGO)'];

        // Cabeçalho da tabela
        doc.setFillColor(15, 23, 42);
        doc.rect(margin, currentY, usableWidth, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        
        let colX = margin;
        headers.forEach((h, i) => {
            const isNumeric = i > 0;
            doc.text(h, colX + (isNumeric ? colW[i] - 3 : 3), currentY + 6, { align: isNumeric ? 'right' : 'left' });
            colX += colW[i];
        });
        currentY += 9;

        const formatBrl = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const rows = [
            ['Segurados (Cód. 1082)', formatBrl(finalData.segurados.rh), formatBrl(finalData.retentionData?.valorRetido || 0), formatBrl(finalData.segurados.guia)],
            ['Patronal (Cód. 1138)', formatBrl(finalData.empresa.rh), formatBrl(finalData.liquidacaoData?.valorBruto || 0), formatBrl(finalData.empresa.guia)],
            ['RAT/SAT (Cód. 1646)', formatBrl(finalData.acidente.rh), '(Embutido)', formatBrl(finalData.acidente.guia)],
            ['Deduções (FPAS/SF)', formatBrl(finalData.relatorioData?.deducaoFpas || 0), formatBrl(finalData.liquidacaoData ? (finalData.liquidacaoData.salarioFamilia + finalData.liquidacaoData.salarioMaternidade) : 0), '(Deduzido)'],
            ['TOTAL CONSOLIDADO', formatBrl(finalData.total.rh), formatBrl(finalData.totalContab), formatBrl(finalData.total.guia)]
        ];

        doc.setFontSize(9);
        rows.forEach((row, i) => {
            checkPageBreak(10);
            const isLast = i === rows.length - 1;
            
            if (isLast) {
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(235, 240, 250);
                doc.rect(margin, currentY, usableWidth, 9, 'F');
                doc.setTextColor(15, 23, 42);
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(30, 30, 30);
                if (i % 2 === 1) {
                    doc.setFillColor(250, 252, 255);
                    doc.rect(margin, currentY, usableWidth, 8, 'F');
                }
            }

            let cellX = margin;
            const rowHeight = isLast ? 9 : 8;
            row.forEach((cell, j) => {
                const isNumeric = j > 0;
                doc.text(cell, cellX + (isNumeric ? colW[j] - 3 : 3), currentY + (rowHeight/2 + 1), { align: isNumeric ? 'right' : 'left' });
                
                // Vertical lines
                doc.setDrawColor(200, 210, 225);
                doc.setLineWidth(0.1);
                doc.line(cellX, currentY, cellX, currentY + rowHeight);
                
                cellX += colW[j];
            });
            // End line
            doc.line(margin + usableWidth, currentY, margin + usableWidth, currentY + rowHeight);

            // Horizontal border
            doc.setDrawColor(180, 190, 210);
            doc.setLineWidth(0.2);
            doc.line(margin, currentY + rowHeight, margin + usableWidth, currentY + rowHeight);
            currentY += rowHeight;
        });
        
        currentY += 12;
    }

    // --- CORPO DO TEXTO (PARECER) ---
    doc.setTextColor(0, 0, 0);
    currentY += 5;

    // Remove artefatos e setas quebradas geradas pelas LLMs ou Rich Text,
    // e substitui caracteres Unicode não suportados na codificação WinAnsi do jsPDF
    const cleanHtml = notaTecnicaText
        .replace(/!['"´`°]+/g, '<->')
        .replace(/! /g, '<-> ')
        .replace(/↔/g, '<->')
        .replace(/→/g, '->')
        .replace(/←/g, '<-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/…/g, '...');

    // Usar o DOMParser para navegar no HTML do Parecer
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(`<div>${cleanHtml}</div>`, 'text/html');
    const container = htmlDoc.querySelector('div');

    if (container) {
        // Process ALL tables first, regardless of hierarchy
        const allTables = container.querySelectorAll('table');
        
        if (allTables.length > 0) {
            allTables.forEach((table, tableIndex) => {
                // Skip duplicate tables (Rubrica table that appears after triangulation)
                const firstCellText = table.querySelector('td, th')?.textContent?.trim() || "";
                if (firstCellText === 'Rubrica' || firstCellText === 'RubricaValor (R$)') {
                    return; // Skip this duplicate table
                }
                
                checkPageBreak(35);
                currentY += 8;
                
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length === 0) return;

                // Determine number of columns
                const firstRow = rows[0];
                const cells = Array.from(firstRow.querySelectorAll('td, th'));
                const numCols = cells.length;
                
                if (numCols === 0) return;

                const tableWidth = usableWidth;
                
                // Ajuste dinâmico de largura: primeira coluna tem 45% (geralmente descritiva), outras distribuídas
                const colWidths: number[] = [];
                if (numCols > 1) {
                    const firstColWidth = tableWidth * 0.45;
                    const otherColWidth = (tableWidth - firstColWidth) / (numCols - 1);
                    for (let c = 0; c < numCols; c++) {
                        colWidths.push(c === 0 ? firstColWidth : otherColWidth);
                    }
                } else {
                    colWidths.push(tableWidth);
                }

                // Draw all rows
                rows.forEach((row, rowIdx) => {
                    const rowCells = Array.from(row.querySelectorAll('td, th'));
                    if (rowCells.length === 0) return;

                    const isHeader = rowIdx === 0 || rowCells[0].tagName.toLowerCase() === 'th';
                    doc.setFontSize(isHeader ? 8.5 : 8);

                    // Pre-calcular alturas para textos multi-linhas (splitTextToSize)
                    let maxLines = 1;
                    const cellTexts: string[][] = [];
                    rowCells.forEach((cell, cellIdx) => {
                        // Tratar setas bugadas do DOMParser
                        let rawText = cell.textContent?.trim() || "";
                        const cellText = rawText.replace(/!['|"]/g, '<->').replace(/!/g, '<->');
                        const cWidth = colWidths[cellIdx] || (tableWidth / numCols);
                        const lines = doc.splitTextToSize(cellText, cWidth - 4);
                        cellTexts.push(lines);
                        if (lines.length > maxLines) {
                            maxLines = lines.length;
                        }
                    });

                    const baseHeight = isHeader ? 9 : 8;
                    const rowHeight = maxLines > 1 ? (maxLines * 4) + 4 : baseHeight;
                    
                    checkPageBreak(rowHeight + 2); // Check com a altura calculada da linha

                    // Background
                    if (isHeader) {
                        doc.setFillColor(15, 23, 42);
                        doc.setTextColor(255, 255, 255);
                        doc.setFont('helvetica', 'bold');
                    } else {
                        if (rowIdx % 2 === 1) {
                            doc.setFillColor(250, 252, 255);
                        } else {
                            doc.setFillColor(255, 255, 255);
                        }
                        doc.setTextColor(30, 30, 30);
                        doc.setFont('helvetica', 'normal');
                    }

                    doc.rect(margin, currentY, tableWidth, rowHeight, 'F');

                    let cellX = margin;
                    rowCells.forEach((cell, cellIdx) => {
                        const lines = cellTexts[cellIdx];
                        const cWidth = colWidths[cellIdx] || (tableWidth / numCols);
                        const strTest = lines.join(' ');
                        const isNumeric = /^[-+]?\d{1,3}(\.\d{3})*(\,\d{2})?$|R\$/.test(strTest) && strTest.length < 20;

                        const align = isNumeric ? 'right' : 'left';
                        const textX = cellX + (align === 'right' ? cWidth - 2 : 2);
                        
                        // O método text aceita array de strings e desenha simulando quebra de linha. 
                        // Altura inicial = currentY + margem top.
                        doc.text(lines, textX, currentY + (isHeader ? 6 : 5.5), { align });

                        // Draw cell borders
                        doc.setDrawColor(200, 210, 225);
                        doc.setLineWidth(0.15);
                        doc.rect(cellX, currentY, cWidth, rowHeight);

                        cellX += cWidth;
                    });

                    currentY += rowHeight;
                });

                currentY += 8;
            });

            // Remove tables from HTML so they don't get processed again as text
            allTables.forEach(t => t.remove());
        }

        // Now process remaining elements (paragraphs, lists, etc.)
        // Recursively extract and render elements
        const processElement = (element: Element) => {
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'table') {
                // Already handled above
                return;
            } else if (tagName === 'ul' || tagName === 'ol') {
                const items = Array.from(element.querySelectorAll('li'));
                items.forEach(li => {
                    checkPageBreak(8);
                    const bullet = tagName === 'ul' ? '• ' : '';
                    renderWrappedText(bullet + li.textContent?.trim(), 'times', 'normal', 10, 5.5, 2, 5);
                });
                currentY += 2;
            } else if (tagName === 'p' || tagName === 'div' || tagName.startsWith('h')) {
                const text = element.textContent?.trim() || "";
                if (!text || text.length < 2) return;

                const sectionRegex = /^(\d+\.\s+)?(ASSUNTO|REFERÊNCIA|ANÁLISE|ACHADOS DE AUDITORIA|CONCLUSÃO|RESULTADO DA VERIFICAÇÃO)\s*:?/i;
                
                if (sectionRegex.test(text) || tagName.startsWith('h')) {
                    checkPageBreak(15);
                    currentY += 5;
                    renderWrappedText(text.toUpperCase(), 'helvetica', 'bold', 11, 6, 3);
                    
                    // Desenha uma linha fina sob o título da seção
                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.1);
                    doc.line(margin, currentY - 1, margin + 40, currentY - 1);
                } else {
                    checkPageBreak(10);
                    renderWrappedText(text, 'times', 'normal', 10.5, 5.5, 3);
                }
            }
        };

        Array.from(container.children).forEach(processElement);
    }

    // --- ASSINATURA ---
    checkPageBreak(50);
    currentY += 15;
    
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Senador Canedo (GO), ${dateStr}.`, margin, currentY);

    currentY += 20;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
    
    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('GERÊNCIA DE CONTABILIDADE', pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Secretaria Municipal de Finanças - SEFAZ', pageWidth / 2, currentY, { align: 'center' });

    drawFooter();

    // --- ANEXOS (LISTA) ---
    const validFiles = files.filter((file): file is File | string => file !== null);
    if (validFiles.length > 0) {
        checkPageBreak(30);
        currentY += 8;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('DOCUMENTAÇÃO ANEXA', margin, currentY);
        currentY += 2;
        
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, margin + usableWidth, currentY);
        currentY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        validFiles.forEach(f => {
            const name = typeof f === 'string' ? decodeURIComponent(f.split('/').pop()?.split('?')[0] || 'Documento') : f.name;
            const suffix = typeof f === 'string' ? ' (Online)' : '';
            checkPageBreak(6);
            doc.text(`• ${name}${suffix}`, margin + 5, currentY);
            currentY += 6;
        });
    }

    // --- ANEXOS CONTEÚDO (Imagens/PDFs) ---
    for (const file of validFiles) {
        if (typeof file === 'string') continue;

        try {
            if (file.type === 'application/pdf') {
                const pdfData = await readFileAsArrayBuffer(file);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    doc.addPage();
                    drawHeader(false);

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`ANEXO: ${file.name} (Página ${i} de ${pdf.numPages})`, margin, 15);

                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d')!;
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    const imgData = canvas.toDataURL('image/jpeg', 0.9);

                    const imgWidth = usableWidth;
                    const imgHeight = (canvas.height * usableWidth) / canvas.width;
                    const maxImgHeight = pageHeight - 40;

                    let finalH = imgHeight;
                    let finalW = imgWidth;

                    if (imgHeight > maxImgHeight) {
                        const ratio = maxImgHeight / imgHeight;
                        finalH = maxImgHeight;
                        finalW = imgWidth * ratio;
                    }

                    doc.addImage(imgData, 'JPEG', (pageWidth - finalW) / 2, 25, finalW, finalH);

                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
                    doc.setFontSize(7);
                    doc.text(`Cópia fidedigna do documento original anexo ao processo.`, margin, pageHeight - 10);
                }
            } else if (file.type.startsWith('image/')) {
                doc.addPage();
                drawHeader(false);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`ANEXO: ${file.name}`, margin, 15);

                const imgData = await readFileAsDataURL(file);
                const imgProps = doc.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;

                let finalW = usableWidth;
                let finalH = usableWidth * ratio;
                const maxH = pageHeight - 40;

                if (finalH > maxH) {
                    finalH = maxH;
                    finalW = maxH / ratio;
                }

                doc.addImage(imgData, 'JPEG', (pageWidth - finalW) / 2, 25, finalW, finalH);

                doc.setDrawColor(200, 200, 200);
                doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
                doc.setFontSize(7);
                doc.text(`Cópia fidedigna do documento original anexo ao processo.`, margin, pageHeight - 10);
            }
        } catch (err) {
            console.error(`Erro ao anexar arquivo ${file.name}:`, err);
        }
    }

    doc.save('Parecer_Tecnico_Conciliacao.pdf');
};