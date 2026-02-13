import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import api from '../lib/axios';
import { ExternalLink, MoreHorizontal, Store as StoreIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';

export default function VendorDashboard() {
  const { refreshVendors } = useOutletContext();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    type: "",
    category: ""
  });
  const [editingCell, setEditingCell] = useState(null); // { vendorName, field }
  const [editValue, setEditValue] = useState("");

  // Add Vendor State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVendor, setNewVendor] = useState({
    Vendor: "",
    URL: "",
    Status: "Open",
    Type: "",
    Category: ""
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      // 1. Fetch vendor list (fast)
      const response = await api.get('/vendors');
      const initialVendors = response.data;
      setVendors(initialVendors);
      setLoading(false); // Show list immediately

      // 2. Fetch stats (slower, background)
      // Note: We might want a loading state for stats specifically if needed, 
      // but users prefer seeing the list first.
      fetchStats(initialVendors);
    } catch (error) {
      console.error("Error loading vendors", error);
      setLoading(false);
    }
  };

  const fetchStats = async (currentVendors) => {
      try {
          const response = await api.get('/vendors/stats');
          const stats = response.data;

          // Merge stats into vendors
          setVendors(prev => prev.map(v => {
             const vNameKey = (v.Vendor || '').trim().toLowerCase();
             const stat = stats[vNameKey];
             if (stat) {
                 return { ...v, product_count: stat.count, brand_count: stat.brand_count, total_value: stat.total_value };
             }
             return v;
          }));
      } catch (error) {
          console.error("Error loading stats", error);
      }
  };

  // Status cell style helper
  const getStatusStyle = (status) => {
    switch(status?.toLowerCase()) {
      case 'open': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'closed': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const [openActionId, setOpenActionId] = useState(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenActionId(null);
      if (editingCell) { 
        // Optional: Save on click outside? For now, let's rely on Blur or Enter 
        // But actually, clicking outside needs to clear editing state if we want to cancel
        setEditingCell(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [editingCell]);

  const handleDelete = async (vendorName) => {
    if (!confirm(`Are you sure you want to delete ${vendorName}? This cannot be undone.`)) return;
    try {
      await api.delete(`/vendors/${encodeURIComponent(vendorName)}`);
      refreshVendors(); // Refresh list via context
      setVendors(vendors.filter(v => v.Vendor !== vendorName)); // Optimistic update
      toast.success(`${vendorName} deleted successfully`);
    } catch (error) {
      console.error("Failed to delete vendor", error);
      toast.error("Failed to delete vendor");
    }
  };

  const toggleActions = (e, id) => {
    e.stopPropagation();
    setOpenActionId(openActionId === id ? null : id);
  };

  const handleEditClick = (e, vendor, field) => {
    e.stopPropagation();
    setEditingCell({ vendorName: vendor.Vendor, field });
    setEditValue(vendor[field] || "");
  };

  const handleEditSave = async () => {
    if (!editingCell) return;
    const { vendorName, field } = editingCell;
    
    // Optimistic update
    const updatedVendors = vendors.map(v => 
      v.Vendor === vendorName ? { ...v, [field]: editValue } : v
    );
    setVendors(updatedVendors);
    setEditingCell(null);

    try {
      await api.put(`/vendors/${encodeURIComponent(vendorName)}`, { [field]: editValue });
      refreshVendors();
      toast.success(`${field} updated`);
    } catch (error) {
      console.error("Failed to update vendor", error);
      toast.error("Failed to update vendor");
      loadVendors(); // Revert on failure
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!newVendor.Vendor) {
        toast.error("Vendor Name is required");
        return;
    }

    try {
        await api.post('/vendors', newVendor);
        toast.success("Vendor added successfully");
        setIsAddModalOpen(false);
        setNewVendor({ Vendor: "", URL: "", Status: "Open", Type: "", Category: "" });
        loadVendors();
        refreshVendors();
    } catch (error) {
        console.error("Failed to add vendor", error);
        toast.error("Failed to add vendor");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleEditSave();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter & Sort Logic
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.Vendor.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          vendor.Category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filters.status ? vendor.Status === filters.status : true;
    const matchesType = filters.type ? vendor.Type === filters.type : true;
    const matchesCategory = filters.category ? vendor.Category === filters.category : true;
    return matchesSearch && matchesStatus && matchesType && matchesCategory;
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    
    // Numeric sort for stats
    if (['product_count', 'brand_count', 'total_value'].includes(sortConfig.key)) {
       return sortConfig.direction === 'asc' 
         ? Number(aValue) - Number(bValue)
         : Number(bValue) - Number(aValue);
    }

    // String sort
    return sortConfig.direction === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue));
  });

  // Unique values for dropdowns
  const uniqueStatuses = [...new Set(vendors.map(v => v.Status).filter(Boolean))].sort();
  const uniqueTypes = [...new Set(vendors.map(v => v.Type).filter(Boolean))].sort();
  const uniqueCategories = [...new Set(vendors.map(v => v.Category).filter(Boolean))].sort();

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex flex-col pb-8 pt-6 space-y-6">
        <div className="flex justify-between">
           <Skeleton className="h-8 w-32" />
           <Skeleton className="h-9 w-28" />
        </div>
        <div className="h-12 w-full bg-card border rounded flex items-center p-2 gap-2">
           <Skeleton className="h-8 w-64" />
           <Skeleton className="h-8 w-32" />
           <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-2">
           {[...Array(10)].map((_, i) => (
             <div key={i} className="flex gap-4 p-4 border rounded bg-card">
               <Skeleton className="h-6 w-1/4" />
               <Skeleton className="h-6 w-24" />
               <Skeleton className="h-6 w-1/6" />
               <Skeleton className="h-6 w-1/6" />
             </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex flex-col pb-8">
      <div className="flex flex-col gap-4 mb-6 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 shadow-sm transition-all"
          >
            Add Vendor
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 items-center bg-card p-3 rounded-lg border border-border shadow-sm">
          <input 
            type="text" 
            placeholder="Search vendors..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-input rounded-md text-sm w-full sm:w-64 bg-background"
          />
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="px-3 py-2 border border-input rounded-md text-sm bg-background"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            value={filters.type} 
            onChange={(e) => setFilters({...filters, type: e.target.value})}
            className="px-3 py-2 border border-input rounded-md text-sm bg-background"
          >
            <option value="">All Types</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select 
            value={filters.category} 
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="px-3 py-2 border border-input rounded-md text-sm bg-background"
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button 
            onClick={() => {setSearchQuery(""); setFilters({status:"", type:"", category:""})}}
            className="text-sm text-muted-foreground hover:text-foreground underline ml-auto"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 relative" style={{ minHeight: "300px" }}> {/* Ensure height for dropdown */}
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted/40 text-muted-foreground font-semibold text-xs uppercase tracking-wider border-b border-border sticky top-0 z-10 backdrop-blur-sm bg-background/80">
              <tr>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Vendor')}>Vendor {sortConfig.key === 'Vendor' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium w-32 text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Status')}>Status {sortConfig.key === 'Status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Type')}>Type {sortConfig.key === 'Type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Category')}>Category {sortConfig.key === 'Category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('brand_count')}>Brands {sortConfig.key === 'brand_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('product_count')}>Listings {sortConfig.key === 'product_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('total_value')}>Total Value {sortConfig.key === 'total_value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th className="px-6 py-4 font-medium">URL</th>
                <th className="px-6 py-4 font-medium text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredVendors.map((vendor, idx) => (
                <tr key={idx} className="group hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                    <Link to={`/vendor/${encodeURIComponent(vendor.Vendor)}`} className="hover:text-primary transition-colors flex items-center gap-2">
                       <StoreIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                       {vendor.Vendor}
                    </Link>
                  </td>
                  
                  {/* Editable Status */}
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-center cursor-pointer hover:bg-muted/50"
                    onClick={(e) => handleEditClick(e, vendor, 'Status')}
                  >
                    {editingCell?.vendorName === vendor.Vendor && editingCell?.field === 'Status' ? (
                      <select 
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs p-1 border rounded"
                      >
                         {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-block px-3 py-1 rounded-md text-xs font-semibold border ${getStatusStyle(vendor.Status)} w-full text-center shadow-sm`}>
                        {vendor.Status}
                      </span>
                    )}
                  </td>

                  {/* Editable Type */}
                  <td 
                    className="px-6 py-4 text-muted-foreground whitespace-nowrap cursor-pointer hover:bg-muted/50 hover:text-foreground"
                    onClick={(e) => handleEditClick(e, vendor, 'Type')}
                  >
                     {editingCell?.vendorName === vendor.Vendor && editingCell?.field === 'Type' ? (
                      <input 
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm p-1 border rounded bg-background text-foreground"
                      />
                    ) : vendor.Type}
                  </td>

                  {/* Editable Category */}
                  <td 
                    className="px-6 py-4 text-muted-foreground whitespace-nowrap cursor-pointer hover:bg-muted/50 hover:text-foreground"
                    onClick={(e) => handleEditClick(e, vendor, 'Category')}
                  >
                     {editingCell?.vendorName === vendor.Vendor && editingCell?.field === 'Category' ? (
                      <input 
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm p-1 border rounded bg-background text-foreground"
                      />
                    ) : vendor.Category}
                  </td>

                  <td className="px-6 py-4 text-center text-muted-foreground">{vendor.brand_count || 0}</td>
                  <td className="px-6 py-4 text-center text-muted-foreground">{vendor.product_count || 0}</td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">
                    {(vendor.total_value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>

                  {/* Editable URL */}
                  <td className="px-6 py-4 whitespace-nowrap group-hover/url relative">
                     <div className="flex items-center gap-2">
                        {vendor.URL && (
                          <a 
                            href={vendor.URL} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                          >
                            Visit <ExternalLink size={14} />
                          </a>
                        )}
                        <button 
                          onClick={(e) => handleEditClick(e, vendor, 'URL')}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
                          title="Edit URL"
                        >
                          Edit
                        </button>
                        {editingCell?.vendorName === vendor.Vendor && editingCell?.field === 'URL' && (
                           <div className="absolute top-0 left-0 bg-background z-20 p-2 border rounded shadow-lg flex gap-1">
                              <input 
                                autoFocus
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm p-1 border rounded w-48"
                              />
                              <button onClick={handleEditSave} className="px-2 bg-primary text-primary-foreground rounded text-xs">Save</button>
                           </div>
                        )}
                     </div>
                  </td>
                   <td className="px-6 py-4 text-right whitespace-nowrap relative">
                    <button 
                      onClick={(e) => toggleActions(e, idx)}
                      className={`p-1.5 rounded transition-colors ${openActionId === idx ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    
                    {/* Access Menu */}
                    {openActionId === idx && (
                      <div className="absolute right-8 top-8 w-48 bg-popover text-popover-foreground rounded-md shadow-lg border border-border z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                        <div className="py-1">
                          <Link 
                            to={`/vendor/${encodeURIComponent(vendor.Vendor)}`}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            View Details
                          </Link>
                          {/* Edit Properties is essentially inline editing now, but could be a modal */}
                          <button 
                            onClick={(e) => {
                                handleEditClick(e, vendor, 'Status'); // Trigger status edit as example
                                setOpenActionId(null);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            Edit Properties
                          </button>
                          <div className="h-px bg-border my-1" />
                          <button 
                            onClick={() => handleDelete(vendor.Vendor)}
                            className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Delete Vendor
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVendors.length === 0 && (
             <div className="p-10 text-center text-muted-foreground">
                No vendors found matching your filters.
             </div>
          )}
        </div>
      </div>

      {/* Add Vendor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card w-full max-w-md rounded-lg shadow-xl border border-border p-6 space-y-4">
                <h2 className="text-xl font-semibold">Add New Vendor</h2>
                <form onSubmit={handleAddVendor} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Vendor Name *</label>
                        <input 
                            required
                            type="text" 
                            className="w-full px-3 py-2 border rounded-md bg-transparent"
                            value={newVendor.Vendor} 
                            onChange={e => setNewVendor({...newVendor, Vendor: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">URL</label>
                        <input 
                            type="url" 
                            className="w-full px-3 py-2 border rounded-md bg-transparent"
                            value={newVendor.URL} 
                            onChange={e => setNewVendor({...newVendor, URL: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border rounded-md bg-transparent"
                                value={newVendor.Type} 
                                onChange={e => setNewVendor({...newVendor, Type: e.target.value})}
                                list="type-options"
                            />
                            <datalist id="type-options">
                                <option value="Agency" />
                                <option value="Distributor" />
                                <option value="B2B Market Place" />
                            </datalist>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Category</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border rounded-md bg-transparent"
                                value={newVendor.Category} 
                                onChange={e => setNewVendor({...newVendor, Category: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="px-4 py-2 text-sm hover:bg-muted rounded-md"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                            Save Vendor
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
