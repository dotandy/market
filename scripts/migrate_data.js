
const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const goldenDir = path.join(dataDir, 'golden_dataset');
const backupDir = path.join(dataDir, 'backup');

// 1. Process Golden Dataset -> list_*.json
const types = ['Fruit', 'Vegetable'];

types.forEach(type => {
    const goldenPath = path.join(goldenDir, `latest_${type}.json`);
    if (fs.existsSync(goldenPath)) {
        console.log(`Processing ${type} golden dataset...`);
        const content = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

        // Check if 'data' property exists (based on previous file content I saw)
        let processedData = [];
        // The previous file content showed root object has "data": [...]
        // Wait, the file I viewed (latest_Fruit.json) had:
        // { "date": "114/12/04", "data": [ { ... } ] }
        // User wants: "資料內容只保留"date",productCode, productName"
        // Does user mean keep the "date" field (string) and minimize the items in "data" array?
        // "資料內容只保留"date",productCode, productName" could mean:
        // root "date" AND inside items "productCode", "productName".
        // OR inside items, keep "date" (if it exists?), "productCode", "productName".
        // Looking at the file content I saw earlier:
        // { "date": "...", "data": [ {"productCode":..., "productName":..., "upperPrice":...} ] }
        // The items inside "data" do NOT have a "date" field. The root has "date".
        // User said: "資料內容只保留"date",productCode, productName"
        // I interpret this as: The output JSON should be an array of items? OR the same structure but striped?
        // "明細表的貨品名稱細項直接讀取這兩份資料" -> The goal is to populate the product list.
        // Usually a product list needs Code and Name.
        // If I look at how the app likely uses it: it probably just needs a list of unique products.
        // "date" might be useful if the list is date-specific? 
        // BUT the user said "保留 'date', productCode, productName".
        // Maybe they want the root date to be injected into each item?
        // OR they want the structure { "date": "...", "data": [ { "productCode": "...", "productName": "..." } ] }
        // Let's assume the latter (preserve structure, filter fields in items) because it's safer.
        // Wait, if I just keep date, productCode, ProductName, I might as well flatten it if the user wants it to be "read directly".
        // However, usually "list" implies just the items.
        // Let's stick to: { date: "root_date", data: [ { productCode, productName } ] }

        const newData = content.data.map(item => ({
            productCode: item.productCode,
            productName: item.productName
        }));

        const newContent = {
            date: content.date,
            data: newData
        };

        fs.writeFileSync(path.join(dataDir, `list_${type}.json`), JSON.stringify(newContent, null, 2));
    }
});

// 2. Process Backup Dataset -> backup_*.json
types.forEach(type => {
    const backupPath = path.join(backupDir, `latest_${type}.json`);
    if (fs.existsSync(backupPath)) {
        console.log(`Renaming ${type} backup dataset...`);
        // Just copy/move
        fs.copyFileSync(backupPath, path.join(dataDir, `backup_${type}.json`));
    }
});

console.log('Migration complete.');
