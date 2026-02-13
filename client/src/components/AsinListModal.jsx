import { X, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function AsinListModal({ isOpen, onClose, asins = [] }) {
  if (!isOpen) return null;

  const handleCopy = (asin) => {
    navigator.clipboard.writeText(asin);
    toast.success('ASIN copied to clipboard');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-lg shadow-xl border border-border flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold">Linked ASINs ({asins.length})</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {asins.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No ASINs links found.</p>
          ) : (
            asins.map((asin, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded border hover:bg-muted/50 transition-colors group">
                <span className="font-mono text-sm">{asin}</span>
                <button 
                  onClick={() => handleCopy(asin)}
                  className="p-1.5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all bg-background border rounded shadow-sm"
                  title="Copy ASIN"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/10">
          <button 
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
