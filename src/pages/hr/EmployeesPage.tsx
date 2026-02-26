import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../lib/AuthContext';
import type { Profile, LeaveApplication, Position, Office, SalaryRate, SalaryGrade, Role } from '../../types/database';
import { X, UserPlus, Users, Pencil, Plus, Trash2, Eye, FileDown } from 'lucide-react';
import { DepartmentFilter } from '../../components/shared/DepartmentFilter';
import { Pagination } from '../../components/shared/Pagination';
import { StatusBadge } from '../../components/shared/StatusBadge';

const PAGE_SIZE = 20;

interface BatchRow {
  email: string;
  password: string;
  firstName: string;
  middleName: string;
  lastName: string;
  position: string;
  salaryGrade: string;
  serviceStartDate: string;
}

interface BatchResult {
  total: number;
  created: number;
  errors: { row: number; name: string; message: string }[];
}

const emptyBatchRow = (): BatchRow => ({
  email: '', password: '', firstName: '', middleName: '',
  lastName: '', position: '', salaryGrade: '', serviceStartDate: '',
});

export function EmployeesPage() {
  const { profile: currentUser } = useAuthContext();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Batch add state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([emptyBatchRow(), emptyBatchRow(), emptyBatchRow()]);
  const [batchOffice, setBatchOffice] = useState('');

  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  // Reference data
  const [refPositions, setRefPositions] = useState<Position[]>([]);
  const [refOffices, setRefOffices] = useState<Office[]>([]);
  const [refSalaryGrades, setRefSalaryGrades] = useState<SalaryRate[]>([]);
  const [refRoles, setRefRoles] = useState<Role[]>([]);
  const [refSalaryGradesList, setRefSalaryGradesList] = useState<SalaryGrade[]>([]);

  // Resolve FK IDs from text values using reference data
  const resolveProfileFKs = (positionText: string, officeText: string, salaryGradeText: string, roleText: string = 'employee') => {
    const position_id = refPositions.find(p => p.title.toLowerCase() === positionText.trim().toLowerCase())?.id ?? null;
    const office_id = refOffices.find(o => o.name.toLowerCase() === officeText.trim().toLowerCase())?.id ?? null;
    const salary_grade_id = refSalaryGradesList.find(sg => sg.grade === salaryGradeText.trim())?.id ?? null;
    const role_id = refRoles.find(r => r.code === roleText)?.id ?? null;
    return { position_id, office_id, salary_grade_id, role_id };
  };

  // View employee state
  const [viewEmployee, setViewEmployee] = useState<Profile | null>(null);
  const [employeeApps, setEmployeeApps] = useState<LeaveApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewPage, setViewPage] = useState(0);
  const [viewTotalCount, setViewTotalCount] = useState(0);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [office, setOffice] = useState('');
  const [position, setPosition] = useState('');
  const [salaryGrade, setSalaryGrade] = useState('');
  const [serviceStartDate, setServiceStartDate] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('last_name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (departmentFilter) {
      query = query.eq('office_department', departmentFilter);
    }

    const { data, count } = await query;
    setEmployees(data ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, departmentFilter]);

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
    // Fetch reference data
    supabase.from('positions').select('*').eq('is_active', true).order('title').then(({ data }) => setRefPositions(data ?? []));
    supabase.from('offices').select('*').eq('is_active', true).order('name').then(({ data }) => setRefOffices(data ?? []));
    supabase.from('salary_rates').select('*').eq('is_active', true).order('salary_grade').order('step_increment').then(({ data }) => setRefSalaryGrades(data ?? []));
    supabase.from('roles').select('*').eq('is_active', true).then(({ data }) => setRefRoles(data ?? []));
    supabase.from('salary_grades').select('*').eq('is_active', true).then(({ data }) => setRefSalaryGradesList(data ?? []));
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setOffice('');
    setPosition('');
    setSalaryGrade('');
    setServiceStartDate('');
    setEditingId(null);
    setError('');
  };

  const openEdit = (emp: Profile) => {
    setEditingId(emp.id);
    setEmail(emp.email);
    setFirstName(emp.first_name);
    setMiddleName(emp.middle_name ?? '');
    setLastName(emp.last_name);
    setOffice(emp.office_department);
    setPosition(emp.position_title);
    setSalaryGrade(emp.salary_grade ?? '');
    setServiceStartDate(emp.service_start_date ?? '');
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (editingId) {
      // Update existing
      const fks = resolveProfileFKs(position, office, salaryGrade || '');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          office_department: office,
          position_title: position,
          salary_grade: salaryGrade || null,
          service_start_date: serviceStartDate || null,
          position_id: fks.position_id,
          office_id: fks.office_id,
          salary_grade_id: fks.salary_grade_id,
        })
        .eq('id', editingId);

      if (updateError) {
        setError(updateError.message);
      } else {
        // Find the original employee to detect changes
        const original = employees.find((e) => e.id === editingId);
        const changes: string[] = [];
        if (original) {
          if (original.first_name !== firstName) changes.push('first_name');
          if ((original.middle_name ?? '') !== middleName) changes.push('middle_name');
          if (original.last_name !== lastName) changes.push('last_name');
          if (original.office_department !== office) changes.push('office_department');
          if (original.position_title !== position) changes.push('position_title');
          if ((original.salary_grade ?? '') !== salaryGrade) changes.push('salary_grade');
          if ((original.service_start_date ?? '') !== serviceStartDate) changes.push('service_start_date');
        }
        if (currentUser) {
          await supabase.from('audit_logs').insert({
            action: 'employee_updated',
            entity_type: 'profile',
            entity_id: editingId,
            performed_by: currentUser.id,
            details: {
              employee_name: `${lastName}, ${firstName}`,
              department: office,
              changes,
            },
          });
        }
        setShowModal(false);
        resetForm();
        fetchEmployees();
      }
    } else {
      // Create new user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: 'employee',
          },
        },
      });

      if (authError) {
        setError(authError.message);
      } else if (authData.user) {
        // The trigger will create the profile, but we need to update it with full details
        // Small delay to let the trigger fire
        const newFks = resolveProfileFKs(position, office, salaryGrade || '', 'employee');
        await new Promise((r) => setTimeout(r, 1000));
        await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            office_department: office,
            position_title: position,
            salary_grade: salaryGrade || null,
            role: 'employee',
            position_id: newFks.position_id,
            office_id: newFks.office_id,
            salary_grade_id: newFks.salary_grade_id,
            role_id: newFks.role_id,
          })
          .eq('id', authData.user.id);

        if (currentUser) {
          await supabase.from('audit_logs').insert({
            action: 'employee_created',
            entity_type: 'profile',
            entity_id: authData.user.id,
            performed_by: currentUser.id,
            details: {
              employee_name: `${lastName}, ${firstName}`,
              email,
              department: office,
              position,
            },
          });
        }
        setShowModal(false);
        resetForm();
        fetchEmployees();
      }
    }
    setSaving(false);
  };

  const toggleActive = async (emp: Profile) => {
    await supabase
      .from('profiles')
      .update({ is_active: !emp.is_active })
      .eq('id', emp.id);
    fetchEmployees();
  };

  const resetBatch = () => {
    setBatchRows([emptyBatchRow(), emptyBatchRow(), emptyBatchRow()]);
    setBatchOffice('');

    setBatchProgress(0);
    setBatchResult(null);
  };

  const updateBatchRow = (index: number, field: keyof BatchRow, value: string) => {
    setBatchRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const addBatchRow = () => {
    setBatchRows(prev => [...prev, emptyBatchRow()]);
  };

  const removeBatchRow = (index: number) => {
    if (batchRows.length <= 1) return;
    setBatchRows(prev => prev.filter((_, i) => i !== index));
  };

  const createSingleEmployee = async (row: BatchRow, rowIndex: number): Promise<{ success: boolean; error?: { row: number; name: string; message: string } }> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: row.email,
      password: row.password,
      options: {
        data: {
          first_name: row.firstName,
          last_name: row.lastName,
          role: 'employee',
        },
      },
    });

    if (authError) {
      return { success: false, error: { row: rowIndex + 1, name: `${row.firstName} ${row.lastName}`, message: authError.message } };
    }

    if (authData.user) {
      // Wait for the auth trigger to create the profile row
      const batchFks = resolveProfileFKs(row.position, batchOffice, row.salaryGrade || '', 'employee');
      await new Promise((r) => setTimeout(r, 500));
      await supabase
        .from('profiles')
        .update({
          first_name: row.firstName,
          middle_name: row.middleName || null,
          last_name: row.lastName,
          office_department: batchOffice,
          position_title: row.position,
          salary_grade: row.salaryGrade || null,
          service_start_date: row.serviceStartDate || null,
          role: 'employee',
          position_id: batchFks.position_id,
          office_id: batchFks.office_id,
          salary_grade_id: batchFks.salary_grade_id,
          role_id: batchFks.role_id,
        })
        .eq('id', authData.user.id);
      return { success: true };
    }

    return { success: false, error: { row: rowIndex + 1, name: `${row.firstName} ${row.lastName}`, message: 'No user returned' } };
  };

  const handleBatchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.email && r.password && r.firstName && r.lastName);
    if (validRows.length === 0) return;

    setBatchSaving(true);
    setBatchProgress(0);
    const errors: BatchResult['errors'] = [];
    let created = 0;

    // Process in chunks of 5 concurrently to avoid rate limits
    const CONCURRENCY = 5;
    for (let i = 0; i < validRows.length; i += CONCURRENCY) {
      const chunk = validRows.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map((row, idx) => createSingleEmployee(row, i + idx))
      );

      for (const result of results) {
        if (result.success) {
          created++;
        } else if (result.error) {
          errors.push(result.error);
        }
      }
      setBatchProgress(Math.min(i + CONCURRENCY, validRows.length));
    }

    setBatchSaving(false);
    setBatchResult({ total: validRows.length, created, errors });
    fetchEmployees();
  };

  const fetchViewApps = useCallback(async (employeeId: string, pg: number) => {
    setLoadingApps(true);
    const { data, count } = await supabase
      .from('leave_applications')
      .select('*, leave_type:leave_types(*)', { count: 'exact' })
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);
    setEmployeeApps(data ?? []);
    setViewTotalCount(count ?? 0);
    setLoadingApps(false);
  }, []);

  const openView = (emp: Profile) => {
    setViewEmployee(emp);
    setEmployeeApps([]);
    setViewPage(0);
    setViewTotalCount(0);
    fetchViewApps(emp.id, 0);
  };

  const handleViewPageChange = (pg: number) => {
    setViewPage(pg);
    if (viewEmployee) fetchViewApps(viewEmployee.id, pg);
  };

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
    } catch {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDepartmentChange = (dept: string) => {
    setDepartmentFilter(dept);
    setPage(0);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetBatch();
              setBatchOffice(departmentFilter);
              setShowBatchModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Users size={16} />
            Batch Add
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={16} />
            Add Employee
          </button>
        </div>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Office</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Position</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Service Start</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Role</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {emp.last_name}, {emp.first_name} {emp.middle_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.office_department}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.position_title}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{emp.service_start_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.role === 'hr_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {emp.role === 'hr_admin' ? 'HR Admin' : 'Employee'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(emp)}
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openView(emp)}
                        className="text-gray-400 hover:text-blue-600"
                        title="View"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => openEdit(emp)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {!editingId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Office/Department
                  </label>
                  <select
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Office</option>
                    {refOffices.map((o) => (
                      <option key={o.id} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position Title
                  </label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Position</option>
                    {refPositions.map((p) => (
                      <option key={p.id} value={p.title}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salary Grade
                  </label>
                  <select
                    value={salaryGrade}
                    onChange={(e) => setSalaryGrade(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Salary Grade</option>
                    {refSalaryGrades.map((r) => (
                      <option key={r.id} value={r.salary_grade}>
                        {r.salary_grade} - Step {r.step_increment} (₱{r.monthly_rate.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Start Date
                  </label>
                  <input
                    type="date"
                    value={serviceStartDate}
                    onChange={(e) => setServiceStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used for leave credit accrual</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Batch Add Employees</h2>
                <p className="text-sm text-gray-500 mt-0.5">Set shared fields once, then add employees row by row</p>
              </div>
              <button
                onClick={() => { setShowBatchModal(false); resetBatch(); }}
                className="text-gray-400 hover:text-gray-600"
                disabled={batchSaving}
              >
                <X size={20} />
              </button>
            </div>

            {batchResult ? (
              <div className="p-6 space-y-4">
                <div className={`p-4 rounded-lg ${batchResult.errors.length === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  <p className={`font-semibold ${batchResult.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'}`}>
                    {batchResult.created} of {batchResult.total} employee{batchResult.total !== 1 ? 's' : ''} created successfully
                  </p>
                </div>
                {batchResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-700">Failed rows:</p>
                    {batchResult.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                        <span className="font-medium shrink-0">Row {err.row} ({err.name}):</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => { setShowBatchModal(false); resetBatch(); }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBatchSubmit} className="flex flex-col overflow-hidden">
                {/* Shared Fields */}
                <div className="px-6 py-4 bg-gray-50 border-b shrink-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Shared Fields (applied to all rows)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office/Department</label>
                      <select
                        value={batchOffice}
                        onChange={(e) => setBatchOffice(e.target.value)}
                        required
                        disabled={batchSaving}
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Select Office</option>
                        {refOffices.map((o) => (
                          <option key={o.id} value={o.name}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {batchSaving && (
                  <div className="px-6 py-3 bg-blue-50 border-b shrink-0">
                    <div className="flex items-center justify-between text-sm text-blue-700 mb-1">
                      <span>Creating employee {batchProgress} of {batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length}...</span>
                      <span>{Math.round((batchProgress / batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(batchProgress / batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Employee Rows Table */}
                <div className="overflow-auto flex-1 px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-2 text-gray-500 font-medium w-8">#</th>
                        <th className="pb-2 text-gray-500 font-medium">Email</th>
                        <th className="pb-2 text-gray-500 font-medium">Password</th>
                        <th className="pb-2 text-gray-500 font-medium">First Name</th>
                        <th className="pb-2 text-gray-500 font-medium">M.I.</th>
                        <th className="pb-2 text-gray-500 font-medium">Last Name</th>
                        <th className="pb-2 text-gray-500 font-medium">Position</th>
                        <th className="pb-2 text-gray-500 font-medium">Salary Grade</th>
                        <th className="pb-2 text-gray-500 font-medium">Service Start</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((row, i) => (
                        <tr key={i} className={batchSaving && batchProgress === i + 1 ? 'bg-blue-50 rounded' : ''}>
                          <td className="py-1 pr-2 text-gray-400 text-center">{i + 1}</td>
                          <td className="py-1 pr-1">
                            <input type="email" value={row.email} onChange={(e) => updateBatchRow(i, 'email', e.target.value)} disabled={batchSaving} placeholder="email@example.com" className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                          </td>
                          <td className="py-1 pr-1">
                            <input type="password" value={row.password} onChange={(e) => updateBatchRow(i, 'password', e.target.value)} disabled={batchSaving} placeholder="min 6 chars" minLength={6} className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                          </td>
                          <td className="py-1 pr-1">
                            <input type="text" value={row.firstName} onChange={(e) => updateBatchRow(i, 'firstName', e.target.value)} disabled={batchSaving} placeholder="First" className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                          </td>
                          <td className="py-1 pr-1">
                            <input type="text" value={row.middleName} onChange={(e) => updateBatchRow(i, 'middleName', e.target.value)} disabled={batchSaving} placeholder="M.I." className="w-16 px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                          </td>
                          <td className="py-1 pr-1">
                            <input type="text" value={row.lastName} onChange={(e) => updateBatchRow(i, 'lastName', e.target.value)} disabled={batchSaving} placeholder="Last" className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                          </td>
                          <td className="py-1 pr-1">
                            <select value={row.position} onChange={(e) => updateBatchRow(i, 'position', e.target.value)} disabled={batchSaving} className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                              <option value="">Select</option>
                              {refPositions.map((p) => (
                                <option key={p.id} value={p.title}>{p.title}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-1">
                            <select value={row.salaryGrade} onChange={(e) => updateBatchRow(i, 'salaryGrade', e.target.value)} disabled={batchSaving} className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                              <option value="">Select</option>
                              {refSalaryGrades.map((r) => (
                                <option key={r.id} value={r.salary_grade}>{r.salary_grade}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-1">
                            <input type="date" value={row.serviceStartDate} onChange={(e) => updateBatchRow(i, 'serviceStartDate', e.target.value)} disabled={batchSaving} className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                          </td>
                          <td className="py-1">
                            <button
                              type="button"
                              onClick={() => removeBatchRow(i)}
                              disabled={batchSaving || batchRows.length <= 1}
                              className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Remove row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={addBatchRow}
                    disabled={batchSaving}
                    className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Add Row
                  </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
                  <p className="text-sm text-gray-500">
                    {batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length} of {batchRows.length} rows filled
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowBatchModal(false); resetBatch(); }}
                      disabled={batchSaving}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={batchSaving || batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length === 0}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {batchSaving ? `Creating...` : `Create ${batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length} Employee${batchRows.filter(r => r.email && r.password && r.firstName && r.lastName).length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {viewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] rounded-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Employee Details</h2>
              <button onClick={() => setViewEmployee(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Employee Info */}
            <div className="px-6 py-4 bg-gray-50 border-b shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {viewEmployee.last_name}, {viewEmployee.first_name} {viewEmployee.middle_name || ''}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div>
                  <p className="text-xs text-gray-500">Department</p>
                  <p className="text-sm text-gray-900">{viewEmployee.office_department || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Position</p>
                  <p className="text-sm text-gray-900">{viewEmployee.position_title || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Salary Grade</p>
                  <p className="text-sm text-gray-900">{viewEmployee.salary_grade || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Service Start</p>
                  <p className="text-sm text-gray-900">{viewEmployee.service_start_date || '—'}</p>
                </div>
              </div>
            </div>

            {/* Leave Requests */}
            <div className="overflow-auto flex-1 px-6 py-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Leave Applications</h4>
              {loadingApps ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : employeeApps.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No leave applications found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Application No</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Leave Type</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Dates</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">Days</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">Status</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">Filed</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {employeeApps.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-mono text-xs">{app.application_number}</td>
                        <td className="px-3 py-2 text-gray-700">{app.leave_type?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {app.inclusive_date_start} — {app.inclusive_date_end}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">{app.num_working_days}</td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500 text-xs">{app.date_of_filing}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => downloadPdf(app.id)}
                            disabled={downloading === app.id}
                            className="text-gray-400 hover:text-blue-600 disabled:opacity-50"
                            title="View Document"
                          >
                            <FileDown size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Pagination page={viewPage} totalCount={viewTotalCount} pageSize={PAGE_SIZE} onPageChange={handleViewPageChange} />
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t bg-gray-50 shrink-0">
              <button
                onClick={() => setViewEmployee(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
