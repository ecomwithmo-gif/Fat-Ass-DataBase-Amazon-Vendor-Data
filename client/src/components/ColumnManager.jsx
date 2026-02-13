import { useState } from 'react';
import { Settings2, GripVertical, Eye, EyeOff } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';

export default function ColumnManager({ table, columns }) {
  const [isOpen, setIsOpen] = useState(false);

  // Get current visible columns and order
  const columnOrder = table.getState().columnOrder;
  const visibleColumns = table.getVisibleLeafColumns();
  const allColumns = table.getAllLeafColumns();

  // Create a list of items for dnd, based on current order
  // If columnOrder is not set, we use default order from allColumns
  const orderedColumnIds = columnOrder.length > 0 
      ? columnOrder 
      : allColumns.map(c => c.id);

  // Filter out columns that might not exist anymore but are in state
  const validOrderedIds = orderedColumnIds.filter(id => 
      allColumns.find(c => c.id === id)
  );

  // Add any new columns that aren't in the order state yet to the end
  const missingIds = allColumns
      .filter(c => !validOrderedIds.includes(c.id))
      .map(c => c.id);
  
  const finalIds = [...validOrderedIds, ...missingIds];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = finalIds.indexOf(active.id);
      const newIndex = finalIds.indexOf(over.id);
      const newOrder = arrayMove(finalIds, oldIndex, newIndex);
      table.setColumnOrder(newOrder);
    }
  };

  const toggleVisibility = (columnId) => {
      const column = table.getColumn(columnId);
      if (column) {
          column.toggleVisibility(!column.getIsVisible());
      }
  };

  return (
    <div className="relative inline-block text-left z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded hover:bg-muted whitespace-nowrap bg-background"
        title="Manage Columns"
      >
        <Settings2 size={16} /> Columns
      </button>

      {isOpen && (
        <>
            <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-md shadow-lg z-50 flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-border font-semibold text-sm">
                    Toggle & Reorder Columns
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                    <DndContext 
                        sensors={sensors} 
                        collisionDetection={closestCenter} 
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext 
                            items={finalIds} 
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-1">
                                {finalIds.map(id => {
                                    const column = table.getColumn(id);
                                    if (!column) return null;
                                    return (
                                        <SortableItem 
                                            key={id} 
                                            id={id} 
                                            column={column} 
                                            toggleVisibility={() => toggleVisibility(id)}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
                
                <div className="p-2 border-t border-border bg-muted/20 text-xs text-muted-foreground text-center">
                    Drag to reorder • Click eye to toggle
                </div>
            </div>
        </>
      )}
    </div>
  );
}

function SortableItem({ id, column, toggleVisibility }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const isVisible = column.getIsVisible();
  const header = typeof column.columnDef.header === 'string' 
      ? column.columnDef.header 
      : id.replace(/_/g, ' ').replace('dynamic', ''); // Fallback for dynamic logic

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
            "flex items-center justify-between p-2 rounded border bg-background hover:bg-muted/50 transition-colors select-none",
            isDragging && "shadow-md ring-1 ring-primary"
        )}
    >
        <div className="flex items-center gap-2 overflow-hidden">
            <button 
                {...attributes} 
                {...listeners} 
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            >
                <GripVertical size={14} />
            </button>
            <span className="text-sm truncate capitalize" title={id}>{header}</span>
        </div>
        
        <button 
            onClick={(e) => {
                e.stopPropagation();
                toggleVisibility();
            }}
            className={cn(
                "p-1 rounded hover:bg-muted transition-colors",
                isVisible ? "text-primary" : "text-muted-foreground"
            )}
            title={isVisible ? "Hide" : "Show"}
        >
            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
    </div>
  );
}
