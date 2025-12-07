'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Calendar, X } from 'lucide-react';
import { MarketData } from '@/lib/types';
import { cn, getTodayROCDate, formatROCDate } from '@/lib/utils';

interface QuoteTableProps {
    initialData: MarketData[];
    onDataChange: (data: MarketData[]) => void;
    date: string;
    productMasterList?: MarketData[];
}

export default function QuoteTable({ initialData, onDataChange, date, productMasterList = [] }: QuoteTableProps) {
    const [data, setData] = useState<MarketData[]>(initialData);
    const lastValidStart = useRef<string>('');
    const lastValidEnd = useRef<string>('');

    const [printMode, setPrintMode] = useState(false);
    const startDateInputRef = useRef<HTMLInputElement>(null);
    const endDateInputRef = useRef<HTMLInputElement>(null);
    const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
    const [searchResults, setSearchResults] = useState<MarketData[]>([]);
    const searchWrapperRef = useRef<HTMLDivElement>(null);

    // Header States using Shared Util
    const [startDate, setStartDate] = useState(getTodayROCDate());
    const [endDate, setEndDate] = useState(getTodayROCDate());
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // Validation Effect for StartDate
    useEffect(() => {
        if (!startDate) return;
        if (!/^\d{1,3}\/\d{2}\/\d{2}$/.test(startDate)) return;
        const parts = startDate.split('/');
        if (parts.length === 3) {
            const y = parseInt(parts[0]) + 1911;
            const m = parseInt(parts[1]) - 1;
            const d = parseInt(parts[2]);
            const dateObj = new Date(y, m, d);
            if (!isNaN(dateObj.getTime()) &&
                dateObj.getFullYear() === y &&
                dateObj.getMonth() === m &&
                dateObj.getDate() === d) {
                lastValidStart.current = startDate;
            }
        }
    }, [startDate]);

    // Validation Effect for EndDate
    useEffect(() => {
        if (!endDate) return;
        if (!/^\d{1,3}\/\d{2}\/\d{2}$/.test(endDate)) return;
        const parts = endDate.split('/');
        if (parts.length === 3) {
            const y = parseInt(parts[0]) + 1911;
            const m = parseInt(parts[1]) - 1;
            const d = parseInt(parts[2]);
            const dateObj = new Date(y, m, d);
            if (!isNaN(dateObj.getTime()) &&
                dateObj.getFullYear() === y &&
                dateObj.getMonth() === m &&
                dateObj.getDate() === d) {
                lastValidEnd.current = endDate;
            }
        }
    }, [endDate]);

    // Handle click outside to close autocomplete
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Element;
            if (target && !target.closest('.product-search-container')) {
                setActiveSearchIndex(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleChange = (index: number, field: keyof MarketData, value: string) => {
        let newValue = value;

        // Input Validation for Numeric Fields
        if (field === 'quantity' || field === 'salesPrice') {
            // Allow only numbers and one decimal point
            // Remove any character that is not 0-9 or .
            newValue = value.replace(/[^0-9.]/g, '');

            // Prevent multiple decimal points
            const parts = newValue.split('.');
            if (parts.length > 2) {
                // If more than one dot, keep only the first part + dot + rest joined
                // Actually simpler: just ignore the keypress? But here we have the full value string.
                // Reconstruct validation:
                newValue = parts[0] + '.' + parts.slice(1).join('');
            }

            // Limit Sales Price and Quantity to 2 decimal places
            if (field === 'salesPrice' || field === 'quantity') {
                if (!/^\d*\.?\d{0,2}$/.test(newValue)) return;
            }
        }

        const newData = [...data];
        newData[index] = { ...newData[index], [field]: newValue };

        // Auto-calculate subtotal if quantity or salesPrice changes
        if (field === 'quantity' || field === 'salesPrice') {
            const qVal = newData[index].quantity;
            const pVal = newData[index].salesPrice;

            if (!qVal || !pVal) {
                newData[index].subtotal = '';
            } else {
                const qty = parseFloat(qVal);
                const price = parseFloat(pVal);
                if (!isNaN(qty) && !isNaN(price)) {
                    const sub = qty * price;
                    newData[index].subtotal = sub === 0 ? '0' : Math.round(sub).toString();
                }
            }
        }

        // Autocomplete Logic for Product Name
        if (field === 'productName' && productMasterList.length > 0) {
            setActiveSearchIndex(index);
            const term = newValue.toLowerCase();
            if (term) {
                // Limit to 10 results and deduplicate
                const uniqueResults = [];
                const seenCodes = new Set();

                for (const p of productMasterList) {
                    if (
                        (p.productCode && p.productCode.toLowerCase().includes(term)) ||
                        (p.productName && p.productName.toLowerCase().includes(term)) ||
                        (p.variety && p.variety.toLowerCase().includes(term))
                    ) {
                        if (!seenCodes.has(p.productCode)) {
                            seenCodes.add(p.productCode);
                            uniqueResults.push(p);
                        }
                    }
                    if (uniqueResults.length >= 10) break;
                }
                setSearchResults(uniqueResults);
            } else {
                setSearchResults([]);
            }
        }

        setData(newData);
        onDataChange(newData);
    };

    const handleSelectProduct = (index: number, product: MarketData) => {
        const newData = [...data];
        let formattedName = product.productName;
        if (formattedName.includes('-')) {
            formattedName = formattedName.replace('-', '(') + ')';
        } else if (product.variety) {
            formattedName = `${formattedName}(${product.variety})`;
        }

        newData[index] = {
            ...newData[index],
            productName: formattedName,
            // Optionally fill other fields if needed, but user mainly asked for Name(Variety)
            // We could also fill price defaults if we wanted to be fancy
        };

        setData(newData);
        onDataChange(newData);
        setActiveSearchIndex(null);
    };

    const handleDelete = (index: number) => {
        const newData = data.filter((_, i) => i !== index);
        setData(newData);
        onDataChange(newData);
    };

    const handleAddRow = () => {
        const newRow: MarketData = {
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
        const newData = [...data, newRow];
        setData(newData);
        onDataChange(newData);
    };

    const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = new Date(e.target.value);
        if (!isNaN(selectedDate.getTime())) {
            const twDate = formatROCDate(selectedDate);
            setStartDate(twDate);
            setEndDate(twDate);
        }
    };

    const handleEndDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = new Date(e.target.value);
        if (!isNaN(selectedDate.getTime())) {
            setEndDate(formatROCDate(selectedDate));
        }
    };

    // Calculate Total Amount
    const totalAmount = data.reduce((sum, item) => {
        const sub = parseFloat(item.subtotal || '0');
        return sum + (isNaN(sub) ? 0 : sub);
    }, 0);



    // Calculate Total Weight (in KG)
    const totalWeight = data.reduce((sum, item) => {
        const qty = parseFloat(item.quantity || '0');
        if (isNaN(qty)) return sum;

        let factor = 1;
        switch (item.unit) {
            case '公克': factor = 0.001; break;
            case '台斤': factor = 0.6; break;
            case '公斤': default: factor = 1; break;
        }
        return sum + (qty * factor);
    }, 0);

    const inputClass = "w-full bg-white border border-gray-400 rounded px-2 py-0.5 focus:ring-2 focus:ring-emerald-500 outline-none text-center font-normal font-inherit text-black";
    const headerInputClass = "bg-white border-2 border-gray-800 rounded px-2 py-0.5 focus:ring-2 focus:ring-emerald-500 outline-none font-normal text-lg mx-1 font-inherit";
    const dateDisplayClass = "export-no-border bg-white border-2 border-gray-800 rounded px-2 py-0.5 font-normal text-lg font-inherit cursor-pointer select-none hover:bg-slate-50 transition-colors";

    return (
        <div className="w-full bg-white p-4 min-h-[800px] text-black" style={{ fontFamily: '"BiauKai", "Kaiti TC", "楷體-繁", "標楷體", "DFKai-SB", "STKaiti", serif' }}>
            {/* Header */}
            <div className="text-center mb-3">
                <h1 className="text-3xl font-normal tracking-widest mb-2">義庄合作農場</h1>
                <h2 className="text-2xl font-normal tracking-widest">明細表</h2>
            </div>

            {/* Content Wrapper */}
            <div className="w-full overflow-x-auto pb-4">
                <table className="w-full text-lg border-collapse min-w-[1000px]">
                    <thead>
                        {/* Row 1: Date and Customer ID */}
                        <tr className="border-b-4 border-black text-lg font-normal">
                            <td colSpan={8} className="py-1">
                                <div className="flex justify-start items-center gap-4">
                                    <div className="flex items-center gap-0.5">
                                        <span>貨單日期：</span>
                                        <div
                                            className="relative group cursor-pointer"
                                            onClick={() => {
                                                if (startDateInputRef.current) {
                                                    try {
                                                        startDateInputRef.current.showPicker();
                                                    } catch (e) {
                                                        startDateInputRef.current.click();
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-center px-1 bg-transparent rounded">
                                                <span className={`${dateDisplayClass} w-[120px] text-center`}>
                                                    {startDate}
                                                </span>
                                            </div>
                                            <input
                                                ref={startDateInputRef}
                                                type="date"
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                value={(() => {
                                                    if (!startDate) return '';
                                                    const parts = startDate.split('/');
                                                    if (parts.length === 3) {
                                                        const y = parseInt(parts[0]) + 1911;
                                                        const m = String(parts[1]).padStart(2, '0');
                                                        const d = String(parts[2]).padStart(2, '0');
                                                        return `${y}-${m}-${d}`;
                                                    }
                                                    return '';
                                                })()}
                                                onChange={handleDateSelect}
                                            />
                                        </div>
                                        <span className="mx-0.5">至</span>
                                        <div
                                            className="relative group cursor-pointer"
                                            onClick={() => {
                                                if (endDateInputRef.current) {
                                                    try {
                                                        endDateInputRef.current.showPicker();
                                                    } catch (e) {
                                                        endDateInputRef.current.click();
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-center px-1 bg-transparent rounded">
                                                <span className={`${dateDisplayClass} w-[120px] text-center`}>
                                                    {endDate}
                                                </span>
                                            </div>
                                            <input
                                                ref={endDateInputRef}
                                                type="date"
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                value={(() => {
                                                    if (!endDate) return '';
                                                    const parts = endDate.split('/');
                                                    if (parts.length === 3) {
                                                        const y = parseInt(parts[0]) + 1911;
                                                        const m = String(parts[1]).padStart(2, '0');
                                                        const d = String(parts[2]).padStart(2, '0');
                                                        return `${y}-${m}-${d}`;
                                                    }
                                                    return '';
                                                })()}
                                                onChange={handleEndDateSelect}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center">
                                        <span className="mr-1">客戶編號：</span>
                                        <input
                                            type="text"
                                            value={customerId}
                                            onChange={(e) => setCustomerId(e.target.value)}
                                            className={headerInputClass}
                                            style={{ width: '80px' }}
                                        />
                                    </div>
                                </div>
                            </td>
                        </tr>

                        {/* Row 2: Customer Info (Restored) */}
                        <tr className="border-b-4 border-black text-lg font-normal">
                            <td colSpan={8} className="py-1">
                                <div className="flex flex-col gap-1 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <span>客戶編號：</span>
                                        <input
                                            type="text"
                                            value={customerId}
                                            onChange={(e) => setCustomerId(e.target.value)}
                                            className={headerInputClass}
                                            style={{ width: '80px' }}
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <span>客戶簡稱：</span>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className={headerInputClass}
                                            style={{ width: '150px' }}
                                        />
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <tr className="border-b border-black">
                            <th className="py-1 text-center w-36 whitespace-nowrap">貨單日期</th>
                            <th className="py-1 text-center whitespace-nowrap">貨品名稱</th>
                            <th className="py-1 text-center w-24 whitespace-nowrap">數量</th>
                            <th className="py-1 text-center w-20 whitespace-nowrap">單位</th>
                            <th className="py-1 text-center w-24 whitespace-nowrap">售價</th>
                            <th className="py-1 text-center w-24 whitespace-nowrap">小計</th>
                            <th className="py-1 text-center pl-4 w-auto whitespace-nowrap">備註</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, index) => (
                            <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 relative">
                                <td className="py-1 pr-2 whitespace-nowrap">
                                    <input
                                        type="text"
                                        value={index === 0 ? startDate : ''}
                                        readOnly
                                        className="w-full bg-transparent outline-none text-black text-center"
                                    />
                                </td>
                                <td className="py-1 pr-2 relative whitespace-nowrap product-search-container">
                                    <input
                                        type="text"
                                        value={row.productName}
                                        onChange={(e) => handleChange(index, 'productName', e.target.value)}
                                        onFocus={() => setActiveSearchIndex(index)}
                                        className={`${inputClass} text-left min-w-[200px]`}
                                        placeholder="代號/品名/品種"
                                    />
                                    {/* Autocomplete Dropdown */}
                                    {activeSearchIndex === index && searchResults.length > 0 && (
                                        <div className="absolute z-50 left-0 top-full w-full bg-white border border-gray-300 shadow-lg rounded-md mt-1 max-h-48 overflow-y-auto">
                                            {searchResults.map((result, rIndex) => (
                                                <div
                                                    key={rIndex}
                                                    className="px-3 py-1 hover:bg-emerald-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                                                    onClick={() => handleSelectProduct(index, result)}
                                                >
                                                    <div className="font-normal text-black">
                                                        {result.productName.includes('-')
                                                            ? result.productName.replace('-', '(') + ')'
                                                            : result.productName}
                                                        {result.variety && !result.productName.includes('-') && <span className="text-black">({result.variety})</span>}
                                                    </div>
                                                    <div className="text-xs text-black">
                                                        {result.productCode}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="py-1 pr-2">
                                    <input
                                        type="text"
                                        value={row.quantity}
                                        onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val)) {
                                                handleChange(index, 'quantity', val.toFixed(2));
                                            }
                                        }}
                                        className={`${inputClass} text-right`}
                                    />
                                </td>
                                <td className="py-1 pr-2 text-center">
                                    <select
                                        value={row.unit}
                                        onChange={(e) => handleChange(index, 'unit', e.target.value)}
                                        className={`${inputClass} text-center appearance-none cursor-pointer`}
                                        style={{ textAlignLast: 'center' }}
                                    >
                                        <option value="公斤">公斤</option>
                                        <option value="公克">公克</option>
                                        <option value="台斤">台斤</option>
                                    </select>
                                </td>
                                <td className="py-1 pr-2">
                                    <input
                                        type="text"
                                        value={row.salesPrice}
                                        onChange={(e) => handleChange(index, 'salesPrice', e.target.value)}
                                        className={`${inputClass} text-right`}
                                    />
                                </td>
                                <td className="py-1 text-right pr-2 font-normal">
                                    {row.subtotal}
                                </td>
                                <td className="py-1 pl-2 whitespace-nowrap">
                                    <input
                                        type="text"
                                        value={row.remarks}
                                        onChange={(e) => handleChange(index, 'remarks', e.target.value)}
                                        className={`${inputClass} text-center min-w-[150px]`}
                                    />
                                </td>
                                <td className="text-center">
                                    {index > 0 && (
                                        <button
                                            onClick={() => handleDelete(index)}
                                            className="text-slate-600 hover:text-slate-800 transition-colors p-1"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-4 border-b-4 border-black font-normal text-lg">
                            <td className="py-1 text-center whitespace-nowrap">總計</td>
                            <td className="py-1"></td>
                            <td className="py-1 text-right pr-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={totalWeight === 0 ? '0' : totalWeight.toFixed(2)}
                                    className="w-full bg-transparent border border-transparent px-2 text-right font-inherit text-black focus:outline-none"
                                />
                            </td>
                            <td className="py-1 text-center pr-2 whitespace-nowrap">公斤</td>
                            <td className="py-1 text-right"></td>
                            <td className="py-1 text-right pr-2">{totalAmount}</td>
                            <td colSpan={2} className="py-1"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-8 flex justify-center print:hidden">
                <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors border-2 border-slate-700"
                >
                    <Plus size={20} />
                    新增項目
                </button>
            </div>
        </div >
    );
}
