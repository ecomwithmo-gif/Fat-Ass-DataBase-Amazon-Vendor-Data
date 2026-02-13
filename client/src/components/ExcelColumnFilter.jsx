import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowDownAZ, 
  ArrowUpAZ, 
  Filter, 
  X, 
  Check, 
  Search,
  ListFilter
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ExcelColumnFilter({ column, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  // Internal state for the filter menu
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedValues, setSelectedValues] = useState(new Set());
  const [isSelectAll, setIsSelectAll] = useState(true);

  // Get all unique values for this column from the table data
  // using getPreFilteredRowModel to see all available data before this column's filter
  const uniqueValues = useMemo(() => {
    // If we want to filter based on CURRENTLY visible rows (cascading filters), use getFilteredRowModel
    // If we want to always show ALL global options, use getPreFilteredRowModel
    // Excel usually shows options available after other filters are applied.
    const rows = table.getCoreRowModel().rows; 
    const values = new Set();
    rows.forEach(row => {
      const val = row.getValue(column.id);
      if (val !== null && val !== undefined) {
          values.add(String(val));
      } else {
          values.add("(Blanks)");
      }
    });
    return Array.from(values).sort();
  }, [table.getCoreRowModel().rows, column.id]);

  // Sync internal state when menu opens
  useEffect(() => {
    if (isOpen) {
      const currentFilter = column.getFilterValue();
      // If filter is undefined/null, it means "Select All" is effectively active (no filter)
      if (currentFilter === undefined || currentFilter === null) {
        setIsSelectAll(true);
        setSelectedValues(new Set(uniqueValues));
      } else if (Array.isArray(currentFilter)) {
        setIsSelectAll(currentFilter.length === uniqueValues.length);
        setSelectedValues(new Set(currentFilter));
      } else {
        // Handle legacy string filter case seamlessly
        // If it's a string, we might just match it against values or reset
        setIsSelectAll(false);
        // Try to match exact values if possible, otherwise reset standard
        // For now, let's treat string filter as "custom" and maybe just clear selection or try to map
        // Simplest: reset to Select All if incompatible type
         setIsSelectAll(true);
         setSelectedValues(new Set(uniqueValues));
      }
      setSearchQuery("");
    }
  }, [isOpen, column, uniqueValues]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSort = (direction) => {
    column.toggleSorting(direction === 'desc');
    // We don't close menu immediately for Excel feel, or we do? Excel closes.
    setIsOpen(false);
  };

  const toggleValue = (value) => {
    const newSelected = new Set(selectedValues);
    if (newSelected.has(value)) {
      newSelected.delete(value);
      setIsSelectAll(false);
    } else {
      newSelected.add(value);
      if (newSelected.size === uniqueValues.length) {
        setIsSelectAll(true);
      }
    }
    setSelectedValues(newSelected);
  };

  const toggleSelectAll = () => {
    if (isSelectAll) {
        // Deselect all (except filtered ones if we implement search filtering)
         setSelectedValues(new Set());
         setIsSelectAll(false);
    } else {
         // Select currently visible values (if search) or all
         // For now, simply all
         setSelectedValues(new Set(uniqueValues));
         setIsSelectAll(true);
    }
  };

  const applyFilter = () => {
    // If Select All is true (and we haven't filtered the list via search to exclude things), 
    // strictly speaking we should clear the filter to avoid overhead.
    if (isSelectAll && searchQuery === "") {
        column.setFilterValue(undefined);
    } else {
        column.setFilterValue(Array.from(selectedValues));
    }
    setIsOpen(false);
  };

  const clearFilter = () => {
    column.setFilterValue(undefined);
    setIsOpen(false);
  };

  const filteredUniqueValues = uniqueValues.filter(v => 
    v.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSorted = column.getIsSorted();
  const isFiltered = column.getFilterValue() !== undefined;

  return (
    <div className="relative inline-block ml-2" ref={menuRef}>
      <button
        onClick={(e) => {
           e.stopPropagation();
           setIsOpen(!isOpen);
        }}
        className={cn(
          "p-1 rounded hover:bg-muted/80 transition-colors",
          (isSorted || isFiltered) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
        )}
        title="Filter & Sort"
      >
        <ListFilter size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-md shadow-xl z-50 flex flex-col text-sm animate-in fade-in zoom-in-95 duration-100">
          
          {/* Sorting */}
          <div className="p-1 space-y-1 bg-muted/30">
             <button 
                onClick={() => handleSort('asc')}
                className={cn(
                   "flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left",
                   isSorted === 'asc' && "bg-muted font-medium text-primary"
                )}
             >
                <ArrowDownAZ size={16} className="text-muted-foreground" />
                <span>Sort A to Z</span>
             </button>
             <button 
                onClick={() => handleSort('desc')}
                className={cn(
                   "flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left",
                   isSorted === 'desc' && "bg-muted font-medium text-primary"
                )}
             >
                <ArrowUpAZ size={16} className="text-muted-foreground" />
                <span>Sort Z to A</span>
             </button>
          </div>

          <div className="h-px bg-border group" />

          {/* Search */}
          <div className="p-2">
             <div className="relative">
                <Search size={14} className="absolute left-2 top-2 text-muted-foreground" />
                <input
                    autoFocus
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 border rounded text-sm bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
             </div>
          </div>

          {/* Value List */}
          <div className="max-h-48 overflow-y-auto p-1 space-y-1 border-t border-b border-border bg-background">
             <label className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer select-none">
                 <input 
                    type="checkbox" 
                    checked={isSelectAll} 
                    onChange={toggleSelectAll}
                    ref={input => {
                        if (input) {
                            input.indeterminate = !isSelectAll && selectedValues.size > 0 && selectedValues.size < uniqueValues.length;
                        }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                 />
                 <span className="font-medium text-muted-foreground">(Select All)</span>
             </label>
             
             {filteredUniqueValues.map(val => (
                 <label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer select-none">
                     <input 
                        type="checkbox" 
                        checked={selectedValues.has(val)} 
                        onChange={() => toggleValue(val)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                     />
                     <span className="truncate">{val}</span>
                 </label>
             ))}

             {filteredUniqueValues.length === 0 && (
                 <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                    No matches found
                 </div>
             )}
          </div>

          {/* Actions */}
          <div className="p-2 flex items-center justify-between bg-muted/30">
              <button 
                  onClick={clearFilter}
                  disabled={!isFiltered}
                  className="text-xs text-muted-foreground hover:text-destructive underline disabled:opacity-50 disabled:no-underline"
              >
                  Clear Filter
              </button>
              <button 
                  onClick={applyFilter}
                  className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors"
              >
                  Apply
              </button>
          </div>
        </div>
      )}
    </div>
  );
}
