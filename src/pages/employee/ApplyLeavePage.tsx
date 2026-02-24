import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../lib/AuthContext';
import type { LeaveType, LeaveCredit } from '../../types/database';
import { differenceInBusinessDays, parseISO } from 'date-fns';

export function ApplyLeavePage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [credits, setCredits] = useState<LeaveCredit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState<number | ''>('');
  const [leaveTypeOthers, setLeaveTypeOthers] = useState('');
  const [vacationLocationType, setVacationLocationType] = useState<'within_ph' | 'abroad'>('within_ph');
  const [vacationLocationDetail, setVacationLocationDetail] = useState('');
  const [sickLeaveType, setSickLeaveType] = useState<'in_hospital' | 'out_patient'>('out_patient');
  const [sickLeaveIllness, setSickLeaveIllness] = useState('');
  const [studyLeaveMasters, setStudyLeaveMasters] = useState(false);
  const [studyLeaveBar, setStudyLeaveBar] = useState(false);
  const [otherMonetization, setOtherMonetization] = useState(false);
  const [otherTerminal, setOtherTerminal] = useState(false);
  const [specialLeaveIllness, setSpecialLeaveIllness] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [commutationRequested, setCommutationRequested] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('leave_types').select('*').eq('is_active', true).order('id'),
      supabase
        .from('leave_credits')
        .select('*, leave_type:leave_types(*)')
        .eq('employee_id', profile?.id ?? '')
        .eq('year', new Date().getFullYear()),
    ]).then(([typesRes, creditsRes]) => {
      setLeaveTypes(typesRes.data ?? []);
      setCredits(creditsRes.data ?? []);
    });
  }, [profile]);

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const isVacationType = selectedType && ['VL', 'FL', 'SPL'].includes(selectedType.code);
  const isSickType = selectedType?.code === 'SL';
  const isStudyType = selectedType?.code === 'STL';
  const isSpecialWomen = selectedType?.code === 'SLB';

  const numWorkingDays =
    dateStart && dateEnd
      ? Math.max(differenceInBusinessDays(parseISO(dateEnd), parseISO(dateStart)) + 1, 0)
      : 0;

  // Check available credits
  const matchingCredit = credits.find((c) => c.leave_type_id === leaveTypeId);
  const availableDays = matchingCredit
    ? matchingCredit.total_earned - matchingCredit.total_used
    : null;
  const insufficientCredits = availableDays !== null && numWorkingDays > availableDays;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !leaveTypeId || !dateStart || !dateEnd) return;
    if (insufficientCredits) {
      setError('Insufficient leave credits for the requested number of days.');
      return;
    }

    setLoading(true);
    setError('');

    const employeeName = [profile.last_name, profile.first_name, profile.middle_name]
      .filter(Boolean)
      .join(', ');

    const { error: insertError } = await supabase.from('leave_applications').insert({
      employee_id: profile.id,
      office_department: profile.office_department,
      employee_name: employeeName,
      position_title: profile.position_title,
      salary: profile.salary_grade,
      date_of_filing: new Date().toISOString().split('T')[0],
      leave_type_id: leaveTypeId,
      leave_type_others: selectedType?.code === 'OTH' ? leaveTypeOthers : null,
      vacation_location_type: isVacationType ? vacationLocationType : null,
      vacation_location_detail: isVacationType ? vacationLocationDetail : null,
      sick_leave_type: isSickType ? sickLeaveType : null,
      sick_leave_illness: isSickType ? sickLeaveIllness : null,
      study_leave_completion_masters: isStudyType ? studyLeaveMasters : false,
      study_leave_bar_review: isStudyType ? studyLeaveBar : false,
      other_purpose_monetization: otherMonetization,
      other_purpose_terminal_leave: otherTerminal,
      special_leave_illness: isSpecialWomen ? specialLeaveIllness : null,
      num_working_days: numWorkingDays,
      inclusive_date_start: dateStart,
      inclusive_date_end: dateEnd,
      commutation_requested: commutationRequested,
      status: 'submitted',
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      navigate('/applications');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Apply for Leave</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border divide-y">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-6 py-3 m-6 rounded-lg">{error}</div>
        )}

        {/* Section: Employee Info (read-only) */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Employee Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="font-medium">
                {profile?.last_name}, {profile?.first_name} {profile?.middle_name}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Office/Department:</span>{' '}
              <span className="font-medium">{profile?.office_department}</span>
            </div>
            <div>
              <span className="text-gray-500">Position:</span>{' '}
              <span className="font-medium">{profile?.position_title}</span>
            </div>
            <div>
              <span className="text-gray-500">Date of Filing:</span>{' '}
              <span className="font-medium">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Section 6.A: Type of Leave */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            6.A — Type of Leave
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {leaveTypes.map((lt) => (
              <label
                key={lt.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  leaveTypeId === lt.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="leaveType"
                  value={lt.id}
                  checked={leaveTypeId === lt.id}
                  onChange={() => setLeaveTypeId(lt.id)}
                  className="text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{lt.name}</p>
                  {lt.description && (
                    <p className="text-xs text-gray-500">{lt.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          {selectedType?.code === 'OTH' && (
            <input
              type="text"
              placeholder="Specify other leave type"
              value={leaveTypeOthers}
              onChange={(e) => setLeaveTypeOthers(e.target.value)}
              className="mt-3 w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}
        </div>

        {/* Section 6.B: Details of Leave (conditional) */}
        {leaveTypeId && (
          <div className="p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              6.B — Details of Leave
            </h2>

            {isVacationType && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium">
                  In case of Vacation/Special Privilege Leave:
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={vacationLocationType === 'within_ph'}
                    onChange={() => setVacationLocationType('within_ph')}
                  />
                  <span className="text-sm">Within the Philippines</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={vacationLocationType === 'abroad'}
                    onChange={() => setVacationLocationType('abroad')}
                  />
                  <span className="text-sm">Abroad (Specify)</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    vacationLocationType === 'within_ph'
                      ? 'Specify location within the Philippines'
                      : 'Specify country/destination'
                  }
                  value={vacationLocationDetail}
                  onChange={(e) => setVacationLocationDetail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {isSickType && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium">In case of Sick Leave:</p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sickLeaveType === 'in_hospital'}
                    onChange={() => setSickLeaveType('in_hospital')}
                  />
                  <span className="text-sm">In Hospital</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sickLeaveType === 'out_patient'}
                    onChange={() => setSickLeaveType('out_patient')}
                  />
                  <span className="text-sm">Out Patient</span>
                </label>
                <input
                  type="text"
                  placeholder="Specify Illness"
                  value={sickLeaveIllness}
                  onChange={(e) => setSickLeaveIllness(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            {isStudyType && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium">In case of Study Leave:</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={studyLeaveMasters}
                    onChange={(e) => setStudyLeaveMasters(e.target.checked)}
                  />
                  <span className="text-sm">Completion of Master's Degree</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={studyLeaveBar}
                    onChange={(e) => setStudyLeaveBar(e.target.checked)}
                  />
                  <span className="text-sm">BAR/Board Examination Review</span>
                </label>
              </div>
            )}

            {isSpecialWomen && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium">
                  In case of Special Leave Benefits for Women:
                </p>
                <input
                  type="text"
                  placeholder="Specify Illness"
                  value={specialLeaveIllness}
                  onChange={(e) => setSpecialLeaveIllness(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            {/* Other purpose checkboxes - always visible */}
            <div className="space-y-3 mt-4 pt-4 border-t">
              <p className="text-sm text-gray-700 font-medium">Other purpose:</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={otherMonetization}
                  onChange={(e) => setOtherMonetization(e.target.checked)}
                />
                <span className="text-sm">Monetization of Leave Credits</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={otherTerminal}
                  onChange={(e) => setOtherTerminal(e.target.checked)}
                />
                <span className="text-sm">Terminal Leave</span>
              </label>
            </div>

            {!isVacationType && !isSickType && !isStudyType && !isSpecialWomen && !otherMonetization && !otherTerminal && (
              <p className="text-sm text-gray-500 mt-3">
                No additional details required for this leave type.
              </p>
            )}
          </div>
        )}

        {/* Section 6.C: Number of Working Days & Inclusive Dates */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            6.C — Number of Working Days & Inclusive Dates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                min={dateStart}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Working Days
              </label>
              <div className="px-3 py-2 bg-gray-50 border rounded-lg text-sm font-semibold text-gray-900">
                {numWorkingDays} day(s)
              </div>
              {insufficientCredits && (
                <p className="text-xs text-red-600 mt-1">
                  Insufficient credits (available: {availableDays})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 6.D: Commutation */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            6.D — Commutation
          </h2>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!commutationRequested}
                onChange={() => setCommutationRequested(false)}
              />
              <span className="text-sm">Not Requested</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={commutationRequested}
                onChange={() => setCommutationRequested(true)}
              />
              <span className="text-sm">Requested</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="p-6 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !leaveTypeId || !dateStart || !dateEnd || insufficientCredits}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </form>
    </div>
  );
}
