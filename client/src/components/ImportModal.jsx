import { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function ImportModal({ isOpen, onClose, vendorName, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Review/Import
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ... existing code ...


  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      parseFile(selected);
    }
  };

  const parseFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 5, // Preview first 5 rows
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
          setPreview(results.data);
          
          // Auto-map columns based on name similarity
          const autoMap = {};
          // Map DB field key -> Array of possible CSV headers to match
          const fieldMatches = {
            vendor_image: ['Image', 'Vendor Image', 'Image URL'],
            parent_sku: ['Parent SKU', 'ParentSku', 'Parent'],
            sku: ['SKU', 'Sku'],
            upc: ['UPC', 'Upc', 'GTIN'],
            title: ['Title', 'Product Name', 'Name'],
            brand: ['Brand', 'Manufacturer'],
            msrp: ['MSRP', 'Msrp', 'Retail Price'],
            cost: ['Cost', 'Wholesale Price'],
            quantity: ['Quantity', 'Qty', 'Stock'],
            size: ['Size'],
            color: ['Color']
          };
          
          Object.entries(fieldMatches).forEach(([dbKey, possibleHeaders]) => {
            const match = results.meta.fields.find(h => possibleHeaders.some(ph => ph.toLowerCase() === h.toLowerCase()));
            if (match) autoMap[dbKey] = match;
          });
          
          setMapping(autoMap);
          setStep(2);
        }
      },
      error: (err) => {
        setError("Failed to parse CSV: " + err.message);
      }
    });
  };

  const handleImport = async () => {
    setLoading(true);
    setProgress(0); // Initialize progress
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const totalRows = results.data.length;
        const BATCH_SIZE = 500;
        let processed = 0;

        try {
          // Process in batches
          for (let i = 0; i < totalRows; i += BATCH_SIZE) {
            const batch = results.data.slice(i, i + BATCH_SIZE);
            
            const products = batch.map(row => {
               const product = {
                 vendor_name: vendorName,
                 vendor_image: row[mapping.vendor_image] || '',
                 parent_sku: row[mapping.parent_sku] || '',
                 sku: row[mapping.sku] || '',
                 upc: row[mapping.upc] || '',
                 title: row[mapping.title] || '',
                 brand: row[mapping.brand] || '',
                 msrp: isNaN(parseFloat(row[mapping.msrp])) ? 0 : parseFloat(row[mapping.msrp]),
                 cost: isNaN(parseFloat(row[mapping.cost])) ? 0 : parseFloat(row[mapping.cost]),
                 size: row[mapping.size] || '',
                 color: row[mapping.color] || '',
                 additional_data: {
                    quantity: isNaN(parseInt(row[mapping.quantity])) ? 0 : parseInt(row[mapping.quantity])
                 }
               };

               Object.keys(row).forEach(header => {
                  if (!Object.values(mapping).includes(header)) {
                    product.additional_data[header] = row[header];
                  }
               });
               
               return product;
            });

            // Send batch
            await api.post('/products/import', products);
            
            // Update progress
            processed += batch.length;
            setProgress(Math.round((processed / totalRows) * 100));
            
            // Small delay to allow UI to update if main thread is blocked (less issue with async/await)
            await new Promise(r => setTimeout(r, 10));
          }

          toast.success(`Successfully imported ${totalRows} products for ${vendorName}`);
          onImportSuccess();
          onClose();
        } catch (err) {
          setError("Import failed: " + (err.response?.data?.error || err.message));
        } finally {
          setLoading(false);
          setProgress(0);
        }
      }
    });
  };

  const targetFields = [
    { key: 'vendor_image', label: 'Image' },
    { key: 'parent_sku', label: 'Parent SKU' },
    { key: 'sku', label: 'SKU' },
    { key: 'upc', label: 'UPC' },
    { key: 'title', label: 'Title' },
    { key: 'brand', label: 'Brand' },
    { key: 'msrp', label: 'MSRP' },
    { key: 'cost', label: 'Cost' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'size', label: 'Size' },
    { key: 'color', label: 'Color' },
  ];

  // Calculate extra columns for warning
  const getExtraColumns = () => {
    if (!preview.length || !mapping) return [];
    const allHeaders = Object.keys(preview[0]);
    const mappedHeaders = Object.values(mapping);
    return allHeaders.filter(h => !mappedHeaders.includes(h));
  };

  const extraColumns = getExtraColumns();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold">Import Products</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X size={24} /></button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-destructive/15 text-destructive rounded flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {step === 1 && (
            <div className="border-3 border-dashed border-input rounded-xl p-20 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer relative bg-muted/10">
               <Upload size={64} className="text-muted-foreground mb-6" />
               <p className="text-lg font-medium">Click to upload CSV or drag and drop</p>
               <p className="text-sm text-muted-foreground mt-2">Accepts .csv files</p>
               <input 
                 type="file" 
                 accept=".csv" 
                 onChange={handleFileChange} 
                 className="absolute inset-0 opacity-0 cursor-pointer"
               />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
               <div className="flex justify-between items-start">
                 <p className="text-muted-foreground">Map columns from your CSV to the system fields.</p>
                 {extraColumns.length > 0 && (
                   <div className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-4 py-3 rounded-md text-sm max-w-md">
                      <p className="font-bold flex items-center gap-2 mb-1">
                        <AlertCircle size={16} /> Caution
                      </p>
                      <p>
                        You are adding <strong>{extraColumns.length}</strong> additional column(s) that are not mapped:
                        <span className="italic block mt-1 opacity-80">{extraColumns.join(', ')}</span>
                      </p>
                   </div>
                 )}
               </div>

               <div className="grid grid-cols-2 gap-6">
                 {targetFields.map(field => (
                   <div key={field.key} className="space-y-1.5">
                     <label className="text-sm font-medium">{field.label}</label>
                     <select 
                       className="w-full border rounded-md p-2.5 text-sm bg-background hover:bg-accent/5 transition-colors"
                       value={mapping[field.key] || ''}
                       onChange={e => setMapping({...mapping, [field.key]: e.target.value})}
                     >
                       <option value="">(Skip)</option>
                       {headers.map(h => (
                         <option key={h} value={h}>{h}</option>
                       ))}
                     </select>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between bg-muted/20">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium hover:underline">Cancel</button>
          {step === 2 && (
            <button 
              onClick={handleImport} 
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "Importing..." : "Run Import"}
              {!loading && <Check size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
