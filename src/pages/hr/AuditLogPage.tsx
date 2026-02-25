import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Pagination } from '../../components/shared/Pagination';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  leave_approved: 'Leave Approved',
  leave_rejected: 'Leave Rejected',
  employee_created: 'Employee Created',
  employee_updated: 'Employee Updated',
  credits_adjusted: 'Credits Adjusted',
};

const ACTION_COLORS: Record<string, string> = {
  leave_approved: 'bg-green-100 text-green-700',
  leave_rejected: 'bg-red-100 text-red-700',
  employee_created: 'bg-blue-100 text-blue-700',
  employee_updated: 'bg-yellow-100 text-yellow-700',
  credits_adjusted: 'bg-purple-100 text-purple-700',
};

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  details: Record<string, unknown>;
  created_at: string;
  performer?: { first_name: string; last_name: string } | null;
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*, performer:profiles!audit_logs_performed_by_fkey(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }

    const { data, count } = await query;
    setLogs(
      (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        action: row.action as string,
        entity_type: row.entity_type as string,
        entity_id: row.entity_id as string,
        performed_by: row.performed_by as string,
        details: (row.details as Record<string, unknown>) ?? {},
        created_at: row.created_at as string,
        performer: row.performer as { first_name: string; last_name: string } | null,
      }))
    );
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (action: string) => {
    setFilterAction(action);
    setPage(0);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDetailSummary = (log: AuditLog): string => {
    const d = log.details;
    switch (log.action) {
      case 'leave_approved':
        return `${d.employee_name} — ${d.leave_type ?? 'Leave'} (${d.days_with_pay ?? 0} days w/ pay)`;
      case 'leave_rejected':
        return `${d.employee_name} — ${d.leave_type ?? 'Leave'}${d.reason ? `: ${d.reason}` : ''}`;
      case 'employee_created':
        return `${d.employee_name} — ${d.department ?? ''}`;
      case 'employee_updated': {
        const changes = d.changes as string[] | undefined;
        return `${d.employee_name}${changes?.length ? ` — changed: ${changes.join(', ')}` : ''}`;
      }
      case 'credits_adjusted':
        return `${d.employee_name} — ${d.leave_type ?? ''} ${d.adjustment ?? ''} days${d.reason ? ` (${d.reason})` : ''}`;
      default:
        return JSON.stringify(d);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <select
          value={filterAction}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No activity logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Date & Time</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Details</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-md truncate" title={getDetailSummary(log)}>
                      {getDetailSummary(log)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.performer
                        ? `${log.performer.first_name} ${log.performer.last_name}`
                        : '—'}
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
