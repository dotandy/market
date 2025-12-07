import { NextResponse } from 'next/server';
import { migrateData } from '@/lib/migrate';

export async function GET() {
    try {
        const logs = await migrateData();
        return NextResponse.json({
            status: 'success',
            message: 'Migration completed',
            logs
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            message: 'Migration failed',
            error: String(error)
        }, { status: 500 });
    }
}
