import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../lib/AuthContext';
import {
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  FilePlus,
  Users,
  CreditCard,
  ClipboardList,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

export function AppLayout() {
  const { profile, signOut } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isHR = profile?.role === 'hr_admin';
  const isCOS = location.pathname.startsWith('/cos');
  const isAdmin = location.pathname.startsWith('/admin');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? isAdmin
          ? 'bg-purple-50 text-purple-700'
          : isCOS
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-blue-50 text-blue-700'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  const sidebarTitle = isAdmin ? 'Admin' : isCOS ? 'COS System' : 'Leave System';
  const SidebarIcon = isAdmin ? Settings : isCOS ? FileSpreadsheet : FileText;
  const sidebarIconColor = isAdmin ? 'text-purple-600' : isCOS ? 'text-emerald-600' : 'text-blue-600';
  const mobileTitle = isAdmin ? 'Admin Settings' : isCOS ? 'COS Management' : 'Leave Management';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-800">{mobileTitle}</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } lg:block fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r flex-shrink-0`}
        >
          <div className="flex flex-col h-full">
            <div className="hidden lg:flex items-center gap-2 px-6 py-5 border-b">
              <SidebarIcon className={sidebarIconColor} size={24} />
              <h1 className="text-lg font-bold text-gray-800">{sidebarTitle}</h1>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {isAdmin ? (
                <>
                  <NavLink to="/admin/settings" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <Settings size={18} />
                    Settings
                  </NavLink>
                </>
              ) : isCOS ? (
                <>
                  <NavLink to="/cos/dashboard" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <LayoutDashboard size={18} />
                    Dashboard
                  </NavLink>
                  <NavLink to="/cos/list" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <ClipboardList size={18} />
                    COS List
                  </NavLink>
                </>
              ) : isHR ? (
                <>
                  <NavLink to="/hr/dashboard" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <LayoutDashboard size={18} />
                    Dashboard
                  </NavLink>
                  <NavLink to="/hr/applications" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <ClipboardList size={18} />
                    Applications
                  </NavLink>
                  <NavLink to="/hr/employees" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <Users size={18} />
                    Employees
                  </NavLink>
                  <NavLink to="/hr/credits" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <CreditCard size={18} />
                    Leave Credits
                  </NavLink>
                  <NavLink to="/hr/activity-log" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <ScrollText size={18} />
                    Activity Log
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/dashboard" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <LayoutDashboard size={18} />
                    Dashboard
                  </NavLink>
                  <NavLink to="/apply" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <FilePlus size={18} />
                    Apply for Leave
                  </NavLink>
                  <NavLink to="/applications" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                    <ClipboardList size={18} />
                    My Applications
                  </NavLink>
                </>
              )}
            </nav>

            <div className="px-3 py-4 border-t">
              <div className="px-4 py-2 mb-2">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
