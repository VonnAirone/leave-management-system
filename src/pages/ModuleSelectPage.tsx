import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext';
import { FileText, FileSpreadsheet, Settings, LogOut } from 'lucide-react';

const modules = [
  {
    id: 'leave',
    title: 'Leave Management',
    description: 'Apply for leave, track credits, and manage leave applications.',
    icon: FileText,
    color: 'blue',
    available: true,
  },
  {
    id: 'cos',
    title: 'COS Management',
    description: 'Manage Contracts of Service, track renewals, and monitor compliance.',
    icon: FileSpreadsheet,
    color: 'emerald',
    available: true,
  },
  {
    id: 'admin',
    title: 'Admin Settings',
    description: 'Manage positions, offices, and salary rates used across the system.',
    icon: Settings,
    color: 'purple',
    available: true,
  },
];

const colorMap: Record<string, { bg: string; iconBg: string; iconText: string; border: string; hover: string }> = {
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    border: 'border-blue-200',
    hover: 'hover:border-blue-400 hover:shadow-md',
  },
  emerald: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    border: 'border-emerald-200',
    hover: 'hover:border-emerald-400 hover:shadow-md',
  },
  purple: {
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    border: 'border-purple-200',
    hover: 'hover:border-purple-400 hover:shadow-md',
  },
};

export function ModuleSelectPage() {
  const { profile, signOut } = useAuthContext();
  const navigate = useNavigate();

  const handleModuleClick = (moduleId: string) => {
    if (moduleId === 'leave') {
      navigate(profile?.role === 'hr_admin' ? '/hr/dashboard' : '/dashboard');
    } else if (moduleId === 'cos') {
      navigate('/cos/dashboard');
    } else if (moduleId === 'admin') {
      navigate('/admin/settings');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">HR Information System</h1>
            <p className="text-sm text-gray-500">
              Welcome, {profile?.first_name} {profile?.last_name}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Module cards */}
      <div className="flex-1 flex justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900">Select a Module</h2>
            <p className="text-sm text-gray-500 mt-1">Choose a system to get started</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {modules.map((mod) => {
              const colors = colorMap[mod.color];
              const Icon = mod.icon;

              return (
                <button
                  key={mod.id}
                  onClick={() => handleModuleClick(mod.id)}
                  disabled={!mod.available}
                  className={`relative text-left p-6 rounded-xl border transition-all ${
                    mod.available
                      ? `bg-white ${colors.border} ${colors.hover} cursor-pointer`
                      : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  {!mod.available && (
                    <span className="absolute top-3 right-3 text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      Coming Soon
                    </span>
                  )}
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${
                      mod.available ? colors.iconBg : 'bg-gray-200'
                    } mb-4`}
                  >
                    <Icon size={24} className={mod.available ? colors.iconText : 'text-gray-400'} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{mod.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{mod.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
