import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Browse } from '@/pages/Browse';
import { ListingDetail } from '@/pages/ListingDetail';
import { CreateListing } from '@/pages/CreateListing';
import { Account } from '@/pages/Account';
import { HowItWorks } from '@/pages/HowItWorks';
import { SellerProfile } from '@/pages/SellerProfile';
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
import { ScanHandover } from '@/pages/ScanHandover';

// Redirect the old /fleet(s) paths to their /club-gear equivalents, so any
// existing bookmarks/shared links or emails already sent (which used the
// old URLs) keep working after the rename.
function RedirectFleetDetail() {
  const { id } = useParams();
  return <Navigate to={`/club-gear/${id}`} replace />;
}

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
          <Route path="/sell/club-gear/new" element={<CreateFleetListing />} />
          <Route path="/sell/club-gear/existing" element={<CreateFleetBundle />} />
          <Route path="/purchase/confirm" element={<PurchaseCheckoutConfirm />} />
          <Route path="/club-gear" element={<FleetBoard />} />
          <Route path="/club-gear/:id" element={<FleetDetail />} />
          <Route path="/scan/:token" element={<ScanHandover />} />
          {/* Old URLs — redirect rather than break existing links */}
          <Route path="/sell/fleet/new" element={<Navigate to="/sell/club-gear/new" replace />} />
          <Route path="/sell/fleet/existing" element={<Navigate to="/sell/club-gear/existing" replace />} />
          <Route path="/fleets" element={<Navigate to="/club-gear" replace />} />
          <Route path="/fleet/:id" element={<RedirectFleetDetail />} />
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
