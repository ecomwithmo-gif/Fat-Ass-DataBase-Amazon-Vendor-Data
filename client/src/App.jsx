import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import DashboardLayout from './layouts/DashboardLayout';
import VendorDashboard from './pages/VendorDashboard';
import VendorDetail from './pages/VendorDetail';
import AmazonDashboard from './pages/AmazonDashboard';

function App() {
  return (
    <Router>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<VendorDashboard />} />
          <Route path="amazon-data" element={<AmazonDashboard />} />
          <Route path="vendor/:vendorName" element={<VendorDetail />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
