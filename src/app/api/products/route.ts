import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    const dataDir = path.join(process.cwd(), 'data');
    const products: { productCode: string; productName: string, category: string }[] = [];

    // Read Vegetable List
    try {
        const vegPath = path.join(dataDir, 'list_Vegetable.json');
        const vegContent = await fs.readFile(vegPath, 'utf-8');
        const vegData = JSON.parse(vegContent);
        if (vegData.data) {
            products.push(...vegData.data.map((item: any) => ({ ...item, category: 'Vegetable' })));
        }
    } catch (e) {
        console.error('Error loading veg list:', e);
    }

    // Read Fruit List
    try {
        const fruitPath = path.join(dataDir, 'list_Fruit.json');
        const fruitContent = await fs.readFile(fruitPath, 'utf-8');
        const fruitData = JSON.parse(fruitContent);
        if (fruitData.data) {
            products.push(...fruitData.data.map((item: any) => ({ ...item, category: 'Fruit' })));
        }
    } catch (e) {
        console.error('Error loading fruit list:', e);
    }

    return NextResponse.json(products);
}

export async function POST(request: Request) {
    try {
        const { date, data } = await request.json();
        if (!date || !Array.isArray(data)) {
            return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
        }

        const dataDir = path.join(process.cwd(), 'data');

        // Helper to update a list file
        const updateListFile = async (type: 'Vegetable' | 'Fruit') => {
            const listPath = path.join(dataDir, `list_${type}.json`);
            let existingContent = { date: '', data: [] as any[] };

            // Read existing if possible
            try {
                const fileContent = await fs.readFile(listPath, 'utf-8');
                existingContent = JSON.parse(fileContent);
            } catch (e) {
                // File might not exist or be corrupted, start fresh
            }

            // Filter new data for this type
            const newDataItems = data.filter((item: any) => item.category === type);
            if (newDataItems.length === 0) return; // Nothing to update for this type

            // Create Map for unique products (Code or Name as key? Code is safer)
            const productMap = new Map();

            // Load existing products into Map
            if (existingContent.data) {
                existingContent.data.forEach((p: any) => {
                    if (p.productCode) productMap.set(p.productCode, p);
                });
            }

            // Merge new products
            newDataItems.forEach((p: any) => {
                if (p.productCode && p.productName) {
                    productMap.set(p.productCode, {
                        productCode: p.productCode,
                        productName: p.productName
                    });
                }
            });

            // Convert back to array
            const updatedList = Array.from(productMap.values());

            // Save back to file
            const newContent = {
                date: date, // Update to the new query date
                data: updatedList
            };

            await fs.writeFile(listPath, JSON.stringify(newContent, null, 2));
        };

        await Promise.all([
            updateListFile('Vegetable'),
            updateListFile('Fruit')
        ]);

        return NextResponse.json({ message: 'Lists updated successfully' });

    } catch (error) {
        console.error('Error updating lists:', error);
        return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
    }
}
