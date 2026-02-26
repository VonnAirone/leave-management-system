import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../lib/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Pagination } from '../../components/shared/Pagination';
import type { LeaveApplication } from '../../types/database';
import { FileDown } from 'lucide-react';

const PAGE_SIZE = 20;

export function ApplicationsPage() {
  const { profile } = useAuthContext();
  const [apps, setApps] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchApps = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, count } = await supabase
      .from('leave_applications')
      .select('*, leave_type:leave_types(*)', { count: 'exact' })
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setApps(data ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [profile, page]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const downloadPdf = async (appId: string) => {
    setDownloading(appId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ application_id: appId }),
        }
      );
      if (!res.ok) throw new Error('PDF generation failed');
      const html = await res.text();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (err) {
      alert('Failed to generate PDF. Please try again.');
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
        <Link
          to="/apply"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          New Application
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {apps.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No applications yet.{' '}
            <Link to="/apply" className="text-blue-600 hover:underline">
              Submit your first leave application
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Leave Type</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Dates</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Days</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Filed</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apps.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {app.leave_type?.name ?? 'Leave'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {app.inclusive_date_start} — {app.inclusive_date_end}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {app.num_working_days}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {new Date(app.date_of_filing).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => downloadPdf(app.id)}
                        disabled={downloading === app.id}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        title="Download PDF"
                      >
                        <FileDown size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
