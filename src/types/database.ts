export type AppRole = 'employee' | 'hr_admin';

export type LeaveStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type LocationType = 'within_ph' | 'abroad';
export type SickLeaveType = 'in_hospital' | 'out_patient';

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  office_department: string;
  position_title: string;
  salary_grade: string | null;
  monthly_salary: number | null;
  service_start_date: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  max_days: number | null;
  is_active: boolean;
}

export interface LeaveCredit {
  id: string;
  employee_id: string;
  leave_type_id: number;
  total_earned: number;
  total_used: number;
  year: number;
  updated_at: string;
  leave_type?: LeaveType;
}

export interface LeaveApplication {
  id: string;
  application_number: string;
  employee_id: string;

  // Section 1-5 snapshot
  office_department: string;
  employee_name: string;
  position_title: string;
  salary: string | null;
  date_of_filing: string;

  // Section 6.A - Leave Type
  leave_type_id: number;
  leave_type_others: string | null;

  // Section 6.B - Details of Leave
  // Vacation/Special Privilege
  vacation_location_type: LocationType | null;
  vacation_location_detail: string | null;
  // Sick Leave
  sick_leave_type: SickLeaveType | null;
  sick_leave_illness: string | null;
  // Study Leave
  study_leave_completion_masters: boolean;
  study_leave_bar_review: boolean;
  // Other purposes
  other_purpose_monetization: boolean;
  other_purpose_terminal_leave: boolean;
  // Special Leave Benefits for Women
  special_leave_illness: string | null;

  // Section 6.C
  num_working_days: number;
  inclusive_date_start: string;
  inclusive_date_end: string;

  // Section 6.D
  commutation_requested: boolean;

  // Section 7 - Action
  status: LeaveStatus;

  // 7.A - Leave Credits Certification
  cert_vl_total_earned: number | null;
  cert_vl_less_this: number | null;
  cert_vl_balance: number | null;
  cert_sl_total_earned: number | null;
  cert_sl_less_this: number | null;
  cert_sl_balance: number | null;
  cert_as_of_date: string | null;

  // 7.B - Recommendation
  recommendation: 'for_approval' | 'for_disapproval' | null;
  recommendation_disapproval_reason: string | null;
  recommended_by: string | null;

  // 7.C/D - Approval
  approved_days_with_pay: number | null;
  approved_days_without_pay: number | null;
  approved_others: string | null;
  disapproval_reason: string | null;
  actioned_by: string | null;
  actioned_at: string | null;

  created_at: string;
  updated_at: string;

  // Joined
  leave_type?: LeaveType;
  employee?: Profile;
}
