import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, Package, Settings, ChevronRight, Menu } from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function DashboardLayout() {
  const [vendors, setVendors] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await api.get('/vendors');
      setVendors(response.data);
    } catch (error) {
      console.error("Failed to fetch vendors", error);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-card border-r border-border flex flex-col transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-border h-14">
          {isSidebarOpen && (
             <span className="font-black text-xl truncate tracking-tighter animate-gradient bg-gradient-to-r from-gray-900 via-gray-500 to-gray-900 dark:from-white dark:via-gray-400 dark:to-white">
               Fat Ass DataBase
             </span>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-muted rounded">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <NavItem 
            to="/" 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            isOpen={isSidebarOpen} 
            active={location.pathname === '/'}
          />
          <NavItem 
            to="/amazon-data" 
            icon={<Package size={20} />} 
            label="Amazon Data" 
            isOpen={isSidebarOpen} 
            active={location.pathname === '/amazon-data'}
          />
          
          <div className="px-3 py-2 mt-4">
             {isSidebarOpen && <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Vendors</h3>}
             <div className="space-y-1">
               {vendors.map((vendor, idx) => (
                 <Link
                    key={idx}
                    to={`/vendor/${encodeURIComponent(vendor.Vendor)}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted text-sm",
                      location.pathname.includes(encodeURIComponent(vendor.Vendor)) ? "bg-muted font-medium text-primary" : "text-muted-foreground"
                    )}
                    title={vendor.Vendor}
                 >
                   <Store size={18} />
                   {isSidebarOpen && <span className="truncate">{vendor.Vendor}</span>}
                 </Link>
               ))}
             </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-6">
           {/* Breadcrumbs or Title could go here */}
           <div className="text-sm text-muted-foreground">
             Workspace / <span className="text-foreground font-medium">Global</span>
           </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet context={{ refreshVendors: fetchVendors }} />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, isOpen, active }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 mx-2 rounded-md transition-colors hover:bg-muted",
        active ? "bg-muted font-medium text-primary" : "text-muted-foreground"
      )}
    >
      {icon}
      {isOpen && <span>{label}</span>}
    </Link>
  );
}
