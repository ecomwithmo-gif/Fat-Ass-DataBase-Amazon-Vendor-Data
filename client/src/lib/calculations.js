
/**
 * Calculations for Amazon FBA Fees, Profit, ROI, etc.
 */

// Helper to clean currency strings to numbers
export const parseCleanNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    // Remove " $", ",", "%" etc
    const clean = String(val).replace(/[^0-9.-]+/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

// Helper to determine Best Variant
// "mark the winner (highest Rating Count; tiebreak by lowest Sales Rank) as _isBestVariant"
export const determineBestVariants = (products) => {
    // Group by Parent ASIN
    const groups = {};
    products.forEach(p => {
        const parent = p.parent_sku || p.sku; // Fallback to own SKU if no parent
        if (!groups[parent]) groups[parent] = [];
        groups[parent].push(p);
    });

    const bestVariantIds = new Set();

    Object.values(groups).forEach(group => {
        if (group.length === 0) return;
        
        // Sort group to find winner
        // 1. Highest Rating Count (desc)
        // 2. Lowest Sales Rank (asc)
        group.sort((a, b) => {
            const ratingCountA = parseCleanNumber(a.amazonData?.ReviewCount || a.amazonData?.['Reviews: Review Count - Format Specific'] || 0);
            const ratingCountB = parseCleanNumber(b.amazonData?.ReviewCount || b.amazonData?.['Reviews: Review Count - Format Specific'] || 0);
            
            if (ratingCountA !== ratingCountB) {
                return ratingCountB - ratingCountA; // Higher is better
            }

            const rankA = parseCleanNumber(a.amazonData?.RankCurrent || a.amazonData?.['Sales Rank: Current'] || 9999999);
            const rankB = parseCleanNumber(b.amazonData?.RankCurrent || b.amazonData?.['Sales Rank: Current'] || 9999999);
            
            return rankA - rankB; // Lower is better
        });

        // Winner is index 0
        bestVariantIds.add(group[0].id);
    });

    return bestVariantIds; // Return Set of IDs that are best variants
};


export const calculateFeesAndProfit = (product, amazonData, shippingCost = 0, miscCost = 0) => {
    // 1. Referral Fee
    // Source from Amazon Data tab's Referral Fee % column (match by UPC).
    // If missing or 0, default to 15% (0.15).
    let referralFeeRaw = amazonData?.ReferralFee || amazonData?.['Referral Fee %'];
    let referralFeePercent = 0.15; // Default

    if (referralFeeRaw) {
        let val = parseCleanNumber(referralFeeRaw);
        // If > 1 (e.g. 15), divide by 100. If 0.15, keeps as is.
        if (val > 1) {
            referralFeePercent = val / 100;
        } else if (val > 0) {
            referralFeePercent = val;
        }
    }

    // 2. Pick & Pack Fee
    // Source from Amazon Data tab's Pick & Pack column.
    // If 0 or empty, default to $7.00.
    let pickAndPackFee = 7.00;
    const fbaFeeRaw = amazonData?.FBAFee || amazonData?.['FBA Pick&Pack Fee'];
    if (fbaFeeRaw) {
        const val = parseCleanNumber(fbaFeeRaw);
        if (val > 0) pickAndPackFee = val;
    }

    // 3. Sale Price (Buy Box Waterfall)
    // Buy Box (Current) -> 30 -> 90 -> 180 -> MSRP
    let salePrice = 0;
    
    // Helper to get value checking both clean and raw keys
    const getVal = (cleanKey, rawKey) => parseCleanNumber(amazonData?.[cleanKey] || amazonData?.[rawKey]);

    const bbCurrent = getVal('BuyBoxCurrent', 'Buy Box 🚚: Current');
    const bb30 = getVal('BuyBox30', 'Buy Box 🚚: 30 days avg.');
    const bb90 = getVal('BuyBox90', 'Buy Box 🚚: 90 days avg.');
    const bb180 = getVal('BuyBox180', 'Buy Box 🚚: 180 days avg.');
    const msrp = parseCleanNumber(product.msrp);

    if (bbCurrent > 0) salePrice = bbCurrent;
    else if (bb30 > 0) salePrice = bb30;
    else if (bb90 > 0) salePrice = bb90;
    else if (bb180 > 0) salePrice = bb180;
    else if (msrp > 0) salePrice = msrp;
    
    // 4. Total Cost
    // Product Cost + Pick & Pack + Shipping + Misc
    const productCost = parseCleanNumber(product.cost);
    const totalCost = productCost + pickAndPackFee + shippingCost + miscCost;

    // 5. Profit
    // Revenue = Sale Price * (1 - Referral Fee)
    // Profit = Revenue - Total Cost
    const revenue = salePrice * (1 - referralFeePercent);
    const profit = revenue - totalCost;

    // 6. ROI
    // ROI = (Profit / (Product Cost + Shipping + Misc)) * 100
    // Denominator excludes Amazon fees
    const investment = productCost + shippingCost + miscCost;
    let roi = 0;
    if (investment > 0) {
        roi = (profit / investment) * 100;
    }

    // 7. Profit Margin (Buybox)
    // Margin = (Profit / Buy Box Price) * 100
    // If no Buy Box, show "No Buybox" (handled in UI, here we return null/NaN)
    let marginBuyBox = null;
    if (salePrice > 0) {
        marginBuyBox = (profit / salePrice) * 100;
    }

    // 8. Profit Margin (MSRP)
    // Margin (MSRP) = ((Revenue at MSRP - Total Cost) / MSRP) * 100
    let marginMSRP = 0;
    if (msrp > 0) {
        const revenueMSRP = msrp * (1 - referralFeePercent);
        // Recalculate profit at MSRP? Instructions say: (Revenue at MSRP - Total Cost) / MSRP
        marginMSRP = ((revenueMSRP - totalCost) / msrp) * 100;
    }

    // 9. MSRP Difference
    // Difference = ((Buy Box - MSRP) / MSRP) * 100
    let msrpDiff = 0;
    if (msrp > 0 && salePrice > 0) {
        msrpDiff = ((salePrice - msrp) / msrp) * 100;
    }

    return {
        referralFeePercent,
        pickAndPackFee,
        salePrice,
        totalCost,
        profit,
        roi,
        marginBuyBox,
        marginMSRP,
        msrpDiff,
        investment
    };
};

// Smart Color Coding
export const getSmartColor = (type, value, extraData) => {
    if (value === null || value === undefined) return '';
    const num = parseFloat(value);

    switch (type) {
        case 'SalesRank':
            // < 150,000 Green
            // 150,000 - 500,000 Orange
            // > 500,000 or N/A Red
            if (!value && value !== 0) return 'text-red-600 font-medium'; // N/A
            if (num < 150000) return 'text-green-600 font-medium';
            if (num <= 500000) return 'text-orange-500 font-medium';
            return 'text-red-600 font-medium';

        case 'ROI':
            // > 20% Green
            // 12% - 20% Orange
            // < 12% Red
            if (num > 20) return 'text-green-600 font-medium';
            if (num >= 12) return 'text-orange-500 font-medium';
            return 'text-red-600 font-medium';

        case 'MarginBuyBox':
            // > 20% Green
            // 12% - 20% Orange
            // < 12% or "No Buybox" Red
            if (extraData?.noBuyBox) return 'text-red-600 font-medium';
            if (num > 20) return 'text-green-600 font-medium';
            if (num >= 12) return 'text-orange-500 font-medium';
            return 'text-red-600 font-medium';
        
        case 'MSRPDiff':
            // > 0% Green
            // < 0% Red
            if (num > 0) return 'text-green-600 font-medium';
            if (num < 0) return 'text-red-600 font-medium';
            return '';

        case 'Profit':
            // < $0.80 Red
            if (num < 0.80) return 'text-red-600 font-medium';
            return 'text-green-600 font-medium';

        case 'MarginDiv': // Price / Cost
            // > 1.5 Green
            // 1.3 - 1.5 Orange
            // < 1.3 Red
            if (num > 1.5) return 'text-green-600 font-medium';
            if (num >= 1.3) return 'text-orange-500 font-medium';
            return 'text-red-600 font-medium';

        case 'AmazonAvailability':
            // "no amazon offer" Green
            // "in stock"/"available" Red
            const lower = String(value).toLowerCase();
            if (lower.includes('no amazon offer') || lower.includes('no offer')) return 'text-green-600 font-medium';
            if (lower.includes('stock') || lower.includes('available')) return 'text-red-600 font-medium';
            return '';
        
        case 'SalesBadge':
            // Has Badge Green
             if (value) return 'text-green-600 font-medium';
             return '';

        default:
            return '';
    }
};
