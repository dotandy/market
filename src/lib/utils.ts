import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Helper to get a Date object representing the time in Taipei Timezone.
 * Note: This creates a Date object where the headers (Year, Month, etc.) match Taipei time,
 * but the internal UTC timestamp might be shifted. Use mostly for formatting output.
 */
export function getTaiwanDate(date: Date | string = new Date()): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

/**
 * Returns today's date in ROC format (YYY/MM/DD) based on Taiwan time.
 */
export function getTodayROCDate(): string {
    const nowTaipei = getTaiwanDate();
    const year = nowTaipei.getFullYear() - 1911;
    const month = String(nowTaipei.getMonth() + 1).padStart(2, '0');
    const day = String(nowTaipei.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * Formats a given date string (ISO) or Date object to ROC Date string (YYY/MM/DD).
 */
export function formatROCDate(dateInput: string | Date): string {
    if (!dateInput) return '';
    const d = getTaiwanDate(dateInput);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear() - 1911;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * Formats a given date string (ISO) to ROC DateTime string (YYY/MM/DD HH:mm:ss).
 * Uses Taiwan Timezone.
 */
export function formatROCDateTime(dateInput: string | Date): string {
    if (!dateInput) return '';
    const d = getTaiwanDate(dateInput);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear() - 1911;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
