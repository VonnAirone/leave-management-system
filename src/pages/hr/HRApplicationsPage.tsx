import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../lib/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DepartmentFilter } from '../../components/shared/DepartmentFilter';
import { Pagination } from '../../components/shared/Pagination';
import type { LeaveApplication, LeaveStatus } from '../../types/database';
import { CheckCircle, XCircle, X, FileDown } from 'lucide-react';

const PAGE_SIZE = 20;

export function HRApplicationsPage() {
  const { profile } = useAuthContext();
  const [apps, setApps] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'all'>('submitted');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Modal state
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [daysWithPay, setDaysWithPay] = useState('');
  const [daysWithoutPay, setDaysWithoutPay] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('leave_applications')
      .select('*, leave_type:leave_types(*), employee:profiles!leave_applications_employee_id_fkey(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }
    if (departmentFilter) {
      query = query.eq('office_department', departmentFilter);
    }

    const { data, count } = await query;
    setApps(data ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, filterStatus, departmentFilter]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('offices')
      .select('name')
      .eq('is_active', true)
      .order('name');
    setDepartments((data ?? []).map(d => d.name));
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !action || !profile) return;
    setProcessing(true);

    const updates: Record<string, unknown> = {
      status: action === 'approve' ? 'approved' : 'rejected',
      actioned_by: profile.id,
      actioned_at: new Date().toISOString(),
      recommendation: action === 'approve' ? 'for_approval' : 'for_disapproval',
      recommended_by: profile.id,
    };

    if (action === 'approve') {
      updates.approved_days_with_pay = parseFloat(daysWithPay) || selectedApp.num_working_days;
      updates.approved_days_without_pay = parseFloat(daysWithoutPay) || 0;
    } else {
      updates.disapproval_reason = remarks;
      updates.recommendation_disapproval_reason = remarks;
    }

    // Build all promises to run concurrently: update application + deduct credits + audit log
    const updateAppPromise = supabase
      .from('leave_applications')
      .update(updates)
      .eq('id', selectedApp.id);

    const auditPromise = supabase.from('audit_logs').insert({
      action: action === 'approve' ? 'leave_approved' : 'leave_rejected',
      entity_type: 'leave_application',
      entity_id: selectedApp.id,
      performed_by: profile.id,
      details: {
        application_number: selectedApp.application_number,
        employee_name: selectedApp.employee_name,
        leave_type: selectedApp.leave_type?.name,
        dates: `${selectedApp.inclusive_date_start} — ${selectedApp.inclusive_date_end}`,
        num_working_days: selectedApp.num_working_days,
        ...(action === 'approve'
          ? { days_with_pay: parseFloat(daysWithPay) || selectedApp.num_working_days, days_without_pay: parseFloat(daysWithoutPay) || 0 }
          : { reason: remarks }),
      },
    });

    // Deduct credits on approval (must fetch first, then update)
    let creditPromise: Promise<unknown> = Promise.resolve();
    if (action === 'approve') {
      const year = new Date(selectedApp.inclusive_date_start).getFullYear();
      creditPromise = Promise.resolve(supabase
        .from('leave_credits')
        .select('id, total_used')
        .eq('employee_id', selectedApp.employee_id)
        .eq('leave_type_id', selectedApp.leave_type_id)
        .eq('year', year)
        .single()
        .then(({ data: credit }) => {
          if (credit) {
            return supabase
              .from('leave_credits')
              .update({ total_used: credit.total_used + selectedApp.num_working_days })
              .eq('id', credit.id);
          }
        }));
    }

    // Run all three operations concurrently
    const [appResult] = await Promise.all([updateAppPromise, auditPromise, creditPromise]);

    if (appResult.error) {
      alert('Error: ' + appResult.error.message);
    } else {
      setSelectedApp(null);
      setAction(null);
      setRemarks('');
      setDaysWithPay('');
      setDaysWithoutPay('');
      fetchApps();
    }
    setProcessing(false);
  };

  const downloadPdf = async (appId: string) => {
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
    } catch {
      alert('Failed to generate PDF.');
    }
  };

  const handleStatusChange = (status: LeaveStatus | 'all') => {
    setFilterStatus(status);
    setPage(0);
  };

  const handleDepartmentChange = (dept: string) => {
    setDepartmentFilter(dept);
    setPage(0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Applications</h1>
        <select
          value={filterStatus}
          onChange={(e) => handleStatusChange(e.target.value as LeaveStatus | 'all')}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="submitted">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Department Filter */}
      <div className="mb-4">
        <DepartmentFilter
          departments={departments}
          selected={departmentFilter}
          onChange={handleDepartmentChange}
          resultCount={departmentFilter ? totalCount : undefined}
          resultLabel="application"
        />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : apps.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No applications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Office</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Leave Type</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Dates</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Days</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apps.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {app.employee_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.office_department}</td>
                    <td className="px-4 py-3 text-gray-600">
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
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {app.status === 'submitted' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setAction('approve');
                                setDaysWithPay(String(app.num_working_days));
                              }}
                              className="text-green-600 hover:text-green-800"
                              title="Approve"
                            >
                              <CheckCircle size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setAction('reject');
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Reject"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => downloadPdf(app.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Download PDF"
                        >
                          <FileDown size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Approve/Reject Modal */}
      {selectedApp && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {action === 'approve' ? 'Approve' : 'Reject'} Application
              </h2>
              <button
                onClick={() => {
                  setSelectedApp(null);
                  setAction(null);
                  setRemarks('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAction} className="p-6 space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <strong>Employee:</strong> {selectedApp.employee_name}
                </p>
                <p>
                  <strong>Leave Type:</strong> {selectedApp.leave_type?.name}
                </p>
                <p>
                  <strong>Dates:</strong> {selectedApp.inclusive_date_start} —{' '}
                  {selectedApp.inclusive_date_end} ({selectedApp.num_working_days} days)
                </p>
              </div>

              {action === 'approve' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days with pay
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={daysWithPay}
                      onChange={(e) => setDaysWithPay(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days without pay
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={daysWithoutPay}
                      onChange={(e) => setDaysWithoutPay(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {action === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for disapproval
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter reason for disapproval..."
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedApp(null);
                    setAction(null);
                    setRemarks('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                    action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing
                    ? 'Processing...'
                    : action === 'approve'
                      ? 'Confirm Approval'
                      : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
