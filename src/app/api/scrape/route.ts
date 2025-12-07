import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getTodayROCDate } from '@/lib/utils';

// Define types for the scraped data
interface MarketData {
    productCode: string;
    productName: string;
    upperPrice: string;
    middlePrice: string;
    lowerPrice: string;
    averagePrice: string;
    transactionVolume: string;
}

interface MOAData {
    交易日期: string;
    種類代碼: string;
    作物代號: string;
    作物名稱: string;
    市場代號: string;
    市場名稱: string;
    上價: number;
    中價: number;
    下價: number;
    平均價: number;
    交易量: number;
}

const BACKUP_DIR = path.join(process.cwd(), 'data');

async function ensureBackupDir() {
    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
}

async function saveBackup(date: string, type: string, data: MarketData[], timestamp?: string) {
    await ensureBackupDir();
    const filename = `backup_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Save with timestamp
    const content = {
        date,
        scrapedAt: timestamp || new Date().toISOString(), // Use provided or current
        data
    };
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
}

async function getLatestBackup(type: string): Promise<{ date: string, scrapedAt?: string, data: MarketData[] } | null> {
    const filename = `backup_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    try {
        const stats = await fs.stat(filePath);
        const contentStr = await fs.readFile(filePath, 'utf-8');
        const content = JSON.parse(contentStr);

        // Use stored scrapedAt or fallback to file modification time
        const scrapedAt = content.scrapedAt || stats.mtime.toISOString();

        // Expecting { date: string, scrapedAt?: string, data: MarketData[] }
        if (content.date && content.data) {
            return {
                ...content,
                scrapedAt
            };
        }
        // Handle legacy format (array only) if exists
        if (Array.isArray(content)) {
            return {
                date: 'Unknown',
                data: content,
                scrapedAt
            };
        }
        return null;
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Format: 114/12/03
    const type = searchParams.get('type') || 'Vegetable'; // 'Vegetable', 'Fruit', or 'all'
    const useCache = searchParams.get('useCache') === 'true';

    // If useCache is true, just return the latest backup without fetching
    // Note: optimization for 'all' with cache is complex, let's keep it simple for now or implement if needed.
    // For now, if type is 'all' and useCache is true, the frontend calls this for initial load? 
    // Actually frontend calls specific types for initial load. 'all' is for query.
    // Let's support 'all' for cache too if possible, but frontend splits it.

    if (useCache) {
        // If type is 'all', we might need to fetch both backups? 
        // For simplicity and to match current usage, let's stick to single type backup or just return null for 'all' cache for now
        // since frontend uses specific types for initial load.
        if (type === 'all') {
            // Not currently used by frontend for initial load, so skipping complex logic.
            return NextResponse.json({ status: 'cache', date: '', type, data: [] });
        }

        const backup = await getLatestBackup(type);
        if (backup) {
            return NextResponse.json({
                status: 'cache',
                date: backup.date,
                type,
                data: backup.data,
                scrapedAt: backup.scrapedAt // Return the stored timestamp
            });
        }
        // No backup available, return empty
        return NextResponse.json({
            status: 'cache',
            date: '',
            type,
            data: []
        });
    }

    if (!date) {
        return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Convert date format: 114/12/03 -> 114.12.03 for API
    const apiDate = date.replace(/\//g, '.');

    try {
        console.log(`Starting fetch for ${date} - ${type}`);

        const apiUrl = new URL('https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx');
        apiUrl.searchParams.append('StartDate', apiDate);
        apiUrl.searchParams.append('EndDate', apiDate);
        apiUrl.searchParams.append('MarketName', '台北一');

        const response = await fetch(apiUrl.toString());

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        // Check if the requested date is Today (Taiwan Time)
        // Check if the requested date is Today (Taiwan Time)
        const todayTW = getTodayROCDate();

        let scrapedAt: string;

        if (date === todayTW) {
            // If today, record full timestamp
            scrapedAt = new Date().toISOString();
        } else {
            // If history, record only the date (Gregorian format for compatibility)
            // Convert 114/12/07 -> 2025-12-07
            const [y, m, d] = (date || '').split('/');
            const gregYear = parseInt(y) + 1911;
            scrapedAt = `${gregYear}-${m}-${d}`;
        }

        const rawData: MOAData[] = await response.json();

        // Filter logic
        let processedData: MarketData[] = [];

        // Helper to process raw items
        const processItems = (items: MOAData[], category: string) => {
            return items.map(item => ({
                productCode: item.作物代號,
                productName: item.作物名稱,
                upperPrice: item.上價.toString(),
                middlePrice: item.中價.toString(),
                lowerPrice: item.下價.toString(),
                averagePrice: item.平均價.toString(),
                transactionVolume: item.交易量.toString(),
                category: category // Add category if 'all'
            }));
        };

        let vegetableData: MarketData[] = [];
        let fruitData: MarketData[] = [];

        if (type === 'Vegetable') {
            vegetableData = processItems(rawData.filter(item => item.種類代碼 === 'N04'), 'Vegetable');
            processedData = vegetableData;
        } else if (type === 'Fruit') {
            fruitData = processItems(rawData.filter(item => item.種類代碼 === 'N05'), 'Fruit');
            processedData = fruitData;
        } else if (type === 'all') {
            vegetableData = processItems(rawData.filter(item => item.種類代碼 === 'N04'), 'Vegetable');
            fruitData = processItems(rawData.filter(item => item.種類代碼 === 'N05'), 'Fruit');
            processedData = [...vegetableData, ...fruitData];
        }

        // ... (check zero data logic) ...
        // Note: If we save backup above, but then find it's "Invalid Zero Data", 
        // we might have overwritten good backup with bad data?
        // Actually, the previous logic (lines 269 in Step 1380, hidden) called saveBackup later.
        // I need to be careful not to save bad data.
        // Original code called `await saveBackup(...)` later?
        // I need to check where `saveBackup` was called in original code.


        // Let's defer saving until validation passes.

        // Re-reading original code...
        // Original code calls `saveBackup` at the END of function.
        // I need to locate where `saveBackup` is called to replace it.
        // Step 1380 only showed up to line 250.
        // I need to read the end of the file.


        // Check first 5 items for zero price
        const checkItems = processedData.slice(0, 5);
        const isInvalidZeroData = checkItems.length > 0 && checkItems.every(item => parseFloat(item.averagePrice) === 0);

        // Check if data is empty or invalid (all zeros). If so, treat as market closed and load backup.
        if (processedData.length === 0 || isInvalidZeroData) {
            console.log(`No data found or Invalid Zero Data for ${date} (Type: ${type}). Attempting to load backup.`);

            // Load backups
            let backupData: MarketData[] = [];
            let loadedDate = '';
            let loadedScrapedAt = '';

            if (type === 'all') {
                const vegBackup = await getLatestBackup('Vegetable');
                const fruitBackup = await getLatestBackup('Fruit');

                if (vegBackup) {
                    // Inject category if missing (for legacy backups)
                    const vegItems = vegBackup.data.map(item => ({
                        ...item,
                        category: (item as any).category || 'Vegetable'
                    }));
                    backupData = [...backupData, ...vegItems];

                    loadedDate = vegBackup.date;
                    loadedScrapedAt = vegBackup.scrapedAt || '';
                }
                if (fruitBackup) {
                    // Inject category if missing
                    const fruitItems = fruitBackup.data.map(item => ({
                        ...item,
                        category: (item as any).category || 'Fruit'
                    }));
                    backupData = [...backupData, ...fruitItems];

                    if (!loadedDate) loadedDate = fruitBackup.date;
                    // If we have a fruit timestamp and no veg timestamp (or fruit is newer?), use it.
                    // For simplicity, if we haven't set loadedScrapedAt yet, set it.
                    if (!loadedScrapedAt) loadedScrapedAt = fruitBackup.scrapedAt || '';
                }
            } else {
                const backup = await getLatestBackup(type);
                if (backup) {
                    // Inject category
                    backupData = backup.data.map(item => ({
                        ...item,
                        category: (item as any).category || type
                    }));
                    loadedDate = backup.date;
                    loadedScrapedAt = backup.scrapedAt || '';
                }
            }

            if (backupData.length > 0) {
                return NextResponse.json({
                    status: 'backup',
                    isMarketClosed: true, // Explicitly mark as closed/backup
                    date: loadedDate,
                    type: type,
                    data: backupData,
                    scrapedAt: loadedScrapedAt
                });
            } else {
                // Even backup is empty?
                return NextResponse.json({
                    status: 'error',
                    message: 'Market closed and no backup data available.',
                    data: []
                });
            }
        }

        // Save backup (Non-blocking)
        // We use Promise.all to fire and forget (but we catch errors to avoid unhandled rejections if we wanted)
        const backupPromises: Promise<void>[] = [];

        if (type === 'Vegetable' && vegetableData.length > 0) {
            backupPromises.push(saveBackup(date, 'Vegetable', vegetableData, scrapedAt));
        } else if (type === 'Fruit' && fruitData.length > 0) {
            backupPromises.push(saveBackup(date, 'Fruit', fruitData, scrapedAt));
        } else if (type === 'all') {
            if (vegetableData.length > 0) backupPromises.push(saveBackup(date, 'Vegetable', vegetableData, scrapedAt));
            if (fruitData.length > 0) backupPromises.push(saveBackup(date, 'Fruit', fruitData, scrapedAt));
        }

        // Execute backups in background without awaiting
        Promise.all(backupPromises).catch(err => console.error('Backup failed:', err));

        return NextResponse.json({
            status: 'fresh',
            date,
            type,
            data: processedData,
            scrapedAt
        });

    } catch (error) {
        console.error('Fetching failed:', error);

        // Try to load the single backup file
        // For 'all', we might try to load both? 
        // For simplicity, if 'all' fails, we might fall back to individual logic or just error.
        // If type is 'all', let's try to fetch both backups

        if (type === 'all') {
            const [vegBackup, fruitBackup] = await Promise.all([
                getLatestBackup('Vegetable'),
                getLatestBackup('Fruit')
            ]);

            // If we have at least one backup
            if (vegBackup || fruitBackup) {
                const combinedBackupData: MarketData[] = [];
                let backupDate = '';
                let scrapedAt = '';

                if (vegBackup) {
                    combinedBackupData.push(...vegBackup.data.map(i => ({ ...i, category: 'Vegetable' })));
                    backupDate = vegBackup.date;
                    scrapedAt = vegBackup.scrapedAt || '';
                }
                if (fruitBackup) {
                    combinedBackupData.push(...fruitBackup.data.map(i => ({ ...i, category: 'Fruit' })));
                    if (!backupDate) backupDate = fruitBackup.date;
                    // simple logic for date/timestamp mixing
                }

                return NextResponse.json({
                    status: 'backup',
                    date: backupDate, // Might be mixed, but usually users query today
                    type,
                    data: combinedBackupData,
                    message: `Fetching failed. Loaded local backup.`,
                    backupDate: backupDate,
                    scrapedAt: scrapedAt,
                    isMarketClosed: error instanceof Error && error.message === 'No data found'
                });
            }
        } else {
            const backup = await getLatestBackup(type);
            if (backup) {
                const isExact = backup.date === date;

                return NextResponse.json({
                    status: 'backup',
                    date: isExact ? date : backup.date,
                    type,
                    data: backup.data,
                    message: isExact
                        ? 'Fetching failed. Loaded local backup for this date.'
                        : `Fetching failed and no backup for ${date}. Loaded latest backup from ${backup.date}.`,
                    backupDate: backup.date,
                    scrapedAt: backup.scrapedAt,
                    isMarketClosed: error instanceof Error && error.message === 'No data found'
                });
            }
        }

        return NextResponse.json({
            status: 'error',
            message: 'Fetching failed and no backup available.'
        }, { status: 500 });
    }
}
