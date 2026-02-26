import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { COSWorker, COSEmploymentType, COSFundSource, COSNatureOfHiring, Position, Office, EmploymentType, HiringNature, FundSource } from '../../types/database';
import {
  FileSpreadsheet,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Upload,
  Plus,
  Trash2,
  X,
  FileUp,
  Table,
  Eye,
  Pencil,
  Save,
} from 'lucide-react';
import * as XLSX from 'xlsx';

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
];

const employmentTypeLabels: Record<COSEmploymentType, string> = {
  cos: 'COS',
  jo: 'JO',
};

const fundSourceLabels: Record<COSFundSource, string> = {
  mooe: 'MOOE',
  ps: 'PS',
  project: 'Project Fund',
  other: 'Other',
};

const natureOfHiringLabels: Record<COSNatureOfHiring, string> = {
  casual: 'Casual',
  contractual: 'Contractual',
  job_order: 'Job Order',
};

interface BatchRow {
  firstName: string;
  middleName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  address: string;
  csEligibility: string;
  highestEducation: string;
  position: string;
  equivalentPosition: string;
  department: string;
  actualOffice: string;
  employmentType: string;
  natureOfHiring: string;
  monthlyRate: string;
  fundSource: string;
  contractStart: string;
  contractEnd: string;
}

const emptyBatchRow = (): BatchRow => ({
  firstName: '', middleName: '', lastName: '', sex: '', dateOfBirth: '',
  address: '', csEligibility: '', highestEducation: '',
  position: '', equivalentPosition: '', department: '', actualOffice: '',
  employmentType: 'cos', natureOfHiring: 'contractual', monthlyRate: '', fundSource: 'mooe',
  contractStart: '', contractEnd: '',
});

function computeStatus(contractEnd: string): COSWorker['status'] {
  const end = new Date(contractEnd);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'expiring';
  return 'active';
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
  expiring: { label: 'Expiring Soon', cls: 'bg-yellow-100 text-yellow-800' },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-700' },
};

const inputCls = 'w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100';
const selectCls = 'w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 bg-white';

export function COSListPage() {
  const [workers, setWorkers] = useState<COSWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Bulk add state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([emptyBatchRow(), emptyBatchRow(), emptyBatchRow()]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResult, setBatchResult] = useState<{ total: number; created: number; errors: { row: number; name: string; message: string }[] } | null>(null);

  // Sheet import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<BatchRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ total: number; created: number; errors: { row: number; name: string; message: string }[] } | null>(null);

  // Reference data
  const [refPositions, setRefPositions] = useState<Position[]>([]);
  const [refOffices, setRefOffices] = useState<Office[]>([]);
  const [refEmploymentTypes, setRefEmploymentTypes] = useState<EmploymentType[]>([]);
  const [refHiringNatures, setRefHiringNatures] = useState<HiringNature[]>([]);
  const [refFundSources, setRefFundSources] = useState<FundSource[]>([]);

  // Resolve FK IDs from text values
  const resolveWorkerFKs = (positionText: string, officeText: string, actualOfficeText: string, empType: string, hiringNature: string, fundSource: string) => ({
    position_id: refPositions.find(p => p.title.toLowerCase() === positionText.trim().toLowerCase())?.id ?? null,
    office_id: refOffices.find(o => o.name.toLowerCase() === officeText.trim().toLowerCase())?.id ?? null,
    actual_office_id: actualOfficeText ? (refOffices.find(o => o.name.toLowerCase() === actualOfficeText.trim().toLowerCase())?.id ?? null) : null,
    employment_type_id: refEmploymentTypes.find(e => e.code === empType)?.id ?? null,
    nature_of_hiring_id: refHiringNatures.find(h => h.code === hiringNature)?.id ?? null,
    fund_source_id: refFundSources.find(f => f.code === fundSource)?.id ?? null,
  });

  // View detail modal state
  const [viewWorker, setViewWorker] = useState<COSWorker | null>(null);
  const [contractHistory, setContractHistory] = useState<COSWorker[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    first_name: string; middle_name: string; last_name: string;
    sex: string; date_of_birth: string; address: string;
    cs_eligibility: string; highest_education: string;
    position_title: string; equivalent_position: string;
    office_department: string; actual_office_assignment: string;
    employment_type: string; nature_of_hiring: string;
    monthly_rate: string; fund_source: string;
    contract_start: string; contract_end: string; remarks: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const openViewModal = async (worker: COSWorker) => {
    setViewWorker(worker);
    setIsEditing(false);
    setEditForm(null);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('cos_workers_view')
      .select('*')
      .eq('first_name', worker.first_name)
      .eq('last_name', worker.last_name)
      .order('contract_end', { ascending: false });
    setContractHistory(data ?? []);
    setHistoryLoading(false);
  };

  const startEditing = () => {
    if (!viewWorker) return;
    setEditForm({
      first_name: viewWorker.first_name,
      middle_name: viewWorker.middle_name ?? '',
      last_name: viewWorker.last_name,
      sex: viewWorker.sex ?? '',
      date_of_birth: viewWorker.date_of_birth ?? '',
      address: viewWorker.address ?? '',
      cs_eligibility: viewWorker.cs_eligibility ?? '',
      highest_education: viewWorker.highest_education ?? '',
      position_title: viewWorker.position_title,
      equivalent_position: viewWorker.equivalent_position ?? '',
      office_department: viewWorker.office_department,
      actual_office_assignment: viewWorker.actual_office_assignment ?? '',
      employment_type: viewWorker.employment_type,
      nature_of_hiring: viewWorker.nature_of_hiring,
      monthly_rate: viewWorker.monthly_rate != null ? String(viewWorker.monthly_rate) : '',
      fund_source: viewWorker.fund_source,
      contract_start: viewWorker.contract_start,
      contract_end: viewWorker.contract_end,
      remarks: viewWorker.remarks ?? '',
    });
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!viewWorker || !editForm) return;
    setEditSaving(true);
    const fks = resolveWorkerFKs(
      editForm.position_title, editForm.office_department,
      editForm.actual_office_assignment, editForm.employment_type,
      editForm.nature_of_hiring, editForm.fund_source
    );
    const { error, data } = await supabase
      .from('cos_workers')
      .update({
        first_name: editForm.first_name.trim(),
        middle_name: editForm.middle_name.trim() || null,
        last_name: editForm.last_name.trim(),
        sex: editForm.sex || null,
        date_of_birth: editForm.date_of_birth || null,
        address: editForm.address.trim() || null,
        cs_eligibility: editForm.cs_eligibility.trim() || null,
        highest_education: editForm.highest_education.trim() || null,
        position_title: editForm.position_title.trim(),
        equivalent_position: editForm.equivalent_position.trim() || null,
        office_department: editForm.office_department.trim(),
        actual_office_assignment: editForm.actual_office_assignment.trim() || null,
        employment_type: editForm.employment_type,
        nature_of_hiring: editForm.nature_of_hiring,
        monthly_rate: editForm.monthly_rate ? parseFloat(editForm.monthly_rate) : null,
        fund_source: editForm.fund_source,
        contract_start: editForm.contract_start,
        contract_end: editForm.contract_end,
        status: computeStatus(editForm.contract_end),
        remarks: editForm.remarks.trim() || null,
        ...fks,
      })
      .eq('id', viewWorker.id)
      .select()
      .single();

    setEditSaving(false);
    if (!error && data) {
      setViewWorker(data as COSWorker);
      setIsEditing(false);
      setEditForm(null);
      fetchWorkers();
      // Refresh contract history
      const { data: history } = await supabase
        .from('cos_workers')
        .select('*')
        .eq('first_name', data.first_name)
        .eq('last_name', data.last_name)
        .order('contract_end', { ascending: false });
      setContractHistory(history ?? []);
    }
  };

  const updateEditField = (field: string, value: string) => {
    setEditForm((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('cos_workers_view')
      .select('*')
      .order('last_name');

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    setWorkers(data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    supabase.from('positions').select('*').eq('is_active', true).order('title').then(({ data }) => setRefPositions(data ?? []));
    supabase.from('offices').select('*').eq('is_active', true).order('name').then(({ data }) => setRefOffices(data ?? []));
    supabase.from('employment_types').select('*').eq('is_active', true).then(({ data }) => setRefEmploymentTypes(data ?? []));
    supabase.from('hiring_natures').select('*').eq('is_active', true).then(({ data }) => setRefHiringNatures(data ?? []));
    supabase.from('fund_sources').select('*').eq('is_active', true).then(({ data }) => setRefFundSources(data ?? []));
  }, []);

  const filtered = workers.filter((w) => {
    if (positionFilter && w.position_title !== positionFilter) return false;
    if (departmentFilter && w.office_department !== departmentFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${w.first_name} ${w.middle_name ?? ''} ${w.last_name}`.toLowerCase();
    return (
      fullName.includes(q) ||
      w.position_title.toLowerCase().includes(q) ||
      w.office_department.toLowerCase().includes(q)
    );
  });

  const stats = [
    { label: 'Total COS/JO', value: workers.length, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Active', value: workers.filter((w) => w.status === 'active').length, icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
    { label: 'Expiring Soon', value: workers.filter((w) => w.status === 'expiring').length, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Expired', value: workers.filter((w) => w.status === 'expired').length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  ];

  // --- Batch helpers ---
  const resetBatch = () => {
    setBatchRows([emptyBatchRow(), emptyBatchRow(), emptyBatchRow()]);
    setBatchProgress(0);
    setBatchResult(null);
  };

  const updateBatchRow = (index: number, field: keyof BatchRow, value: string) => {
    setBatchRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addBatchRow = () => setBatchRows((prev) => [...prev, emptyBatchRow()]);

  const removeBatchRow = (index: number) => {
    if (batchRows.length <= 1) return;
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  };

  const isRowValid = (r: BatchRow) => r.firstName && r.lastName && r.position && r.department && r.contractStart && r.contractEnd;

  const insertRows = async (rows: BatchRow[], onProgress: (n: number) => void) => {
    const errors: { row: number; name: string; message: string }[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      onProgress(i + 1);

      const rowFks = resolveWorkerFKs(
        row.position, row.department, row.actualOffice,
        row.employmentType || 'cos', row.natureOfHiring || 'contractual', row.fundSource || 'mooe'
      );
      const { error } = await supabase.from('cos_workers').insert({
        first_name: row.firstName.trim(),
        middle_name: row.middleName.trim() || null,
        last_name: row.lastName.trim(),
        sex: row.sex || null,
        date_of_birth: row.dateOfBirth || null,
        address: row.address.trim() || null,
        cs_eligibility: row.csEligibility.trim() || null,
        highest_education: row.highestEducation.trim() || null,
        position_title: row.position.trim(),
        equivalent_position: row.equivalentPosition.trim() || null,
        office_department: row.department.trim(),
        actual_office_assignment: row.actualOffice.trim() || null,
        employment_type: row.employmentType || 'cos',
        nature_of_hiring: row.natureOfHiring || 'contractual',
        monthly_rate: row.monthlyRate ? parseFloat(row.monthlyRate) : null,
        fund_source: row.fundSource || 'mooe',
        contract_start: row.contractStart,
        contract_end: row.contractEnd,
        status: computeStatus(row.contractEnd),
        ...rowFks,
      });

      if (error) {
        errors.push({ row: i + 1, name: `${row.firstName} ${row.lastName}`, message: error.message });
      } else {
        created++;
      }
    }

    return { total: rows.length, created, errors };
  };

  const handleBatchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(isRowValid);
    if (validRows.length === 0) return;

    setBatchSaving(true);
    setBatchProgress(0);
    const result = await insertRows(validRows, setBatchProgress);
    setBatchSaving(false);
    setBatchResult(result);
    fetchWorkers();
  };

  // --- Sheet import helpers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const parsed: BatchRow[] = json.map((row) => {
        const get = (keys: string[]): string => {
          for (const k of keys) {
            const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
            if (val !== undefined && val !== '') return String(val).trim();
          }
          return '';
        };

        const parseDate = (val: string): string => {
          if (!val) return '';
          const num = Number(val);
          if (!isNaN(num) && num > 30000 && num < 60000) {
            const date = new Date((num - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
          }
          const d = new Date(val);
          if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
          return val;
        };

        const parseType = (val: string): string => {
          const v = val.toLowerCase().trim();
          if (v === 'jo' || v === 'job order') return 'jo';
          return 'cos';
        };

        const parseFund = (val: string): string => {
          const v = val.toLowerCase().trim();
          if (v === 'ps' || v === 'personal services') return 'ps';
          if (v.includes('project')) return 'project';
          if (v === 'mooe' || v.includes('maintenance')) return 'mooe';
          if (v) return 'other';
          return 'mooe';
        };

        const parseSex = (val: string): string => {
          const v = val.toLowerCase().trim();
          if (v === 'm' || v === 'male' || v === 'lalaki') return 'male';
          if (v === 'f' || v === 'female' || v === 'babae') return 'female';
          return '';
        };

        const parseNature = (val: string): string => {
          const v = val.toLowerCase().trim();
          if (v === 'casual') return 'casual';
          if (v === 'job order' || v === 'jo' || v === 'job_order') return 'job_order';
          return 'contractual';
        };

        return {
          firstName: get(['First Name', 'FirstName', 'first_name', 'First', 'Pangalan']),
          middleName: get(['Middle Name', 'MiddleName', 'middle_name', 'Middle', 'MI', 'M.I.']),
          lastName: get(['Last Name', 'LastName', 'last_name', 'Last', 'Surname', 'Apelyido']),
          sex: parseSex(get(['Sex', 'Gender', 'Kasarian'])),
          dateOfBirth: parseDate(get(['Date of Birth', 'DOB', 'Birthday', 'Birth Date', 'date_of_birth', 'Kaarawan'])),
          address: get(['Address', 'Home Address', 'Tirahan', 'address']),
          csEligibility: get(['CS Eligibility', 'Eligibility', 'Civil Service Eligibility', 'cs_eligibility', 'CSC Eligibility']),
          highestEducation: get(['Highest Education', 'Education', 'Educational Attainment', 'highest_education', 'Educ Attainment']),
          position: get(['Position', 'Position Title', 'position_title', 'Designation', 'Posisyon']),
          equivalentPosition: get(['Equivalent Position', 'Nature of Work', 'equivalent_position', 'Equiv Position']),
          department: get(['Department', 'Office', 'Office/Department', 'office_department', 'Agency', 'Opisina']),
          actualOffice: get(['Actual Office', 'Actual Office Assignment', 'actual_office_assignment', 'Office Assignment']),
          employmentType: parseType(get(['Type', 'Employment Type', 'employment_type', 'COS/JO', 'Category'])),
          natureOfHiring: parseNature(get(['Nature of Hiring', 'Hiring Nature', 'nature_of_hiring', 'Nature'])),
          monthlyRate: get(['Monthly Rate', 'MonthlyRate', 'monthly_rate', 'Rate', 'Salary', 'Compensation', 'Daily Rate', 'daily_rate']),
          fundSource: parseFund(get(['Fund Source', 'FundSource', 'fund_source', 'Fund', 'Source of Fund', 'Funding'])),
          contractStart: parseDate(get(['Contract Start', 'ContractStart', 'contract_start', 'Start Date', 'Start', 'Date Start'])),
          contractEnd: parseDate(get(['Contract End', 'ContractEnd', 'contract_end', 'End Date', 'End', 'Date End', 'Expiry'])),
        };
      });

      setImportRows(parsed);
      setShowImportModal(true);
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const removeImportRow = (index: number) => {
    setImportRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateImportRow = (index: number, field: keyof BatchRow, value: string) => {
    setImportRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validRows = importRows.filter(isRowValid);
    if (validRows.length === 0) return;

    setImportSaving(true);
    setImportProgress(0);
    const result = await insertRows(validRows, setImportProgress);
    setImportSaving(false);
    setImportResult(result);
    fetchWorkers();
  };

  const resetImport = () => {
    setImportRows([]);
    setImportFileName('');
    setImportProgress(0);
    setImportResult(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const validBatchCount = batchRows.filter(isRowValid).length;
  const validImportCount = importRows.filter(isRowValid).length;

  const renderRowInputs = (
    rows: BatchRow[],
    updateRow: (i: number, field: keyof BatchRow, val: string) => void,
    removeRow: (i: number) => void,
    disabled: boolean,
    minRows?: number,
  ) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          <th className="pb-2 text-gray-500 font-medium w-8">#</th>
          <th className="pb-2 text-gray-500 font-medium">First Name</th>
          <th className="pb-2 text-gray-500 font-medium w-14">M.I.</th>
          <th className="pb-2 text-gray-500 font-medium">Last Name</th>
          <th className="pb-2 text-gray-500 font-medium w-16">Sex</th>
          <th className="pb-2 text-gray-500 font-medium">DOB</th>
          <th className="pb-2 text-gray-500 font-medium">Position</th>
          <th className="pb-2 text-gray-500 font-medium">Office/Dept</th>
          <th className="pb-2 text-gray-500 font-medium w-20">Type</th>
          <th className="pb-2 text-gray-500 font-medium w-24">Hiring</th>
          <th className="pb-2 text-gray-500 font-medium w-24">Rate (₱)</th>
          <th className="pb-2 text-gray-500 font-medium w-24">Fund</th>
          <th className="pb-2 text-gray-500 font-medium">Start</th>
          <th className="pb-2 text-gray-500 font-medium">End</th>
          <th className="pb-2 w-8"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const valid = isRowValid(row);
          return (
            <tr key={i} className={!valid && row.firstName ? 'bg-red-50/50' : ''}>
              <td className="py-1 pr-2 text-gray-400 text-center">{i + 1}</td>
              <td className="py-1 pr-1">
                <input type="text" value={row.firstName} onChange={(e) => updateRow(i, 'firstName', e.target.value)} disabled={disabled} placeholder="First" className={`${inputCls} ${!row.firstName && row.lastName ? 'border-red-300' : ''}`} />
              </td>
              <td className="py-1 pr-1">
                <input type="text" value={row.middleName} onChange={(e) => updateRow(i, 'middleName', e.target.value)} disabled={disabled} placeholder="M.I." className={`w-14 ${inputCls}`} />
              </td>
              <td className="py-1 pr-1">
                <input type="text" value={row.lastName} onChange={(e) => updateRow(i, 'lastName', e.target.value)} disabled={disabled} placeholder="Last" className={`${inputCls} ${!row.lastName && row.firstName ? 'border-red-300' : ''}`} />
              </td>
              <td className="py-1 pr-1">
                <select value={row.sex} onChange={(e) => updateRow(i, 'sex', e.target.value)} disabled={disabled} className={selectCls}>
                  <option value="">—</option>
                  <option value="male">M</option>
                  <option value="female">F</option>
                </select>
              </td>
              <td className="py-1 pr-1">
                <input type="date" value={row.dateOfBirth} onChange={(e) => updateRow(i, 'dateOfBirth', e.target.value)} disabled={disabled} className={inputCls} />
              </td>
              <td className="py-1 pr-1">
                <select value={row.position} onChange={(e) => updateRow(i, 'position', e.target.value)} disabled={disabled} className={selectCls}>
                  <option value="">Select</option>
                  {refPositions.map((p) => (
                    <option key={p.id} value={p.title}>{p.title}</option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-1">
                <select value={row.department} onChange={(e) => updateRow(i, 'department', e.target.value)} disabled={disabled} className={selectCls}>
                  <option value="">Select</option>
                  {refOffices.map((o) => (
                    <option key={o.id} value={o.name}>{o.name}</option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-1">
                <select value={row.employmentType} onChange={(e) => updateRow(i, 'employmentType', e.target.value)} disabled={disabled} className={selectCls}>
                  <option value="cos">COS</option>
                  <option value="jo">JO</option>
                </select>
              </td>
              <td className="py-1 pr-1">
                <select value={row.natureOfHiring} onChange={(e) => updateRow(i, 'natureOfHiring', e.target.value)} disabled={disabled} className={selectCls}>
                  <option value="casual">Casual</option>
                  <option value="contractual">Contractual</option>
                  <option value="job_order">Job Order</option>
                </select>
              </td>
              <td className="py-1 pr-1">
                <input type="text" value={row.monthlyRate} onChange={(e) => updateRow(i, 'monthlyRate', e.target.value)} disabled={disabled} placeholder="₱" className={`w-24 ${inputCls}`} />
              </td>
              <td className="py-1 pr-1">
                <select value={row.fundSource} onChange={(e) => updateRow(i, 'fundSource', e.target.value)} disabled={disabled} className={selectCls}>
                  <option value="mooe">MOOE</option>
                  <option value="ps">PS</option>
                  <option value="project">Project</option>
                  <option value="other">Other</option>
                </select>
              </td>
              <td className="py-1 pr-1">
                <input type="date" value={row.contractStart} onChange={(e) => updateRow(i, 'contractStart', e.target.value)} disabled={disabled} className={inputCls} />
              </td>
              <td className="py-1 pr-1">
                <input type="date" value={row.contractEnd} onChange={(e) => updateRow(i, 'contractEnd', e.target.value)} disabled={disabled} className={inputCls} />
              </td>
              <td className="py-1">
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={disabled || rows.length <= (minRows ?? 1)}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderProgressBar = (saving: boolean, progress: number, total: number, label: string) => {
    if (!saving) return null;
    return (
      <div className="px-6 py-3 bg-emerald-50 border-b shrink-0">
        <div className="flex items-center justify-between text-sm text-emerald-700 mb-1">
          <span>{label} {progress} of {total}...</span>
          <span>{Math.round((progress / total) * 100)}%</span>
        </div>
        <div className="w-full bg-emerald-200 rounded-full h-2">
          <div className="bg-emerald-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
      </div>
    );
  };

  const renderResult = (result: { total: number; created: number; errors: { row: number; name: string; message: string }[] }, onClose: () => void) => (
    <div className="p-6 space-y-4">
      <div className={`p-4 rounded-lg ${result.errors.length === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
        <p className={`font-semibold ${result.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'}`}>
          {result.created} of {result.total} COS/JO worker{result.total !== 1 ? 's' : ''} added successfully
        </p>
      </div>
      {result.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700">Failed rows:</p>
          {result.errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg">
              <span className="font-medium shrink-0">Row {err.row} ({err.name}):</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">COS/JO Workers</h1>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-600 text-sm font-medium rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <FileUp size={16} />
            Import from Sheet
          </button>
          <button
            onClick={() => { resetBatch(); setShowBulkModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-600 text-sm font-medium rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <Table size={16} />
            Bulk Add
          </button>
          <button
            onClick={() => { resetBatch(); setBatchRows([emptyBatchRow()]); setShowBulkModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} />
            Add COS/JO
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{stat.label}</span>
              <div className={`p-1.5 rounded-lg ${stat.color}`}>
                <stat.icon size={14} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, position, or office/department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="px-3 py-2 border rounded-sm text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-700"
        >
          <option value="">All Positions</option>
          {refPositions.map((p) => (
            <option key={p.id} value={p.title}>{p.title}</option>
          ))}
        </select>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-700"
        >
          <option value="">All Offices/Departments</option>
          {refOffices.map((o) => (
            <option key={o.id} value={o.name}>{o.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === f.value ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Position/Designation</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Office/Dept</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Monthly Rate</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Fund Source</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Contract Period</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet size={36} className="text-gray-300" />
                      <p className="text-sm font-medium">No COS/JO records found</p>
                      <p className="text-xs">Contract of Service and Job Order records will appear here once added.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((w) => {
                  const badge = statusBadge[w.status];
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
                          {employmentTypeLabels[w.employment_type] ?? 'COS'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {w.monthly_rate != null ? `₱${w.monthly_rate.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 text-xs">
                        {fundSourceLabels[w.fund_source] ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {w.contract_start} — {w.contract_end}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openViewModal(w)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {batchRows.length === 1 ? 'Add COS/JO Worker' : 'Bulk Add COS/JO Workers'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {batchRows.length === 1
                    ? 'Fill in the contract of service / job order details'
                    : 'Add multiple COS/JO workers at once. Per CSC-COA-DBM Joint Circular No. 1, s. 2017.'}
                </p>
              </div>
              <button onClick={() => { setShowBulkModal(false); resetBatch(); }} className="text-gray-400 hover:text-gray-600" disabled={batchSaving}>
                <X size={20} />
              </button>
            </div>

            {batchResult ? (
              renderResult(batchResult, () => { setShowBulkModal(false); resetBatch(); })
            ) : (
              <form onSubmit={handleBatchSubmit} className="flex flex-col overflow-hidden">
                {renderProgressBar(batchSaving, batchProgress, validBatchCount, 'Adding worker')}
                <div className="overflow-auto flex-1 px-6 py-4">
                  {renderRowInputs(batchRows, updateBatchRow, removeBatchRow, batchSaving)}
                  <button type="button" onClick={addBatchRow} disabled={batchSaving} className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50">
                    <Plus size={14} /> Add Row
                  </button>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
                  <p className="text-sm text-gray-500">{validBatchCount} of {batchRows.length} rows ready</p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setShowBulkModal(false); resetBatch(); }} disabled={batchSaving} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={batchSaving || validBatchCount === 0} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      {batchSaving ? 'Adding...' : `Add ${validBatchCount} Worker${validBatchCount !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* View / Edit Worker Detail Modal */}
      {viewWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {viewWorker.last_name}, {viewWorker.first_name} {viewWorker.middle_name ?? ''}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditing ? 'Edit COS/JO Worker' : 'COS/JO Worker Details'}
                </p>
              </div>
              <button onClick={() => { setViewWorker(null); setIsEditing(false); setEditForm(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Personal Information</h3>
                {isEditing && editForm ? (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">First Name</label>
                      <input type="text" value={editForm.first_name} onChange={(e) => updateEditField('first_name', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Middle Name</label>
                      <input type="text" value={editForm.middle_name} onChange={(e) => updateEditField('middle_name', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Last Name</label>
                      <input type="text" value={editForm.last_name} onChange={(e) => updateEditField('last_name', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Sex</label>
                      <select value={editForm.sex} onChange={(e) => updateEditField('sex', e.target.value)} disabled={editSaving} className={selectCls}>
                        <option value="">—</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Date of Birth</label>
                      <input type="date" value={editForm.date_of_birth} onChange={(e) => updateEditField('date_of_birth', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">CS Eligibility</label>
                      <input type="text" value={editForm.cs_eligibility} onChange={(e) => updateEditField('cs_eligibility', e.target.value)} disabled={editSaving} placeholder="e.g. Professional" className={inputCls} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Address</label>
                      <input type="text" value={editForm.address} onChange={(e) => updateEditField('address', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Highest Educational Attainment</label>
                      <input type="text" value={editForm.highest_education} onChange={(e) => updateEditField('highest_education', e.target.value)} disabled={editSaving} placeholder="e.g. Bachelor's Degree" className={inputCls} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <span className="text-gray-500">Full Name</span>
                      <p className="font-medium text-gray-900">
                        {viewWorker.last_name}, {viewWorker.first_name} {viewWorker.middle_name ?? ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Sex</span>
                      <p className="font-medium text-gray-900">{viewWorker.sex === 'male' ? 'Male' : viewWorker.sex === 'female' ? 'Female' : '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Date of Birth</span>
                      <p className="font-medium text-gray-900">{viewWorker.date_of_birth ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">CS Eligibility</span>
                      <p className="font-medium text-gray-900">{viewWorker.cs_eligibility ?? '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Address</span>
                      <p className="font-medium text-gray-900">{viewWorker.address ?? '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Highest Educational Attainment</span>
                      <p className="font-medium text-gray-900">{viewWorker.highest_education ?? '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              <hr />

              {/* Position & Assignment */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Position & Assignment</h3>
                {isEditing && editForm ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Position/Designation</label>
                      <select value={editForm.position_title} onChange={(e) => updateEditField('position_title', e.target.value)} disabled={editSaving} className={selectCls}>
                        <option value="">Select Position</option>
                        {refPositions.map((p) => (
                          <option key={p.id} value={p.title}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Equivalent Position / Nature of Work</label>
                      <input type="text" value={editForm.equivalent_position} onChange={(e) => updateEditField('equivalent_position', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Office/Department</label>
                      <select value={editForm.office_department} onChange={(e) => updateEditField('office_department', e.target.value)} disabled={editSaving} className={selectCls}>
                        <option value="">Select Office</option>
                        {refOffices.map((o) => (
                          <option key={o.id} value={o.name}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Actual Office Assignment</label>
                      <input type="text" value={editForm.actual_office_assignment} onChange={(e) => updateEditField('actual_office_assignment', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Employment Type</label>
                      <select value={editForm.employment_type} onChange={(e) => updateEditField('employment_type', e.target.value)} disabled={editSaving} className={selectCls}>
                        <option value="cos">COS</option>
                        <option value="jo">JO</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Nature of Hiring</label>
                      <select value={editForm.nature_of_hiring} onChange={(e) => updateEditField('nature_of_hiring', e.target.value)} disabled={editSaving} className={selectCls}>
                        <option value="casual">Casual</option>
                        <option value="contractual">Contractual</option>
                        <option value="job_order">Job Order</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <span className="text-gray-500">Position/Designation</span>
                      <p className="font-medium text-gray-900">{viewWorker.position_title}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Equivalent Position / Nature of Work</span>
                      <p className="font-medium text-gray-900">{viewWorker.equivalent_position ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Office/Department</span>
                      <p className="font-medium text-gray-900">{viewWorker.office_department}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Actual Office Assignment</span>
                      <p className="font-medium text-gray-900">{viewWorker.actual_office_assignment ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Employment Type</span>
                      <p className="font-medium text-gray-900">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          viewWorker.employment_type === 'cos' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {viewWorker.employment_type === 'jo' ? 'Job Order (JO)' : 'Contract of Service (COS)'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Nature of Hiring</span>
                      <p className="font-medium text-gray-900">{natureOfHiringLabels[viewWorker.nature_of_hiring] ?? '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              <hr />

              {/* Contract & Compensation Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contract & Compensation</h3>
                {isEditing && editForm ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Contract Start</label>
                      <input type="date" value={editForm.contract_start} onChange={(e) => updateEditField('contract_start', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Contract End</label>
                      <input type="date" value={editForm.contract_end} onChange={(e) => updateEditField('contract_end', e.target.value)} disabled={editSaving} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Monthly Rate (₱)</label>
                      <input type="text" value={editForm.monthly_rate} onChange={(e) => updateEditField('monthly_rate', e.target.value)} disabled={editSaving} placeholder="₱" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Fund Source</label>
                      <select value={editForm.fund_source} onChange={(e) => updateEditField('fund_source', e.target.value)} disabled={editSaving} className={selectCls}>
                        <option value="mooe">MOOE</option>
                        <option value="ps">PS</option>
                        <option value="project">Project Fund</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-500 text-xs font-medium mb-1 block">Remarks</label>
                      <textarea value={editForm.remarks} onChange={(e) => updateEditField('remarks', e.target.value)} disabled={editSaving} rows={2} className={`${inputCls} resize-none`} placeholder="Optional remarks..." />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <span className="text-gray-500">Contract Period</span>
                      <p className="font-medium text-gray-900">{viewWorker.contract_start} to {viewWorker.contract_end}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status</span>
                      <p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[viewWorker.status].cls}`}>
                          {statusBadge[viewWorker.status].label}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Monthly Rate</span>
                      <p className="font-medium text-gray-900">
                        {viewWorker.monthly_rate != null ? `₱${viewWorker.monthly_rate.toLocaleString()}` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Fund Source</span>
                      <p className="font-medium text-gray-900">{fundSourceLabels[viewWorker.fund_source] ?? '—'}</p>
                    </div>
                    {viewWorker.remarks && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Remarks</span>
                        <p className="font-medium text-gray-900">{viewWorker.remarks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <hr />

              {/* Contract History */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Employment / Contract History</h3>
                {historyLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                  </div>
                ) : contractHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No contract records found</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs">#</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs">Position</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs">Office/Dept</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs">Type</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs">Contract Period</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {contractHistory.map((c, i) => {
                          const b = statusBadge[c.status];
                          const isCurrent = c.id === viewWorker.id;
                          return (
                            <tr key={c.id} className={isCurrent ? 'bg-emerald-50/50' : 'hover:bg-gray-50'}>
                              <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                              <td className="px-3 py-2 text-gray-900 text-xs font-medium">
                                {c.position_title}
                                {isCurrent && <span className="ml-1.5 text-emerald-600 text-[10px] font-semibold">(Current)</span>}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{c.office_department}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  c.employment_type === 'cos' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {c.employment_type === 'jo' ? 'JO' : 'COS'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{c.contract_start} — {c.contract_end}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${b.cls}`}>
                                  {b.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 shrink-0 flex justify-end gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => { setIsEditing(false); setEditForm(null); }}
                    disabled={editSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving || !editForm?.first_name || !editForm?.last_name || !editForm?.position_title || !editForm?.office_department || !editForm?.contract_start || !editForm?.contract_end}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Save size={14} />
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 border border-emerald-600 rounded-lg hover:bg-emerald-50"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => { setViewWorker(null); setIsEditing(false); setEditForm(null); }}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import from Sheet Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import from Sheet</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  <Upload size={14} className="inline -mt-0.5 mr-1" />
                  {importFileName} — {importRows.length} row{importRows.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button onClick={() => { setShowImportModal(false); resetImport(); }} className="text-gray-400 hover:text-gray-600" disabled={importSaving}>
                <X size={20} />
              </button>
            </div>

            {importResult ? (
              renderResult(importResult, () => { setShowImportModal(false); resetImport(); })
            ) : (
              <form onSubmit={handleImportSubmit} className="flex flex-col overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b shrink-0">
                  <p className="text-xs text-gray-500">
                    Review the parsed data below. Edit any cells that need correction before importing.
                    Expected columns: <span className="font-medium">First Name, Last Name, Position, Office/Department, Type (COS/JO), Monthly Rate, Fund Source (MOOE/PS/Project), Contract Start, Contract End</span>
                  </p>
                </div>
                {renderProgressBar(importSaving, importProgress, validImportCount, 'Importing worker')}
                <div className="overflow-auto flex-1 px-6 py-4">
                  {importRows.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <FileSpreadsheet size={36} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No data found in the file</p>
                    </div>
                  ) : (
                    renderRowInputs(importRows, updateImportRow, removeImportRow, importSaving)
                  )}
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
                  <p className="text-sm text-gray-500">
                    {validImportCount} of {importRows.length} rows valid
                    {importRows.length - validImportCount > 0 && (
                      <span className="text-red-500 ml-1">({importRows.length - validImportCount} incomplete)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setShowImportModal(false); resetImport(); }} disabled={importSaving} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={importSaving || validImportCount === 0} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      {importSaving ? 'Importing...' : `Import ${validImportCount} Worker${validImportCount !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
