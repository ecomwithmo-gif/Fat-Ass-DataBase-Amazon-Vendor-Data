import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Globe, MapPin, Tag } from 'lucide-react';
import api from '../lib/axios';
import ProductTable from '../components/ProductTable';

export default function VendorDetail() {
  const { vendorName } = useParams();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Decode from URL
  const decodedName = decodeURIComponent(vendorName);

  useEffect(() => {
    // In a real app we might fetch by ID, but here we fetch list and find by name
    // or we could add a specific GET vendor by name endpoint.
    // For now, let's reuse the list fetch or implement search.
    // Let's implement a specific fetch in frontend by filtering the list if needed,
    // or assume the backend endpoint vendors/:vendorName works (which I implemented).
    fetchVendor();
  }, [decodedName]);

  const fetchVendor = async () => {
    // Handle "Amazon Data" special case
    if (decodedName === 'Amazon Data') {
        setVendor({
            Vendor: 'Amazon Data',
            Status: 'System',
            Type: 'System',
            Category: 'Data',
            product_count: 0, 
            brand_count: 0,
            total_value: 0
        });
        setLoading(false);
        return;
    }

    try {
      // Use specific endpoint for efficiency
      console.log(`Fetching vendor: ${decodedName}`);
      const response = await api.get(`/vendors/by-name/${encodeURIComponent(decodedName)}`);
      setVendor(response.data);
    } catch (error) {
      console.error("Failed to load vendor", error);
      // If 404, maybe it's because of case sensitivity or spacing issues
      // Try fallback to list if immediate fail, hoping list has it with slightly different formatting?
      // Or just leave as is since we use ilike on backend.
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!vendor) return <div className="p-8">Vendor not found</div>;

  return (
    <div className="w-full px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex justify-between items-center">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={16} /> Back to Vendors
        </Link>
        <a 
            href="/Vendor_Import_Template.csv" 
            download="Vendor_Import_Template.csv"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Download Import Template
          </a>
        </div>
        <div className="flex items-start justify-between">
           <div>
             <h1 className="text-4xl font-bold tracking-tight">{vendor.Vendor}</h1>
             <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
               {vendor.URL && (
                 <a href={vendor.URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
                   <Globe size={14} /> {new URL(vendor.URL).hostname}
                 </a>
               )}
               {vendor.Category && (
                 <span className="flex items-center gap-1">
                   <Tag size={14} /> {vendor.Category}
                 </span>
               )}
               <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-medium">
                 {vendor.Status}
               </span>
             </div>
           </div>
           
           {/* Summary Cards */}
           <div className="flex gap-4">
              <div className="bg-card border border-border rounded-lg p-3 text-center min-w-[100px] shadow-sm">
                 <div className="text-xs text-muted-foreground uppercase font-bold">Listings</div>
                 <div className="text-xl font-bold">{vendor.product_count || 0}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center min-w-[100px] shadow-sm">
                 <div className="text-xs text-muted-foreground uppercase font-bold">Brands</div>
                 <div className="text-xl font-bold">{vendor.brand_count || 0}</div>
              </div>
           </div>
        </div>
      </div>

      {/* Tabs / Sections */}
      <div className="space-y-8">
        <ProductTable vendorName={vendor.Vendor} />
      </div>
    </div>
  );
}
