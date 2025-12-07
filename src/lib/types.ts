export interface MarketData {
    productCode: string;
    productName: string;
    upperPrice: string;
    middlePrice: string;
    lowerPrice: string;
    averagePrice: string;
    transactionVolume: string;
    // New fields for Delivery Note
    quantity?: string;
    unit?: string;
    salesPrice?: string;
    subtotal?: string;
    remarks?: string;
    variety?: string; // New field for Variety
    category?: string; // New field for Category (Vegetable/Fruit)
}

export interface ScrapeResponse {
    status: 'fresh' | 'backup' | 'error';
    date: string;
    type: string;
    data: MarketData[];
    message?: string;
    backupDate?: string;
    scrapedAt?: string;
    isMarketClosed?: boolean;
}
