import fs from 'fs';
import path from 'path';

export async function migrateData() {
    const dataDir = path.join(process.cwd(), 'data');
    const goldenDir = path.join(dataDir, 'golden_dataset');
    const backupDir = path.join(dataDir, 'backup');

    const types = ['Fruit', 'Vegetable'];
    const logs: string[] = [];

    // 1. Process Golden Dataset -> list_*.json
    types.forEach(type => {
        const goldenPath = path.join(goldenDir, `latest_${type}.json`);
        if (fs.existsSync(goldenPath)) {
            logs.push(`Processing ${type} golden dataset...`);
            try {
                const content = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

                // Extract only necessary fields for the list
                const newData = content.data.map((item: any) => ({
                    productCode: item.productCode,
                    productName: item.productName
                }));

                const newContent = {
                    date: content.date,
                    data: newData
                };

                const outputPath = path.join(dataDir, `list_${type}.json`);
                fs.writeFileSync(outputPath, JSON.stringify(newContent, null, 2));
                logs.push(`Created ${outputPath}`);
            } catch (error) {
                logs.push(`Error processing ${type}: ${error}`);
            }
        } else {
            logs.push(`Golden dataset not found: ${goldenPath}`);
        }
    });

    // 2. Process Backup Dataset -> backup_*.json
    types.forEach(type => {
        const backupPath = path.join(backupDir, `latest_${type}.json`);
        if (fs.existsSync(backupPath)) {
            logs.push(`Renaming ${type} backup dataset...`);
            try {
                const destPath = path.join(dataDir, `backup_${type}.json`);
                fs.copyFileSync(backupPath, destPath);
                logs.push(`Copied to ${destPath}`);
            } catch (error) {
                logs.push(`Error copying backup ${type}: ${error}`);
            }
        }
    });

    return logs;
}
