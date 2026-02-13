
// Mock the functions we want to test to run in Node.js environment
// We'll copy-paste the logic from calculations.js here to test it in isolation first
// or ideally we would import it if it was a CommonJS module, but it's ES module.
// So let's create a temporary test file that acts as a unit test suite.

const parseCleanNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^0-9.-]+/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const getSmartColor = (type, value, extraData) => {
    if (value === null || value === undefined) return '';
    const num = parseFloat(value);

    switch (type) {
        case 'SalesRank':
            if (!value && value !== 0) return 'RED (N/A)'; // N/A
            if (num < 150000) return 'GREEN';
            if (num <= 500000) return 'ORANGE';
            return 'RED';

        case 'ROI':
            if (num > 20) return 'GREEN';
            if (num >= 12) return 'ORANGE';
            return 'RED';

        case 'MarginBuyBox':
            if (extraData?.noBuyBox) return 'RED (No Buybox)';
            if (num > 20) return 'GREEN';
            if (num >= 12) return 'ORANGE';
            return 'RED';
        
        case 'MSRPDiff':
            if (num > 0) return 'GREEN';
            if (num < 0) return 'RED';
            return '';

        case 'Profit':
            if (num < 0.80) return 'RED';
            return 'GREEN'; // Implied > 0.80 is good? User said < 0.80 Too low (Red).

        case 'MarginDiv': // Price / Cost
            if (num > 1.5) return 'GREEN';
            if (num >= 1.3) return 'ORANGE';
            return 'RED';

        case 'AmazonAvailability':
            const lower = String(value).toLowerCase();
            if (lower.includes('no amazon offer') || lower.includes('no offer')) return 'GREEN';
            if (lower.includes('stock') || lower.includes('available')) return 'RED';
            return '';
        
        case 'SalesBadge':
             if (value) return 'GREEN';
             return '';

        default:
            return '';
    }
};

const calculateFeesAndProfit = (product, amazonData, shippingCost = 0, miscCost = 0) => {
    // 1. Referral Fee
    // Source from Amazon Data tab's Referral Fee % column (match by UPC).
    // If missing or 0, default to 15% (0.15).
    // Handle raw keys too!
    let referralFeeRaw = amazonData?.ReferralFee || amazonData?.['Referral Fee %'];
    let referralFeePercent = 0.15; // Default

    if (referralFeeRaw) {
        let val = parseCleanNumber(referralFeeRaw);
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
    
    // Helper to try raw keys if clean ones match
    const getVal = (cleanKey, rawKey) => parseCleanNumber(amazonData?.[cleanKey] || amazonData?.[rawKey]);

    const bbCurrent = getVal('BuyBoxCurrent', 'Buy Box 🚚: Current');
    const bb30 = getVal('BuyBox30', 'Buy Box 🚚: 30 days avg.');
    const bb90 = getVal('BuyBox90', 'Buy Box 🚚: 90 days avg.');
    const bb180 = getVal('BuyBox180', 'Buy Box 🚚: 180 days avg.');
    const msrp = parseCleanNumber(product.msrp);
    
    console.log(`Waterfall Check: Current=${bbCurrent}, 30=${bb30}, 90=${bb90}, 180=${bb180}, MSRP=${msrp}`);

    if (bbCurrent > 0) salePrice = bbCurrent;
    else if (bb30 > 0) salePrice = bb30;
    else if (bb90 > 0) salePrice = bb90;
    else if (bb180 > 0) salePrice = bb180;
    else if (msrp > 0) salePrice = msrp;
    
    // 4. Total Cost
    const productCost = parseCleanNumber(product.cost);
    const totalCost = productCost + pickAndPackFee + shippingCost + miscCost;

    // 5. Profit
    // Revenue = Sale Price * (1 - Referral Fee)
    const revenue = salePrice * (1 - referralFeePercent);
    const profit = revenue - totalCost;

    // 6. ROI
    const investment = productCost + shippingCost + miscCost;
    let roi = 0;
    if (investment > 0) {
        roi = (profit / investment) * 100;
    }

    // 7. Profit Margin (Buybox)
    let marginBuyBox = 0; // Or null? User said "No Buybox" if no BB.
    if (salePrice > 0) {
        marginBuyBox = (profit / salePrice) * 100;
    } else {
        // Flag for UI to show "No Buybox"
        marginBuyBox = null; 
    }

    // 8. Profit Margin (MSRP)
    let marginMSRP = 0;
    if (msrp > 0) {
        const revenueMSRP = msrp * (1 - referralFeePercent);
        marginMSRP = ((revenueMSRP - totalCost) / msrp) * 100;
    }

    // 9. MSRP Difference
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


// --- TESTS ---

console.log("--- Starting Tests ---");

// Case 1: Standard Product with all data (Raw Keys)
const p1 = { msrp: 20, cost: 5 };
const amz1 = {
    'Referral Fee %': '15',
    'FBA Pick&Pack Fee': '5.50',
    'Buy Box 🚚: Current': '25.00',
    'Sales Rank: Current': '50000',
    'Amazon: Availability of the Amazon offer': 'No amazon offer'
};
const r1 = calculateFeesAndProfit(p1, amz1);
console.log("Case 1 (Standard):", r1);
// Expected:
// RefFee: 0.15
// PickPack: 5.50
// SalePrice: 25.00
// TotalCost: 5 + 5.50 = 10.50
// Revenue: 25 * 0.85 = 21.25
// Profit: 21.25 - 10.50 = 10.75
// ROI: (10.75 / 5) * 100 = 215%
// MarginBB: (10.75 / 25) * 100 = 43%
// Color checks:
console.log("Case 1 Colors:");
console.log("Rank:", getSmartColor('SalesRank', 50000)); // Green
console.log("ROI:", getSmartColor('ROI', r1.roi)); // Green
console.log("Avail:", getSmartColor('AmazonAvailability', amz1['Amazon: Availability of the Amazon offer'])); // Green

// Case 2: Waterfall Pricing (No Current BB)
const p2 = { msrp: 30, cost: 10 };
const amz2 = {
    'Buy Box 🚚: Current': '',
    'Buy Box 🚚: 30 days avg.': '28.00'
};
const r2 = calculateFeesAndProfit(p2, amz2);
console.log("\nCase 2 (Waterfall - 30d): Sale Price =", r2.salePrice); // Should be 28.00

// Case 3: Defaults (No Fees, No BB)
const p3 = { msrp: 100, cost: 20 };
const amz3 = {}; // Empty
const r3 = calculateFeesAndProfit(p3, amz3);
console.log("\nCase 3 (Defaults):");
console.log("RefFee (Default 15%):", r3.referralFeePercent);
console.log("PickPack (Default $7):", r3.pickAndPackFee);
console.log("Sale Price (Fallback MSRP):", r3.salePrice); // Should be 100
console.log("Total Cost (20 + 7):", r3.totalCost); // 27

// Case 4: Color Coding Edge Cases
console.log("\nCase 4 (Colors):");
console.log("Rank 200k (Orange):", getSmartColor('SalesRank', 200000));
console.log("Rank 600k (Red):", getSmartColor('SalesRank', 600000));
console.log("Rank N/A (Red):", getSmartColor('SalesRank', null));
console.log("Profit $0.50 (Red):", getSmartColor('Profit', 0.50));
console.log("Price/Cost 1.6x (Green):", getSmartColor('MarginDiv', 1.6));
console.log("Price/Cost 1.1x (Red):", getSmartColor('MarginDiv', 1.1));

console.log("--- Tests Completed ---");
