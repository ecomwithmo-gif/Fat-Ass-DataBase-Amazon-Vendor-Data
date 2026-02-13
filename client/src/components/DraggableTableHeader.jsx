import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender } from '@tanstack/react-table';
import { GripVertical } from 'lucide-react';
import ColumnMenu from './ExcelColumnFilter';

export default function DraggableTableHeader({ header, table }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative',
    minWidth: header.column.getSize(),
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      colSpan={header.colSpan}
      className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap bg-muted/90 backdrop-blur-sm group/header relative select-none border-r border-border/50 last:border-r-0"
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-2">
            
          {/* Drag Handle */}
          <button 
             {...attributes} 
             {...listeners} 
             className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground p-0.5 rounded hover:bg-muted-foreground/10"
          >
             <GripVertical size={14} />
          </button>
          
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>
        
        {/* Show menu if filterable */}
        {header.column.getCanFilter() && (
            <ColumnMenu column={header.column} table={table} />
        )}
      </div>
    </th>
  );
}
