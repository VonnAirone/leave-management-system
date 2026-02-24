import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../lib/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import type { LeaveCredit, LeaveApplication } from '../../types/database';
import { FilePlus, Calendar, TrendingDown } from 'lucide-react';

export function EmployeeDashboard() {
  const { profile } = useAuthContext();
  const [credits, setCredits] = useState<LeaveCredit[]>([]);
  const [recentApps, setRecentApps] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const year = new Date().getFullYear();

    Promise.all([
      supabase
        .from('leave_credits')
        .select('*, leave_type:leave_types(*)')
        .eq('employee_id', profile.id)
        .eq('year', year),
      supabase
        .from('leave_applications')
        .select('*, leave_type:leave_types(*)')
        .eq('employee_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([creditsRes, appsRes]) => {
      setCredits(creditsRes.data ?? []);
      setRecentApps(appsRes.data ?? []);
      setLoading(false);
    });
  }, [profile]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FilePlus size={16} />
          Apply for Leave
        </Link>
      </div>

      {/* Leave Credits */}
      <div className="mb-2 text-xs text-gray-500">
        Per CSC Omnibus Rules: 1.25 days VL + 1.25 days SL earned monthly
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {credits.map((credit) => {
          const remaining = credit.total_earned - credit.total_used;
          return (
            <div key={credit.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">
                  {credit.leave_type?.name ?? 'Leave'}
                </h3>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{remaining.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">days remaining</p>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span>Earned: {credit.total_earned.toFixed(2)}</span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={12} /> Used: {credit.total_used.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
        {credits.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border p-8 text-center text-gray-500">
            No leave credits found for this year.
          </div>
        )}
      </div>

      {/* Recent Applications */}
      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
        </div>
        {recentApps.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No applications yet.</div>
        ) : (
          <div className="divide-y">
            {recentApps.map((app) => (
              <Link
                key={app.id}
                to={`/applications/${app.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {app.leave_type?.name ?? 'Leave'} — {app.num_working_days} day(s)
                  </p>
                  <p className="text-xs text-gray-500">
                    {app.inclusive_date_start} to {app.inclusive_date_end}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
