import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { COSWorker } from '../../types/database';
import { FileSpreadsheet, Users, Clock, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

export function COSDashboardPage() {
  const [workers, setWorkers] = useState<COSWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('cos_workers_view')
        .select('*')
        .order('contract_end', { ascending: true });
      setWorkers(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const active = workers.filter((w) => w.status === 'active');
  const expiring = workers.filter((w) => w.status === 'expiring');
  const expired = workers.filter((w) => w.status === 'expired');
  const cosCount = workers.filter((w) => w.employment_type === 'cos').length;
  const joCount = workers.filter((w) => w.employment_type === 'jo').length;

  const cards = [
    { label: 'Total COS/JO Workers', value: workers.length, icon: Users, color: 'text-emerald-600 bg-emerald-50', link: '/cos/list' },
    { label: 'Active Contracts', value: active.length, icon: CheckCircle, color: 'text-blue-600 bg-blue-50', link: '/cos/list' },
    { label: 'Expiring Soon', value: expiring.length, icon: Clock, color: 'text-yellow-600 bg-yellow-50', link: '/cos/list' },
    { label: 'Expired', value: expired.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50', link: '/cos/list' },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>;
  }

  // Group by department
  const deptMap = new Map<string, { cos: number; jo: number }>();
  workers.forEach((w) => {
    const dept = w.office_department;
    const entry = deptMap.get(dept) ?? { cos: 0, jo: 0 };
    if (w.employment_type === 'jo') entry.jo++;
    else entry.cos++;
    deptMap.set(dept, entry);
  });
  const departments = Array.from(deptMap.entries())
    .map(([dept, counts]) => ({ dept, ...counts, total: counts.cos + counts.jo }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/modules"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Back to Modules
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <FileSpreadsheet size={22} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">COS Management</h1>
            <p className="text-sm text-gray-500">
              {cosCount} COS · {joCount} JO — per CSC-COA-DBM JC No. 1, s. 2017
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Workers by Office/Department */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workers by Office/Department</h2>
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Office/Department</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">COS</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">JO</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No records yet</td>
                  </tr>
                ) : (
                  departments.map((d) => (
                    <tr key={d.dept} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{d.dept}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{d.cos}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{d.jo}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">{d.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Contracts Expiring This Month */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contracts Expiring Within 30 Days</h2>
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Position/Designation</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Office/Dept</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Contract End</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expiring.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      <Clock size={28} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No contracts expiring within the next 30 days</p>
                    </td>
                  </tr>
                ) : (
                  expiring.map((w) => {
                    const daysLeft = Math.ceil((new Date(w.contract_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {w.last_name}, {w.first_name} {w.middle_name ?? ''}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{w.position_title}</td>
                        <td className="px-4 py-3 text-gray-600">{w.office_department}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            w.employment_type === 'cos' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {w.employment_type === 'jo' ? 'JO' : 'COS'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{w.contract_end}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
