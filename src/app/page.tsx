'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { MarketData, ScrapeResponse } from '@/lib/types';
import { getTodayROCDate, formatROCDateTime, formatROCDate } from '@/lib/utils';
import QuoteTable from '@/components/QuoteTable';
import ExcelImport from '@/components/ExcelImport';
import { Search, Download, Upload, Image, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

export default function Home() {
  const EMPTY_ROW: MarketData = {
    productCode: '',
    productName: '',
    upperPrice: '',
    middlePrice: '',
    lowerPrice: '',
    averagePrice: '',
    transactionVolume: '',
    quantity: '',
    unit: '公斤',
    salesPrice: '',
    subtotal: '',
    remarks: ''
  };

  const [date, setDate] = useState<string>('');
  const [types, setTypes] = useState<string[]>(['Vegetable', 'Fruit']); // Default both types selected
  // Default to 1 empty row
  const [data, setData] = useState<MarketData[]>([EMPTY_ROW]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ isBackup: boolean; date?: string } | null>(null);

  const [productMasterList, setProductMasterList] = useState<MarketData[]>([]);
  const [queryResults, setQueryResults] = useState<MarketData[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // 'all', 'vegetable', 'fruit'
  const [queryTimestamp, setQueryTimestamp] = useState<string>('');

  const [isMarketClosed, setIsMarketClosed] = useState<boolean>(false);
  const [queryStatus, setQueryStatus] = useState<'success' | 'closed' | null>(null);
  const [activeTab, setActiveTab] = useState<'query' | 'detail'>('detail');
  const [queryProgress, setQueryProgress] = useState<number>(0);

  const tableRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const lastValidDate = useRef<string>('');

  // Set default date to today (TW format) on mount
  // Set default date to today (TW format) on mount
  useEffect(() => {
    setDate(getTodayROCDate());
  }, []);

  // Monitor date for Market Closed (Monday)
  React.useEffect(() => {
    if (!date) return;
    const parts = date.split('/');
    // Strict format check: Must be YYY/MM/DD (padded) or similar valid format to accept as "Last Valid"
    if (!/^\d{1,3}\/\d{2}\/\d{2}$/.test(date)) return;
    if (parts.length === 3) {
      const y = parseInt(parts[0]) + 1911;
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      const dateObj = new Date(y, m, d);
      if (!isNaN(dateObj.getTime()) &&
        dateObj.getFullYear() === y &&
        dateObj.getMonth() === m &&
        dateObj.getDate() === d) {
        const isMon = dateObj.getDay() === 1;
        setIsMarketClosed(isMon);
        lastValidDate.current = date;
      }
    }
  }, [date]);

  // Load master list on mount
  React.useEffect(() => {
    const loadMasterList = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const products = await res.json();
          const masterList: MarketData[] = products.map((p: any) => ({
            productCode: p.productCode,
            productName: p.productName,
            category: p.category,
            // Fill required fields with empty strings
            upperPrice: '',
            middlePrice: '',
            lowerPrice: '',
            averagePrice: '',
            transactionVolume: '',
            unit: '公斤'
          }));
          setProductMasterList(masterList);
        }
      } catch (err) {
        console.error('Failed to load product master list:', err);
      }
    };
    loadMasterList();
  }, []);

  // Load initial daily data
  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setQueryProgress(0);

      const intervalId = setInterval(() => {
        setQueryProgress(prev => {
          if (prev >= 90) {
            clearInterval(intervalId);
            return 90;
          }
          return prev + 1;
        });
      }, 1000);

      try {
        const [vegRes, fruitRes] = await Promise.all([
          fetch(`/api/scrape?type=Vegetable&useCache=true`),
          fetch(`/api/scrape?type=Fruit&useCache=true`)
        ]);

        let allData: MarketData[] = [];
        let newestScrapedAt = '';

        const processResult = async (res: Response, type: string) => {
          if (res.ok) {
            const result: ScrapeResponse = await res.json();
            if (result.data) {
              const dataWithCategory = result.data.map(item => ({
                ...item,
                category: type
              }));
              allData = [...allData, ...dataWithCategory];

              if (result.scrapedAt) {
                if (!newestScrapedAt || result.scrapedAt > newestScrapedAt) {
                  newestScrapedAt = result.scrapedAt;
                }
              }
            }
          }
        };

        await processResult(vegRes, 'Vegetable');
        await processResult(fruitRes, 'Fruit');

        if (allData.length > 0) {
          setQueryResults(allData);
        }

        if (newestScrapedAt) {
          if (newestScrapedAt.includes('T')) {
            setQueryTimestamp(formatROCDateTime(newestScrapedAt));
          } else {
            setQueryTimestamp(formatROCDate(newestScrapedAt));
          }
        }

      } catch (e) {
        console.error('Failed to load initial data', e);
      } finally {
        clearInterval(intervalId);
        setQueryProgress(100);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Memoized filtered results for better performance
  const filteredResults = useMemo(() => {
    return queryResults.filter(item => {
      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.productCode?.toLowerCase().includes(term) ||
          item.productName?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [queryResults, categoryFilter, searchTerm]);

  const fetchData = async () => {
    if (types.length === 0) {
      alert('請至少選擇一個類別（蔬菜或水果）');
      return;
    }

    setLoading(true);
    setError(null);
    setBackupInfo(null);
    setIsMarketClosed(false);
    setQueryStatus(null); // Reset status

    try {
      let fetchPromises: Promise<ScrapeResponse>[];

      // Check if the selected date is a Monday
      // Format: 114/12/08 -> Year 114 + 1911 = 2025
      const dateParts = date.split('/');
      const year = parseInt(dateParts[0]) + 1911;
      const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2]);
      const dateObj = new Date(year, month, day);
      const isMonday = dateObj.getDay() === 1;

      // Logic: If Monday, force useCache=true to skip external fetch and use backup
      const useCacheParam = isMonday ? '&useCache=true' : '';

      // Optimization: If both types are selected, use 'all' to fetch in one request
      if (types.includes('Vegetable') && types.includes('Fruit')) {
        fetchPromises = [
          fetch(`/api/scrape?date=${encodeURIComponent(date)}&type=all${useCacheParam}`)
            .then(res => res.json())
        ];
      } else {
        // Otherwise fetch individually (single type)
        fetchPromises = types.map(type =>
          fetch(`/api/scrape?date=${encodeURIComponent(date)}&type=${type}${useCacheParam}`)
            .then(res => res.json())
        );
      }

      setQueryProgress(0);
      // Simulated progress
      const intervalId = setInterval(() => {
        setQueryProgress(prev => {
          if (prev >= 90) {
            clearInterval(intervalId);
            return 90;
          }
          return prev + 1;
        });
      }, 1000);

      const results: ScrapeResponse[] = await Promise.all(fetchPromises).finally(() => {
        clearInterval(intervalId);
        setQueryProgress(100);
      });

      // Check if any result is marked as market closed
      // OR if we forced cache because it was Monday (and we got data or cache status)
      // Actually, if we force cache, backend returns status: 'cache'. 
      // If it's Monday, we should treat it as Market Closed regardless of what backend says?
      // User requirement: "If Monday... Show Red Market Closed".
      const isClosed = results.some(result => result.isMarketClosed) || isMonday;
      setIsMarketClosed(isClosed);

      // Check if any result is backup data
      const backupResult = results.find(result => result.status === 'backup');

      // Check if any request failed (and not just market closed which is handled gracefully)
      const failedResult = results.find(result => result.message && !result.data && !result.isMarketClosed);
      if (failedResult) {
        throw new Error(failedResult.message || '無法取得資料');
      }

      // Merge all data
      let allData: MarketData[] = [];
      let newestScrapedAt = '';

      results.forEach((result) => {
        if (result.data) {
          // If result.type is 'all', data already has category.
          // If result.type is specific (e.g. 'Vegetable'), ensure category is set.
          // Note: Backend 'fresh' data now always includes category, but safely handle backups/legacy.

          let dataToAdd = result.data;

          if (result.type && result.type !== 'all') {
            // For specific types, enforce the category from the response type
            dataToAdd = result.data.map(item => ({
              ...item,
              category: result.type // Ensure category is set to the response type
            }));
          }

          allData = [...allData, ...dataToAdd];

          // Update timestamp from response
          if (result.scrapedAt) {
            if (!newestScrapedAt || result.scrapedAt > newestScrapedAt) {
              newestScrapedAt = result.scrapedAt;
            }
          }
        }
      });

      // Update timestamp display - Use backup timestamp if market closed/backup used
      const timestampToUse = (isClosed || backupResult) ? (newestScrapedAt || '') : (newestScrapedAt || '');

      if (timestampToUse) {
        if (timestampToUse.includes('T')) {
          setQueryTimestamp(formatROCDateTime(timestampToUse));
        } else {
          setQueryTimestamp(formatROCDate(timestampToUse));
        }
      } else {
        setQueryTimestamp(backupResult ? `資料日期: ${backupResult.date}` : `資料日期: ${date}`);
      }


      // Determine Status
      if (isClosed || backupResult) {
        setQueryStatus('closed');
      } else {
        setQueryStatus('success');
        // Only update master list if success (fresh data)
        // Only update master list if success (fresh data)
        // Trigger background update of the master list
        fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: date,
            data: allData
          })
        }).catch(err => console.error('Background list update failed:', err));
      }

      // Set query results to display
      setQueryResults(allData);

      // Check if any result is backup data
      if (backupResult) {
        setBackupInfo({
          isBackup: true,
          date: backupResult.date || ''
        });
      }
    } catch (err: any) {
      setError(err.message || '發生未預期的錯誤');
    } finally {
      setLoading(false);
    }
  };

  /* Helper Functions */
  const handleImport = (importedData: MarketData[]) => {
    // Do NOT populate table with imported data, only update master list
    // setData(importedData);
    setProductMasterList(importedData);
    setBackupInfo(null);
    setError(null);
    alert(`成功匯入 ${importedData.length} 筆產品至自動完成列表。`);
  };

  const handleImportError = (msg: string) => {
    setError(msg);
  };

  const copyInputValues = (original: HTMLElement, clone: HTMLElement) => {
    const originalInputs = original.querySelectorAll('input, select, textarea');
    const clonedInputs = clone.querySelectorAll('input, select, textarea');

    originalInputs.forEach((el, index) => {
      const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const clonedInput = clonedInputs[index] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      // Explicitly set value attribute for inputs
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        clonedInput.value = input.value;
        clonedInput.setAttribute('value', input.value);
      } else if (input.tagName === 'SELECT') {
        clonedInput.value = input.value;
        const options = clonedInput.querySelectorAll('option');
        options.forEach(opt => {
          if (opt.value === input.value) opt.setAttribute('selected', 'true');
        });
      }
    });
  };

  const cleanStyles = (node: HTMLElement) => {
    const inputs = node.querySelectorAll('input, select');
    inputs.forEach((input: any) => {
      input.style.border = 'none';
      input.style.outline = 'none';
      input.style.background = 'transparent';
      input.style.boxShadow = 'none';
      input.style.padding = '0';
      input.style.margin = '0';
      // input.style.width = '100%'; // Removed to preserve original widths (especially for header)
      // input.style.height = 'auto';
      // Ensure text is visible and correctly aligned
      if (input.className.includes('text-right')) {
        input.style.textAlign = 'right';
      } else if (input.className.includes('text-left')) {
        input.style.textAlign = 'left';
      } else if (input.className.includes('text-center')) {
        input.style.textAlign = 'center';
      } else {
        input.style.textAlign = 'left';
      }

      // Remove drop-down arrow for selects and ensure centering
      if (input.tagName === 'SELECT') {
        input.style.appearance = 'none';
        input.style.webkitAppearance = 'none';
        input.style.mozAppearance = 'none';
        input.style.backgroundImage = 'none';
        // Ensure select text is centered
        if (input.className.includes('text-center')) {
          input.style.textAlign = 'center';
          input.style.textAlignLast = 'center';
        }
      }

      // Set uniform font size for all inputs and selects
      input.style.fontSize = '24px';
    });

    // Set uniform font size for all elements (except h1, h2 which are titles)
    const allElements = node.querySelectorAll('*');
    allElements.forEach((el: any) => {
      // Keep titles larger
      if (el.tagName === 'H1') {
        el.style.fontSize = '28px';
      } else if (el.tagName === 'H2') {
        el.style.fontSize = '24px';
      } else if (el.tagName !== 'svg' && el.tagName !== 'path') {
        // Set uniform font size for all other elements
        el.style.fontSize = '24px';
      }
    });

    // Hide add button and delete buttons
    const buttons = node.querySelectorAll('button');
    buttons.forEach((btn: any) => btn.style.display = 'none');

    // Hide any placeholder text in the clone
    const inputsWithPlaceholder = node.querySelectorAll('input::placeholder');
    inputs.forEach((input: any) => {
      input.removeAttribute('placeholder');
    });
  };

  const handleExportPNG = async () => {
    if (!tableRef.current) return;
    try {
      const element = tableRef.current;
      const clone = element.cloneNode(true) as HTMLElement;

      // Manually copy values because cloneNode doesn't copy React state values
      copyInputValues(element, clone);

      clone.style.position = 'absolute';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      // FIX: Full Width Capture
      clone.style.width = 'fit-content';
      clone.style.width = 'fit-content';
      document.body.appendChild(clone);

      cleanStyles(clone);

      // FIX: Remove borders from marked elements for clean export
      const noBorderElements = clone.querySelectorAll('.export-no-border');
      noBorderElements.forEach((el) => {
        (el as HTMLElement).style.border = 'none';
        (el as HTMLElement).style.boxShadow = 'none'; // Ensure no shadow residue
        (el as HTMLElement).style.backgroundColor = 'transparent'; // Optional: ensure transparent bg
      });

      // FIX: Reveal Overflow
      const scrollableDiv = clone.querySelector('.overflow-x-auto');
      if (scrollableDiv) {
        (scrollableDiv as HTMLElement).style.overflow = 'visible';
        (scrollableDiv as HTMLElement).style.width = 'auto';
      }

      // Small delay to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(clone, { cacheBust: true, backgroundColor: '#ffffff' });

      document.body.removeChild(clone);

      const link = document.createElement('a');
      const typeStr = types.length > 0 ? types.join('_') : 'all';
      link.download = `quote_${date.replace(/\//g, '-')}_${typeStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      alert('匯出失敗，請重試。');
    }
  };

  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    try {
      const element = tableRef.current;
      const clone = element.cloneNode(true) as HTMLElement;

      copyInputValues(element, clone);

      clone.style.position = 'absolute';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      // FIX: Full Width Capture
      clone.style.width = 'fit-content';
      // clone.style.minWidth = '1100px';
      document.body.appendChild(clone);

      cleanStyles(clone);

      // FIX: Remove borders from marked elements for clean export
      const noBorderElements = clone.querySelectorAll('.export-no-border');
      noBorderElements.forEach((el) => {
        (el as HTMLElement).style.border = 'none';
        (el as HTMLElement).style.boxShadow = 'none';
        (el as HTMLElement).style.backgroundColor = 'transparent';
      });

      // FIX: Reveal Overflow
      const scrollableDiv = clone.querySelector('.overflow-x-auto');
      if (scrollableDiv) {
        (scrollableDiv as HTMLElement).style.overflow = 'visible';
        (scrollableDiv as HTMLElement).style.width = 'auto';
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture full image
      const imgData = await toPng(clone, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 1.5 // Higher quality for scaling down
      });

      // Original Dimensions
      const imgWidth = clone.offsetWidth;
      const imgHeight = clone.offsetHeight;

      document.body.removeChild(clone);

      // PDF Setup
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentMaxWidth = pdfPageWidth - (margin * 2);
      const contentMaxHeight = pdfPageHeight - (margin * 2);

      // Calculate Scaling (Fit Contain)
      const widthRatio = contentMaxWidth / imgWidth;
      const heightRatio = contentMaxHeight / imgHeight;
      const scale = Math.min(widthRatio, heightRatio); // Use the smaller ratio to ensure fit

      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;

      // Center horizontally/vertically?
      // Usually Top-Left aligned or Horizontally Centered is preferred.
      const x = margin + (contentMaxWidth - finalWidth) / 2;
      const y = margin;

      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');

      // Extract customer name and start date from the form for filename
      let customerName = '';
      let startDate = '';

      // Find all inputs in the clone - wait, clone is gone. Use original element logic or re-query if needed?
      // We can use 'element' to find values since we copied them.
      // Actually simpler to just traverse element now since values match.
      const allInputs = element.querySelectorAll('input');
      allInputs.forEach((input: any) => {
        const value = input.value?.trim();
        if (!value) return;

        // Check the parent div's text content (which includes the span label)
        const parentDiv = input.parentElement;
        if (parentDiv) {
          const parentText = parentDiv.textContent || '';
          // Look for customer name (客戶簡稱)
          if (!customerName && parentText.includes('客戶簡稱')) {
            customerName = value;
          }
        }
      });

      // Extract date from the first table cell (first row, first column)
      // Note: We need to rely on the table structure of the real DOM element
      const firstTableCell = element.querySelector('table tbody tr:first-child td:first-child input');
      if (firstTableCell) {
        startDate = (firstTableCell as HTMLInputElement).value?.trim() || '';
      }

      // Format filename: CustomerNameMMDD.pdf
      // Extract MMDD from date format like "114/12/03" -> "1203"
      let filename = 'quote.pdf';
      if (customerName && startDate) {
        const dateParts = startDate.split('/');
        if (dateParts.length === 3) {
          const monthDay = dateParts[1] + dateParts[2]; // MMDD
          filename = `${customerName}${monthDay}.pdf`;
        } else {
          filename = `${customerName}.pdf`;
        }
      } else if (customerName) {
        filename = `${customerName}.pdf`;
      }

      pdf.save(filename);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. Please try again.');
    }
  };



  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-slate-700">
            楊賢果菜生產合作社
          </h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('query')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${activeTab === 'query'
                ? 'bg-slate-700 hover:bg-slate-800 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              北農每日行情查詢
            </button>
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${activeTab === 'detail'
                ? 'bg-slate-700 hover:bg-slate-800 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              明細表
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'query' ? (
              <div className="space-y-6">
                {/* Controls */}
                <div className="flex flex-wrap gap-4 items-end justify-center">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      日期
                      {isMarketClosed && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">
                          休市
                        </span>
                      )}
                    </label>
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => {
                        // Attempt to open picker programmatically
                        if (dateInputRef.current) {
                          try {
                            dateInputRef.current.showPicker();
                          } catch (e) {
                            // Fallback for older browsers
                            dateInputRef.current.click();
                          }
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg group-hover:bg-slate-100 transition-colors">
                        <span className="text-slate-700 font-medium tracking-wider text-base w-28 text-center select-none">
                          {date || "選擇日期"}
                        </span>
                      </div>
                      <input
                        ref={dateInputRef}
                        type="date"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        value={(() => {
                          if (!date) return '';
                          const parts = date.split('/');
                          if (parts.length === 3) {
                            const y = parseInt(parts[0]) + 1911;
                            const m = String(parts[1]).padStart(2, '0');
                            const d = String(parts[2]).padStart(2, '0');
                            return `${y}-${m}-${d}`;
                          }
                          return '';
                        })()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const [y, m, d] = val.split('-').map(Number);
                          const rocY = y - 1911;
                          const rocM = String(m).padStart(2, '0');
                          const rocD = String(d).padStart(2, '0');
                          setDate(`${rocY}/${rocM}/${rocD}`);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">類別</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (types.includes('Vegetable')) {
                            setTypes(types.filter(t => t !== 'Vegetable'));
                          } else {
                            setTypes([...types, 'Vegetable']);
                          }
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${types.includes('Vegetable')
                          ? 'bg-slate-700 hover:bg-slate-800 text-white shadow-md'
                          : 'bg-white text-slate-700 border border-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        蔬菜
                      </button>
                      <button
                        onClick={() => {
                          if (types.includes('Fruit')) {
                            setTypes(types.filter(t => t !== 'Fruit'));
                          } else {
                            setTypes([...types, 'Fruit']);
                          }
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${types.includes('Fruit')
                          ? 'bg-slate-700 hover:bg-slate-800 text-white shadow-md'
                          : 'bg-white text-slate-700 border border-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        水果
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={fetchData}
                    disabled={loading || types.length === 0 || (() => {
                      if (!date) return false;
                      const parts = date.split('/'); // 113/12/05
                      if (parts.length === 3) {
                        const year = parseInt(parts[0]) + 1911;
                        const month = parseInt(parts[1]) - 1;
                        const day = parseInt(parts[2]);
                        const d = new Date(year, month, day);
                        // 0=Sun, 1=Mon
                        return d.getDay() === 1;
                      }
                      return false;
                    })()}
                    className="p-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed w-10 h-10"
                    title="查詢資料"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                  </button>

                  <div className="w-0"></div>

                  <ExcelImport onImport={handleImport} onError={handleImportError} />
                </div>

                {/* Warning Banner */}
                {backupInfo && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                    <div>
                      <h3 className="font-bold text-amber-800">過期資料警告</h3>
                      <p className="text-amber-700 text-sm">
                        無法取得所選日期的最新資料。顯示 <strong>{backupInfo.date}</strong> 的備份資料。
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0" size={24} />
                    <div>
                      <h3 className="font-bold text-red-800">錯誤</h3>
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  </div>
                )}

                {/* Query Results Table */}
                {/* Changed: Always render the container to show header even if no results yet (for initial status) */}
                <div className="mt-6">
                  {/* Header Row: Title, Status */}
                  <div className="flex items-center justify-start gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                      {/* Status Light Icon */}
                      <div className={`w-3 h-3 rounded-full ${queryStatus === 'closed' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                        queryStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                          'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' // Default/Loading
                        }`} />
                      查詢結果
                    </h2>

                    {/* Right: Timestamp (Moved here) */}
                    <span className="text-sm text-slate-400 font-mono">
                      {queryTimestamp && `(${queryTimestamp})`}
                    </span>
                  </div>

                  {/* Progress Bar (if loading) */}
                  {loading && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-400/50 transition-all duration-300 ease-out"
                          style={{ width: `${queryProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Toolbar Row: Category Filters (Left) + Search (Right) */}
                  <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    {/* Left: Category Filters & Search */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
                      >
                        <option value="all">全部類別</option>
                        <option value="Vegetable">蔬菜</option>
                        <option value="Fruit">水果</option>
                      </select>

                      <input
                        type="text"
                        placeholder="搜尋產品代號或名稱..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                      <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">類別</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">產品代號</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">產品名稱</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">上價</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">中價</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">下價</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">平均價</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">交易量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResults.map((item, index) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.category === 'Vegetable'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                                  }`}>
                                  {item.category === 'Vegetable' ? '蔬菜' : '水果'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{item.productCode}</td>
                              <td className="px-4 py-2 text-slate-800 whitespace-nowrap">{item.productName}</td>
                              <td className="px-4 py-2 text-right text-slate-600">{item.upperPrice}</td>
                              <td className="px-4 py-2 text-right text-slate-600">{item.middlePrice}</td>
                              <td className="px-4 py-2 text-right text-slate-600">{item.lowerPrice}</td>
                              <td className="px-4 py-2 text-right text-slate-800 font-medium">{item.averagePrice}</td>
                              <td className="px-4 py-2 text-right text-slate-600">{item.transactionVolume}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Action Bar (Export) */}
                {data.length > 0 && (
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleExportPNG}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                    >
                      <Image size={18} />
                      匯出 PNG
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                    >
                      <FileText size={18} />
                      匯出 PDF
                    </button>
                  </div>
                )}

                {/* Table Area */}
                <div ref={tableRef} className="bg-white p-1 rounded-xl">
                  <QuoteTable
                    initialData={data}
                    onDataChange={setData}
                    date={date}
                    productMasterList={productMasterList}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
