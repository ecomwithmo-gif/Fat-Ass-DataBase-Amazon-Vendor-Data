import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../lib/axios';
import { Package, Upload, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import ProductTable from '../components/ProductTable';
import AmazonImportModal from '../components/AmazonImportModal';

export default function AmazonDashboard() {
  const { refreshVendors } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  // Amazon Data is treated as a special vendor
  const VENDOR_NAME = "Amazon Data";

  return (
   <ErrorBoundary>
    <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex flex-col pb-8">
      <AmazonImportModal 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onImportSuccess={() => {
            // Trigger a refresh of the table if needed (ProductTable fetches its own data)
            // But we might want to refresh global stats if we had them
            refreshVendors(); 
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
           <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
             <Package className="h-8 w-8 text-orange-500" />
             Amazon Data
           </h1>
           <p className="text-muted-foreground text-sm">
             Manage your Amazon FBA/FBM inventory and metrics.
           </p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setIsImportOpen(true)}
             className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 shadow-sm transition-all flex items-center gap-2"
           >
             <Upload size={16} /> Import Amazon Data
           </button>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-lg border shadow-sm overflow-hidden flex flex-col">
          {/* Reusing ProductTable but forcing the vendor to be 'Amazon Data' */}
          <div className="p-4 flex-1 overflow-hidden">
             <ProductTable vendorName={VENDOR_NAME} />
          </div>
      </div>
    </div>
   </ErrorBoundary>
  );
}
