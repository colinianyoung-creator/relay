import { Routes, Route } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Browse } from '@/pages/Browse';
import { ListingDetail } from '@/pages/ListingDetail';
import { CreateListing } from '@/pages/CreateListing';
import { Account } from '@/pages/Account';
import { HowItWorks } from '@/pages/HowItWorks';
import { SellerProfile } from '@/pages/SellerProfile';
import { WantedBoard } from '@/pages/WantedBoard';
import { CreateWanted } from '@/pages/CreateWanted';
import { WantedDetail } from '@/pages/WantedDetail';
import { ListingCheckoutConfirm } from '@/pages/ListingCheckoutConfirm';
import { PurchaseCheckoutConfirm } from '@/pages/PurchaseCheckoutConfirm';
import { Terms } from '@/pages/Terms';
import { Privacy } from '@/pages/Privacy';
import { AdminReports } from '@/pages/AdminReports';
import { AdminUsers } from '@/pages/AdminUsers';
import { AdminOrders } from '@/pages/AdminOrders';
import { AdminAuditLog } from '@/pages/AdminAuditLog';
import { FleetBoard } from '@/pages/FleetBoard';
import { FleetDetail } from '@/pages/FleetDetail';
import { CreateFleetBundle } from '@/pages/CreateFleetBundle';
import { CreateFleetListing } from '@/pages/CreateFleetListing';
import { FleetCheckoutConfirm } from '@/pages/FleetCheckoutConfirm';

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/sell" element={<CreateListing />} />
          <Route path="/sell/confirm" element={<ListingCheckoutConfirm />} />
          <Route path="/sell/fleet/new" element={<CreateFleetListing />} />
          <Route path="/sell/fleet/existing" element={<CreateFleetBundle />} />
          <Route path="/sell/fleet/confirm" element={<FleetCheckoutConfirm />} />
          <Route path="/purchase/confirm" element={<PurchaseCheckoutConfirm />} />
          <Route path="/fleets" element={<FleetBoard />} />
          <Route path="/fleet/:id" element={<FleetDetail />} />
          <Route path="/wanted" element={<WantedBoard />} />
          <Route path="/wanted/new" element={<CreateWanted />} />
          <Route path="/wanted/:id" element={<WantedDetail />} />
          <Route path="/account" element={<Account />} />
          <Route path="/seller/:id" element={<SellerProfile />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/log" element={<AdminAuditLog />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
