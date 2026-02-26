import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react';
import type { Position, Office, SalaryRate, COSRate, SalaryGrade, EmploymentType } from '../../types/database';

type Tab = 'positions' | 'offices' | 'rates' | 'cos_rates';

export function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('positions');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'positions', label: 'Positions' },
    { id: 'offices', label: 'Offices' },
    { id: 'rates', label: 'Salary Rates' },
    { id: 'cos_rates', label: 'COS Rates' },
  ];

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/modules')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Back to Modules
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage reference data for positions, offices, salary rates, and COS rates</p>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'positions' && <PositionsTab />}
      {activeTab === 'offices' && <OfficesTab />}
      {activeTab === 'rates' && <RatesTab />}
      {activeTab === 'cos_rates' && <COSRatesTab />}
    </div>
  );
}

// ─── Positions Tab ────────────────────────────────────────────

function PositionsTab() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('positions')
      .select('*')
      .order('title');
    setPositions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  const filtered = positions.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (pos: Position) => {
    setEditing(pos);
    setForm({ title: pos.title, description: pos.description ?? '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('positions').update({
        title: form.title.trim(),
        description: form.description.trim() || null,
      }).eq('id', editing.id);
    } else {
      await supabase.from('positions').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
      });
    }
    setSaving(false);
    setShowModal(false);
    fetchPositions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return;
    await supabase.from('positions').delete().eq('id', id);
    fetchPositions();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={16} />
          Add Position
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No positions found</td></tr>
            ) : (
              filtered.map((pos) => (
                <tr key={pos.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{pos.title}</td>
                  <td className="px-4 py-3 text-gray-500">{pos.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(pos)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(pos.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Position' : 'Add Position'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. Administrative Aide I"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Offices Tab ──────────────────────────────────────────────

function OfficesTab() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('offices')
      .select('*')
      .order('name');
    setOffices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  const filtered = offices.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.code?.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', code: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (office: Office) => {
    setEditing(office);
    setForm({ name: office.name, code: office.code ?? '', description: office.description ?? '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
    };
    if (editing) {
      await supabase.from('offices').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('offices').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    fetchOffices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this office?')) return;
    await supabase.from('offices').delete().eq('id', id);
    fetchOffices();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search offices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={16} />
          Add Office
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No offices found</td></tr>
            ) : (
              filtered.map((office) => (
                <tr key={office.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{office.name}</td>
                  <td className="px-4 py-3 text-gray-500">{office.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{office.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(office)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(office.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Office' : 'Add Office'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. Office of the Mayor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. OM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Rates Tab ────────────────────────────────────────────────

function RatesTab() {
  const [rates, setRates] = useState<SalaryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SalaryRate | null>(null);
  const [form, setForm] = useState({ salary_grade: '', step_increment: '1', monthly_rate: '' });
  const [saving, setSaving] = useState(false);
  const [refSalaryGrades, setRefSalaryGrades] = useState<SalaryGrade[]>([]);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('salary_rates')
      .select('*')
      .order('salary_grade')
      .order('step_increment');
    setRates(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRates();
    supabase.from('salary_grades').select('*').eq('is_active', true).then(({ data }) => setRefSalaryGrades(data ?? []));
  }, [fetchRates]);

  const filtered = rates.filter((r) =>
    r.salary_grade.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ salary_grade: '', step_increment: '1', monthly_rate: '' });
    setShowModal(true);
  };

  const openEdit = (rate: SalaryRate) => {
    setEditing(rate);
    setForm({
      salary_grade: rate.salary_grade,
      step_increment: String(rate.step_increment),
      monthly_rate: String(rate.monthly_rate),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.salary_grade.trim() || !form.monthly_rate) return;
    setSaving(true);
    const salary_grade_id = refSalaryGrades.find(sg => sg.grade === form.salary_grade.trim())?.id ?? null;
    const payload = {
      salary_grade: form.salary_grade.trim(),
      step_increment: parseInt(form.step_increment) || 1,
      monthly_rate: parseFloat(form.monthly_rate),
      salary_grade_id,
    };
    if (editing) {
      await supabase.from('salary_rates').update(payload).eq('id', editing.id);
    } else {
      // Auto-create salary_grade entry if it doesn't exist
      if (!salary_grade_id) {
        await supabase.from('salary_grades').insert({ grade: form.salary_grade.trim() });
      }
      await supabase.from('salary_rates').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    fetchRates();
    // Refresh salary grades
    supabase.from('salary_grades').select('*').eq('is_active', true).then(({ data }) => setRefSalaryGrades(data ?? []));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate?')) return;
    await supabase.from('salary_rates').delete().eq('id', id);
    fetchRates();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by salary grade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={16} />
          Add Rate
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Salary Grade</th>
              <th className="px-4 py-3 font-medium">Step Increment</th>
              <th className="px-4 py-3 font-medium">Monthly Rate</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No rates found</td></tr>
            ) : (
              filtered.map((rate) => (
                <tr key={rate.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{rate.salary_grade}</td>
                  <td className="px-4 py-3 text-gray-500">{rate.step_increment}</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(rate.monthly_rate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(rate)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(rate.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Rate' : 'Add Rate'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary Grade *</label>
              <input
                type="text"
                value={form.salary_grade}
                onChange={(e) => setForm({ ...form, salary_grade: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. SG-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Step Increment</label>
              <input
                type="number"
                min="1"
                value={form.step_increment}
                onChange={(e) => setForm({ ...form, step_increment: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rate (PHP) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_rate}
                onChange={(e) => setForm({ ...form, monthly_rate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. 13000.00"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.salary_grade.trim() || !form.monthly_rate} className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── COS Rates Tab ────────────────────────────────────────────

function COSRatesTab() {
  const [rates, setRates] = useState<COSRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<COSRate | null>(null);
  const [form, setForm] = useState({ position_title: '', daily_rate: '', monthly_rate: '', employment_type: 'cos', description: '' });
  const [saving, setSaving] = useState(false);
  const [refPositions, setRefPositions] = useState<Position[]>([]);
  const [refEmploymentTypes, setRefEmploymentTypes] = useState<EmploymentType[]>([]);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cos_rates')
      .select('*')
      .order('position_title');
    setRates(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRates();
    supabase.from('positions').select('*').eq('is_active', true).order('title').then(({ data }) => setRefPositions(data ?? []));
    supabase.from('employment_types').select('*').eq('is_active', true).then(({ data }) => setRefEmploymentTypes(data ?? []));
  }, [fetchRates]);

  const filtered = rates.filter((r) =>
    r.position_title.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ position_title: '', daily_rate: '', monthly_rate: '', employment_type: 'cos', description: '' });
    setShowModal(true);
  };

  const openEdit = (rate: COSRate) => {
    setEditing(rate);
    setForm({
      position_title: rate.position_title,
      daily_rate: String(rate.daily_rate),
      monthly_rate: rate.monthly_rate != null ? String(rate.monthly_rate) : '',
      employment_type: rate.employment_type,
      description: rate.description ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.position_title.trim() || !form.daily_rate) return;
    setSaving(true);
    const position_id = refPositions.find(p => p.title.toLowerCase() === form.position_title.trim().toLowerCase())?.id ?? null;
    const employment_type_id = refEmploymentTypes.find(e => e.code === form.employment_type)?.id ?? null;
    const payload = {
      position_title: form.position_title.trim(),
      daily_rate: parseFloat(form.daily_rate),
      monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : null,
      employment_type: form.employment_type,
      description: form.description.trim() || null,
      position_id,
      employment_type_id,
    };
    if (editing) {
      await supabase.from('cos_rates').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('cos_rates').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    fetchRates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this COS rate?')) return;
    await supabase.from('cos_rates').delete().eq('id', id);
    fetchRates();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={16} />
          Add COS Rate
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Position Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Daily Rate</th>
              <th className="px-4 py-3 font-medium">Monthly Rate</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No COS rates found</td></tr>
            ) : (
              filtered.map((rate) => (
                <tr key={rate.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{rate.position_title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      rate.employment_type === 'cos' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {rate.employment_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(rate.daily_rate)}</td>
                  <td className="px-4 py-3 text-gray-900">{rate.monthly_rate != null ? formatCurrency(rate.monthly_rate) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(rate)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(rate.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit COS Rate' : 'Add COS Rate'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position Title *</label>
              <input
                type="text"
                value={form.position_title}
                onChange={(e) => setForm({ ...form, position_title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. Utility Worker"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="cos">COS</option>
                <option value="jo">JO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Rate (PHP) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.daily_rate}
                onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. 500.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rate (PHP)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_rate}
                onChange={(e) => setForm({ ...form, monthly_rate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. 11000.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.position_title.trim() || !form.daily_rate} className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Shared Modal ─────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
