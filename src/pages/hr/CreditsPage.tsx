import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, LeaveType, LeaveCredit } from '../../types/database';
import { X, Plus } from 'lucide-react';
import { DepartmentFilter } from '../../components/shared/DepartmentFilter';
import { Pagination } from '../../components/shared/Pagination';

const PAGE_SIZE = 20;

interface CreditRow extends LeaveCredit {
  employee?: Profile;
  leave_type?: LeaveType;
}

interface GroupedCredits {
  employee: Profile;
  vl?: CreditRow;
  sl?: CreditRow;
}

export function CreditsPage() {
  const [groupedCredits, setGroupedCredits] = useState<GroupedCredits[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCredit, setEditingCredit] = useState<CreditRow | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCredits = useCallback(async () => {
    setLoading(true);

    // Step 1: Fetch paginated employees
    let empQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('last_name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (departmentFilter) {
      empQuery = empQuery.eq('office_department', departmentFilter);
    }

    const { data: pageEmployees, count } = await empQuery;
    setTotalCount(count ?? 0);

    if (!pageEmployees || pageEmployees.length === 0) {
      setGroupedCredits([]);
      setLoading(false);
      return;
    }

    // Step 2: Fetch credits for only these employees
    const employeeIds = pageEmployees.map(e => e.id);
    const { data: credits } = await supabase
      .from('leave_credits')
      .select('*, leave_type:leave_types(*)')
      .eq('year', year)
      .in('employee_id', employeeIds);

    // Step 3: Group credits by employee
    const grouped = new Map<string, GroupedCredits>();
    pageEmployees.forEach(emp => {
      grouped.set(emp.id, { employee: emp });
    });

    (credits ?? []).forEach((credit: CreditRow) => {
      const entry = grouped.get(credit.employee_id);
      if (!entry) return;
      if (credit.leave_type?.code === 'VL') {
        entry.vl = credit;
      } else if (credit.leave_type?.code === 'SL') {
        entry.sl = credit;
      }
    });

    setGroupedCredits(
      Array.from(grouped.values()).sort((a, b) =>
        a.employee.last_name.localeCompare(b.employee.last_name)
      )
    );
    setLoading(false);
  }, [page, departmentFilter, year]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('office_department')
      .eq('role', 'employee')
      .not('office_department', 'is', null)
      .order('office_department');
    const unique = [...new Set((data ?? []).map(d => d.office_department).filter(Boolean))] as string[];
    setDepartments(unique);
  };

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').eq('role', 'employee').eq('is_active', true).order('last_name'),
      supabase.from('leave_types').select('*').eq('is_active', true).order('id'),
    ]).then(([empRes, ltRes]) => {
      setEmployees(empRes.data ?? []);
      setLeaveTypes(ltRes.data ?? []);
    });
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const amount = parseFloat(adjustmentAmount);

    if (editingId && editingCredit) {
      const newTotal = editingCredit.total_earned + amount;
      await supabase
        .from('leave_credits')
        .update({ total_earned: Math.max(0, newTotal) })
        .eq('id', editingId);
    } else {
      // For new credits, the adjustment amount becomes the initial earned total
      await supabase.from('leave_credits').upsert(
        {
          employee_id: selectedEmployee,
          leave_type_id: parseInt(selectedLeaveType),
          total_earned: Math.max(0, amount),
          total_used: 0,
          year,
        },
        { onConflict: 'employee_id,leave_type_id,year' }
      );
    }

    setShowModal(false);
    resetForm();
    setSaving(false);
    fetchCredits();
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingCredit(null);
    setSelectedEmployee('');
    setSelectedLeaveType('');
    setAdjustmentAmount('');
    setAdjustmentReason('');
  };

  const openEdit = (credit: CreditRow) => {
    setEditingId(credit.id);
    setEditingCredit(credit);
    setSelectedEmployee(credit.employee_id);
    setSelectedLeaveType(String(credit.leave_type_id));
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setShowModal(true);
  };

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setPage(0);
  };

  const handleDepartmentChange = (dept: string) => {
    setDepartmentFilter(dept);
    setPage(0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Leave Credits</h1>
          <select
            value={year}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Adjust Credits
        </button>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg">
        <strong>Monthly Accrual:</strong> Per CSC Omnibus Rules, employees earn 1.25 VL + 1.25 SL per month of service. 
        Credits are auto-created on signup (pro-rated) and accrue monthly. Use "Adjust Credits" for manual corrections.
      </div>

      {/* Department Filter */}
      <div className="mb-4">
        <DepartmentFilter
          departments={departments}
          selected={departmentFilter}
          onChange={handleDepartmentChange}
          resultCount={departmentFilter ? totalCount : undefined}
          resultLabel="employee"
        />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : groupedCredits.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No credits set for {year}. Click "Adjust Credits" to add.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th rowSpan={2} className="text-left px-4 py-2 text-gray-500 font-medium border-r">Employee</th>
                  <th colSpan={4} className="text-center px-4 py-2 text-gray-500 font-medium border-r bg-blue-50">Vacation Leave (VL)</th>
                  <th colSpan={4} className="text-center px-4 py-2 text-gray-500 font-medium bg-green-50">Sick Leave (SL)</th>
                </tr>
                <tr className="border-b">
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-blue-50">Earned</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-blue-50">Used</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-blue-50">Balance</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs border-r bg-blue-50">Action</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-green-50">Earned</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-green-50">Used</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-green-50">Balance</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs bg-green-50">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groupedCredits.map((row) => {
                  const vlBalance = row.vl ? row.vl.total_earned - row.vl.total_used : 0;
                  const slBalance = row.sl ? row.sl.total_earned - row.sl.total_used : 0;
                  return (
                    <tr key={row.employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 border-r">
                        {row.employee.last_name}, {row.employee.first_name}
                        <div className="text-xs text-gray-500">{row.employee.office_department}</div>
                      </td>
                      {/* VL Columns */}
                      <td className="px-3 py-3 text-center text-gray-600">{row.vl?.total_earned.toFixed(2) ?? '—'}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{row.vl?.total_used.toFixed(2) ?? '—'}</td>
                      <td className="px-3 py-3 text-center">
                        {row.vl ? (
                          <span className={`font-semibold ${vlBalance <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {vlBalance.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center border-r">
                        {row.vl ? (
                          <button onClick={() => openEdit(row.vl!)} className="text-blue-600 hover:text-blue-800 text-xs">
                            Adjust
                          </button>
                        ) : '—'}
                      </td>
                      {/* SL Columns */}
                      <td className="px-3 py-3 text-center text-gray-600">{row.sl?.total_earned.toFixed(2) ?? '—'}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{row.sl?.total_used.toFixed(2) ?? '—'}</td>
                      <td className="px-3 py-3 text-center">
                        {row.sl ? (
                          <span className={`font-semibold ${slBalance <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {slBalance.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.sl ? (
                          <button onClick={() => openEdit(row.sl!)} className="text-blue-600 hover:text-blue-800 text-xs">
                            Adjust
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Set/Adjust Credits Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Adjust Credits' : 'Set Leave Credits'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingId && editingCredit ? (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      {editingCredit.employee?.last_name}, {editingCredit.employee?.first_name}
                    </p>
                    <p className="text-xs text-gray-500">{editingCredit.leave_type?.name} — {year}</p>
                    <div className="grid grid-cols-3 gap-3 mt-2 pt-2 border-t">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Earned</p>
                        <p className="text-sm font-semibold text-gray-900">{editingCredit.total_earned.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Used</p>
                        <p className="text-sm font-semibold text-gray-900">{editingCredit.total_used.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Balance</p>
                        <p className={`text-sm font-semibold ${(editingCredit.total_earned - editingCredit.total_used) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(editingCredit.total_earned - editingCredit.total_used).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adjustment (days)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. +2.5 or -1.0"
                    />
                    {adjustmentAmount && !isNaN(parseFloat(adjustmentAmount)) && (
                      <p className="mt-1 text-xs text-gray-500">
                        Earned: <span className="font-medium">{editingCredit.total_earned.toFixed(2)}</span> → <span className={`font-medium ${(Math.max(0, editingCredit.total_earned + parseFloat(adjustmentAmount))) < editingCredit.total_earned ? 'text-red-600' : 'text-green-600'}`}>{Math.max(0, editingCredit.total_earned + parseFloat(adjustmentAmount)).toFixed(2)}</span>
                        {' | '}
                        Balance: <span className="font-medium">{(editingCredit.total_earned - editingCredit.total_used).toFixed(2)}</span> → <span className={`font-medium ${(Math.max(0, editingCredit.total_earned + parseFloat(adjustmentAmount)) - editingCredit.total_used) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(Math.max(0, editingCredit.total_earned + parseFloat(adjustmentAmount)) - editingCredit.total_used).toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Manual correction, carry-over"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.last_name}, {emp.first_name} — {emp.office_department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <select
                      value={selectedLeaveType}
                      onChange={(e) => setSelectedLeaveType(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select leave type</option>
                      {leaveTypes.map((lt) => (
                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Initial Credits (days)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 15"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !adjustmentAmount}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Apply Adjustment' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
