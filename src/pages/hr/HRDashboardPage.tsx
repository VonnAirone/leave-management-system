import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Users, ClipboardList, Clock, CheckCircle } from 'lucide-react';

export function HRDashboardPage() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingApplications: 0,
    approvedThisMonth: 0,
    rejectedThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employee'),
      supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted'),
      supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('actioned_at', startOfMonth),
      supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .gte('actioned_at', startOfMonth),
    ]).then(([empRes, pendingRes, approvedRes, rejectedRes]) => {
      setStats({
        totalEmployees: empRes.count ?? 0,
        pendingApplications: pendingRes.count ?? 0,
        approvedThisMonth: approvedRes.count ?? 0,
        rejectedThisMonth: rejectedRes.count ?? 0,
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  const cards = [
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      link: '/hr/employees',
    },
    {
      label: 'Pending Applications',
      value: stats.pendingApplications,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50',
      link: '/hr/applications',
    },
    {
      label: 'Approved (this month)',
      value: stats.approvedThisMonth,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
      link: '/hr/applications',
    },
    {
      label: 'Rejected (this month)',
      value: stats.rejectedThisMonth,
      icon: ClipboardList,
      color: 'text-red-600 bg-red-50',
      link: '/hr/applications',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">HR Dashboard</h1>
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
    </div>
  );
}
