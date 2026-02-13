import { useState, useRef, useEffect } from 'react';
import { 
  ArrowDownAZ, 
  ArrowUpAZ, 
  Filter, 
  X, 
  Check, 
  MoreVertical, 
  ListFilter
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ColumnMenu({ column, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const [filterValue, setFilterValue] = useState(column.getFilterValue() || "");

  // Sync internal state with column filter state
  useEffect(() => {
    setFilterValue(column.getFilterValue() || "");
  }, [column.getFilterValue()]);

  // Click outside to close
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
    setIsOpen(false);
  };

  const handleFilterChange = (val) => {
    setFilterValue(val);
    column.setFilterValue(val);
  };

  const clearFilter = () => {
    setFilterValue("");
    column.setFilterValue(undefined);
    setIsOpen(false);
  };

  const isSorted = column.getIsSorted();
  const isFiltered = column.getFilterValue();

  return (
    <div className="relative inline-block ml-2" ref={menuRef}>
      <button
        onClick={(e) => {
           e.stopPropagation();
           setIsOpen(!isOpen);
        }}
        className={cn(
          "p-1 rounded hover:bg-muted/80 transition-colors",
          (isSorted || isFiltered) ? "text-primary bg-primary/10" : "text-muted-foreground/50 hover:text-foreground"
        )}
        title="Filter & Sort"
      >
        <ListFilter size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-md shadow-lg z-50 p-1 flex flex-col text-sm animate-in fade-in zoom-in-95 duration-100">
          
          {/* Sorting */}
          <div className="p-1 space-y-1">
             <button 
                onClick={() => handleSort('asc')}
                className={cn(
                   "flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left",
                   isSorted === 'asc' && "bg-muted font-medium"
                )}
             >
                <ArrowDownAZ size={16} className="text-muted-foreground" />
                <span>Sort A to Z</span>
                {isSorted === 'asc' && <Check size={14} className="ml-auto text-primary" />}
             </button>
             <button 
                onClick={() => handleSort('desc')}
                className={cn(
                   "flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left",
                   isSorted === 'desc' && "bg-muted font-medium"
                )}
             >
                <ArrowUpAZ size={16} className="text-muted-foreground" />
                <span>Sort Z to A</span>
                {isSorted === 'desc' && <Check size={14} className="ml-auto text-primary" />}
             </button>
          </div>

          <div className="h-px bg-border my-1" />

          {/* Filter */}
          <div className="p-2 space-y-2">
             <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Text Filters
             </div>
             <input
                autoFocus
                type="text"
                placeholder="Contains..."
                value={filterValue}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm bg-background focus:ring-1 focus:ring-primary focus:outline-none"
             />
             <div className="text-xs text-muted-foreground pt-1">
                {/* Future: Add 'Equals', 'Starts With' toggles here if needed */}
                <span className="italic">Matches text containing...</span>
             </div>
          </div>

           <div className="h-px bg-border my-1" />

           <div className="p-1">
              <button 
                onClick={clearFilter}
                disabled={!isFiltered && !isSorted}
                className="flex items-center justify-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 <X size={14} />
                 Clear Filter
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
