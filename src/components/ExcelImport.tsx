'use client';

import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';
import { MarketData } from '@/lib/types';

interface ExcelImportProps {
    onImport: (data: MarketData[]) => void;
    onError: (message: string) => void;
}

export default function ExcelImport({ onImport, onError }: ExcelImportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                const parsedData: MarketData[] = [];
                let headerRowIndex = -1;

                // Find header row
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    const rowStr = row.map(cell => String(cell || '').trim());

                    // Check for key columns
                    if (rowStr.some(c => c.includes('產品') || c.includes('代號'))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex !== -1) {
                    const headers = data[headerRowIndex].map(h => String(h || '').trim());

                    // Map headers to indices
                    const codeIdx = headers.findIndex(h => h.includes('代號') || h.includes('Code'));
                    // Fix: Ensure Name column doesn't match Code column (e.g. "產品代號" contains "產品")
                    const nameIdx = headers.findIndex(h =>
                        (h.includes('名稱') || h.includes('品名') || h.includes('Name') || h.includes('產品')) &&
                        !h.includes('代號') && !h.includes('Code')
                    );
                    const varietyIdx = headers.findIndex(h => h.includes('品種') || h.includes('Variety'));
                    const upperIdx = headers.findIndex(h => h.includes('上價'));
                    const middleIdx = headers.findIndex(h => h.includes('中價'));
                    const lowerIdx = headers.findIndex(h => h.includes('下價'));
                    const avgIdx = headers.findIndex(h => h.includes('平均'));
                    const volIdx = headers.findIndex(h => h.includes('量'));

                    // Parse data rows
                    for (let i = headerRowIndex + 1; i < data.length; i++) {
                        const row = data[i];
                        if (!row || row.length === 0) continue;

                        // Skip if no code or name (empty row)
                        if (!row[codeIdx] && !row[nameIdx]) continue;

                        parsedData.push({
                            productCode: codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '',
                            productName: nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '',
                            variety: varietyIdx !== -1 ? String(row[varietyIdx] || '').trim() : '',
                            upperPrice: upperIdx !== -1 ? String(row[upperIdx] || '').trim() : '0',
                            middlePrice: middleIdx !== -1 ? String(row[middleIdx] || '').trim() : '0',
                            lowerPrice: lowerIdx !== -1 ? String(row[lowerIdx] || '').trim() : '0',
                            averagePrice: avgIdx !== -1 ? String(row[avgIdx] || '').trim() : '0',
                            transactionVolume: volIdx !== -1 ? String(row[volIdx] || '').trim() : '0',
                        });
                    }
                } else {
                    // Fallback to index-based if no header found (legacy support)
                    for (let i = 0; i < data.length; i++) {
                        const row = data[i];
                        if (row.length < 7) continue;
                        // Skip if first col looks like header
                        if (String(row[0]).includes('產品')) continue;

                        parsedData.push({
                            productCode: String(row[0] || '').trim(),
                            productName: String(row[1] || '').trim(),
                            upperPrice: String(row[2] || '').trim(),
                            middlePrice: String(row[3] || '').trim(),
                            lowerPrice: String(row[4] || '').trim(),
                            averagePrice: String(row[5] || '').trim(),
                            transactionVolume: String(row[6] || '').trim(),
                        });
                    }
                }

                if (parsedData.length === 0) {
                    onError('Excel 檔案中未發現有效資料。');
                } else {
                    onImport(parsedData);
                }

            } catch (err) {
                console.error('Excel import error:', err);
                onError('解析 Excel 檔案失敗。');
            }
        };
        reader.readAsBinaryString(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
                <Upload size={18} />
                匯入 Excel
            </button>
        </div>
    );
}
