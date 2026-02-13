import { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function AmazonImportModal({ isOpen, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const VENDOR_NAME = "Amazon Data";

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const mapAmazonRowToProduct = (row) => {
    // 1. Define allowed columns and their clean names
    const COLUMN_MAPPING = {
      // Core Identifiers & Info
      'Imported by Code': 'ImportedBy',
      'Locale': 'Locale',
      'Image': 'Image',
      'Brand': 'Brand',
      'Parent ASIN': 'ParentASIN',
      'ASIN': 'ASIN',
      'Title': 'Title',
      'Color': 'Color',
      'Size': 'Size',
      
      // Reviews & Social
      'Reviews: Rating Count': 'Rating',
      'Reviews: Review Count - Format Specific': 'ReviewCount',
      'Bought in past month': 'BoughtLastMonth',
      
      // Buy Box & Sales Rank
      'Buy Box 🚚: Current': 'BuyBoxCurrent',
      'Buy Box 🚚: 30 days avg.': 'BuyBox30', // "Buybox 180" style requested
      'Buy Box 🚚: 90 days avg.': 'BuyBox90',
      'Buy Box 🚚: 180 days avg.': 'BuyBox180',
      'Sales Rank: Current': 'RankCurrent',
      'Sales Rank: 30 days avg.': 'Rank30',
      
      // Amazon Offer Stats
      'Amazon: Availability of the Amazon offer': 'AmzAvailability',
      'Buy Box: % Amazon 90 days': 'AmzBuyBox90',
      
      // Fees
      'Referral Fee %': 'ReferralFee',
      'FBA Pick&Pack Fee': 'FBAFee',
      
      // Offers Counts
      'Count of retrieved live offers: New, FBM': 'FBMOffers', // "FBM" style
      'Count of retrieved live offers: New, FBA': 'FBAOffers', // "FBA" style
      'Total Offer Count': 'TotalOffers',
    };

    // Helper to safely get string values, case-insensitive key lookup
    // We strictly look only for keys in our COLUMN_MAPPING
    const get = (targetKey) => {
       const key = Object.keys(row).find(k => k.toLowerCase().trim() === targetKey.toLowerCase().trim());
       return key ? row[key]?.toString().trim() : '';
    };

    // Extracts value based on the mapping key
    const getValue = (mappingKey) => {
        return get(mappingKey);
    }
    
    // Core fields
    const sku = getValue('ASIN') || getValue('Parent ASIN') || `AMZ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const title = getValue('Title');
    const brand = getValue('Brand');
    const image = getValue('Image');
    const size = getValue('Size');
    const color = getValue('Color');
    
    // Construct additional_data with ALL columns being available + mapped keys
    const additional_data = { ...row };
    
    // Also ensure we have the specific clean keys we rely on
    Object.entries(COLUMN_MAPPING).forEach(([csvHeader, cleanKey]) => {
        const val = get(csvHeader);
        if (cleanKey !== 'ASIN' && cleanKey !== 'Title' && cleanKey !== 'Brand' && cleanKey !== 'Image' && cleanKey !== 'Size' && cleanKey !== 'Color' && cleanKey !== 'ParentASIN') {
             additional_data[cleanKey] = val;
        }
    });

    return {
       vendor_name: VENDOR_NAME,
       vendor_image: image,
       parent_sku: getValue('Parent ASIN'),
       sku: sku,
       upc: getValue('Imported by Code') || '', 
       title: title,
       brand: brand,
       msrp: 0, 
       cost: 0, 
       size: size,
       color: color,
       additional_data: additional_data 
    };
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const products = results.data.map(mapAmazonRowToProduct);
          
          // Batch upload
          const BATCH_SIZE = 100;
          const totalBatches = Math.ceil(products.length / BATCH_SIZE);
          let totalRows = 0;

          for (let i = 0; i < totalBatches; i++) {
            const batch = products.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            await api.post('/products/batch', { products: batch });
            
            totalRows += batch.length;
            const progressPercent = Math.round(((i + 1) / totalBatches) * 100);
            setProgress(progressPercent);
            
            // Small delay to let UI breathe
            await new Promise(r => setTimeout(r, 10));
          }

          toast.success(`Successfully imported ${totalRows} Amazon products/variants`);
          onImportSuccess();
          onClose();
        } catch (err) {
          console.error("Import failed:", err);
          const errorMsg = err.response?.data?.error || err.message || "Unknown error";
          toast.error(`Import failed: ${errorMsg}`);
        } finally {
          setUploading(false);
          setProgress(0);
        }
      },
      error: (err) => {
        console.error("CSV Parse Error:", err);
        toast.error("Failed to parse CSV file");
        setUploading(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-lg shadow-xl border border-border p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Import Amazon Data</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
           {!file ? (
             <div 
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => document.getElementById('amazon-file-upload').click()}
             >
                <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                   <Upload size={24} />
                </div>
                <p className="text-sm font-medium">Click to upload Amazon CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Supports standard Amazon export headers</p>
                <input 
                   id="amazon-file-upload" 
                   type="file" 
                   accept=".csv" 
                   className="hidden" 
                   onChange={handleFileChange} 
                />
             </div>
           ) : (
             <div className="bg-muted/30 border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                      <FileText size={20} />
                   </div>
                   <div className="text-sm">
                      <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                      <p className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                   </div>
                </div>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive">
                   <X size={18} />
                </button>
             </div>
           )}

           {uploading && (
             <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                   <span>Importing...</span>
                   <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                   />
                </div>
             </div>
           )}

           <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? 'Importing...' : 'Import Data'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
