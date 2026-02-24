// Supabase Edge Function: Generate CS Form No. 6 PDF
// Renders a print-ready A4 PDF matching the official leave application form layout

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: 'application_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch application with leave type and employee profile
    const { data: app, error: appError } = await supabase
      .from('leave_applications')
      .select('*, leave_type:leave_types(*), employee:profiles!leave_applications_employee_id_fkey(*)')
      .eq('id', application_id)
      .single();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate PDF as HTML-to-PDF using the form layout
    const pdfHtml = generateFormHtml(app);

    // Use jsPDF-like approach: return HTML that can be printed as PDF
    // For a real production system, use a PDF library. For MVP, we return
    // a well-formatted HTML document designed for print/PDF export.
    return new Response(pdfHtml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="CS-Form-6-${app.application_number}.html"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function checkbox(checked: boolean): string {
  return checked
    ? `<span style="font-family:monospace;font-size:14px;">&#9746;</span>`
    : `<span style="font-family:monospace;font-size:14px;">&#9744;</span>`;
}

function val(v: unknown): string {
  if (v === null || v === undefined || v === '') return '____________________';
  return String(v);
}

function generateFormHtml(app: Record<string, unknown>): string {
  const lt = (app.leave_type as Record<string, unknown>) || {};
  const emp = (app.employee as Record<string, unknown>) || {};
  const ltCode = lt.code as string || '';

  const nameParts = (app.employee_name as string || '').split(',').map(s => s.trim());
  const lastName = nameParts[0] || '';
  const firstMiddle = nameParts[1] || '';
  const firstNameParts = firstMiddle.split(' ');
  const firstName = firstNameParts[0] || '';
  const middleName = firstNameParts.slice(1).join(' ') || '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>CS Form No. 6 — Application for Leave</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.4;
    color: #000;
    background: #fff;
  }
  .form-container {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 10mm;
  }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 5px; vertical-align: top; }
  .bordered td, .bordered th { border: 1px solid #000; }
  .header { text-align: center; margin-bottom: 5px; }
  .header h3 { font-size: 11px; margin: 2px 0; }
  .header h2 { font-size: 14px; margin: 5px 0; font-weight: bold; }
  .section-title {
    background: #e8e8e8;
    font-weight: bold;
    text-align: center;
    font-size: 10px;
    padding: 4px;
  }
  .field-label { font-size: 9px; color: #333; }
  .field-value { font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; min-width: 80px; display: inline-block; }
  .checkbox-row { margin: 2px 0; font-size: 10px; }
  .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; font-size: 9px; margin-top: 30px; padding-top: 3px; }
  .annex { font-size: 9px; text-align: right; }
  .form-id { font-size: 9px; font-style: italic; }
  @media print {
    body { margin: 0; }
    .form-container { width: 100%; padding: 0; }
  }
</style>
</head>
<body>
<div class="form-container">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
    <div class="form-id">Civil Service Form No. 6<br>Revised 2020</div>
    <div class="annex">ANNEX A</div>
  </div>

  <div class="header">
    <h3>Republic of the Philippines</h3>
    <h3>${val(emp.office_department || app.office_department)}</h3>
  </div>

  <div class="header">
    <h2>APPLICATION FOR LEAVE</h2>
  </div>

  <!-- Sections 1-5: Employee Info -->
  <table class="bordered" style="margin-bottom:0;">
    <tr>
      <td style="width:30%;">
        <span class="field-label">1. OFFICE/DEPARTMENT</span><br>
        <span class="field-value">${val(app.office_department)}</span>
      </td>
      <td colspan="3">
        <span class="field-label">2. NAME:</span>
        <span class="field-label">(Last)</span> <span class="field-value">${val(lastName)}</span>
        <span class="field-label">(First)</span> <span class="field-value">${val(firstName)}</span>
        <span class="field-label">(Middle)</span> <span class="field-value">${val(middleName)}</span>
      </td>
    </tr>
    <tr>
      <td>
        <span class="field-label">3. DATE OF FILING</span><br>
        <span class="field-value">${val(app.date_of_filing)}</span>
      </td>
      <td>
        <span class="field-label">4. POSITION</span><br>
        <span class="field-value">${val(app.position_title)}</span>
      </td>
      <td>
        <span class="field-label">5. SALARY</span><br>
        <span class="field-value">${val(app.salary)}</span>
      </td>
    </tr>
  </table>

  <!-- Section 6: Details of Application -->
  <table class="bordered" style="margin-bottom:0;">
    <tr><td colspan="2" class="section-title">6. DETAILS OF APPLICATION</td></tr>
    <tr>
      <td style="width:50%;vertical-align:top;">
        <strong style="font-size:9px;">6.A TYPE OF LEAVE TO BE AVAILED OF</strong><br><br>
        <div class="checkbox-row">${checkbox(ltCode === 'VL')} Vacation Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'FL')} Mandatory/Forced Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'SL')} Sick Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'ML')} Maternity Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'PL')} Paternity Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'SPL')} Special Privilege Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'SOP')} Solo Parent Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'STL')} Study Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'VAWC')} 10-Day VAWC Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'RP')} Rehabilitation Privilege</div>
        <div class="checkbox-row">${checkbox(ltCode === 'SLB')} Special Leave Benefits for Women</div>
        <div class="checkbox-row">${checkbox(ltCode === 'SEC')} Special Emergency (Calamity) Leave</div>
        <div class="checkbox-row">${checkbox(ltCode === 'AL')} Adoption Leave</div>
        <div class="checkbox-row" style="margin-top:5px;">
          <em>Others:</em> ${app.leave_type_others ? val(app.leave_type_others) : '________________________'}
        </div>
      </td>
      <td style="vertical-align:top;">
        <strong style="font-size:9px;">6.B DETAILS OF LEAVE</strong><br><br>

        <div style="margin-bottom:8px;">
          <em style="font-size:9px;">In case of Vacation/Special Privilege Leave:</em><br>
          <div class="checkbox-row">${checkbox(app.vacation_location_type === 'within_ph')} Within the Philippines ${app.vacation_location_type === 'within_ph' ? val(app.vacation_location_detail) : '_______________'}</div>
          <div class="checkbox-row">${checkbox(app.vacation_location_type === 'abroad')} Abroad (Specify) ${app.vacation_location_type === 'abroad' ? val(app.vacation_location_detail) : '_______________'}</div>
        </div>

        <div style="margin-bottom:8px;">
          <em style="font-size:9px;">In case of Sick Leave:</em><br>
          <div class="checkbox-row">${checkbox(app.sick_leave_type === 'in_hospital')} In Hospital (Specify Illness) ${app.sick_leave_type === 'in_hospital' ? val(app.sick_leave_illness) : '___________'}</div>
          <div class="checkbox-row">${checkbox(app.sick_leave_type === 'out_patient')} Out Patient (Specify Illness) ${app.sick_leave_type === 'out_patient' ? val(app.sick_leave_illness) : '___________'}</div>
        </div>

        <div style="margin-bottom:8px;">
          <em style="font-size:9px;">In case of Special Leave Benefits for Women:</em><br>
          <div class="checkbox-row">(Specify Illness) ${val(app.special_leave_illness)}</div>
        </div>

        <div style="margin-bottom:8px;">
          <em style="font-size:9px;">In case of Study Leave:</em><br>
          <div class="checkbox-row">${checkbox(app.study_leave_completion_masters)} Completion of Master's Degree</div>
          <div class="checkbox-row">${checkbox(app.study_leave_bar_review)} BAR/Board Examination Review</div>
        </div>

        <div>
          <em style="font-size:9px;">Other purpose:</em><br>
          <div class="checkbox-row">${checkbox(app.other_purpose_monetization)} Monetization of Leave Credits</div>
          <div class="checkbox-row">${checkbox(app.other_purpose_terminal_leave)} Terminal Leave</div>
        </div>
      </td>
    </tr>
    <tr>
      <td>
        <strong style="font-size:9px;">6.C NUMBER OF WORKING DAYS APPLIED FOR</strong><br>
        <span class="field-value">${val(app.num_working_days)}</span><br><br>
        <span style="font-size:9px;">INCLUSIVE DATES</span><br>
        <span class="field-value">${val(app.inclusive_date_start)} to ${val(app.inclusive_date_end)}</span>
      </td>
      <td>
        <strong style="font-size:9px;">6.D COMMUTATION</strong><br>
        <div class="checkbox-row">${checkbox(!app.commutation_requested)} Not Requested</div>
        <div class="checkbox-row">${checkbox(!!app.commutation_requested)} Requested</div>
        <br><br>
        <div style="text-align:right;margin-top:10px;">
          <div class="sig-line" style="display:inline-block;">(Signature of Applicant)</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Section 7: Details of Action -->
  <table class="bordered">
    <tr><td colspan="2" class="section-title">7. DETAILS OF ACTION ON APPLICATION</td></tr>
    <tr>
      <td style="width:50%;vertical-align:top;">
        <strong style="font-size:9px;">7.A CERTIFICATION OF LEAVE CREDITS</strong><br>
        <span style="font-size:9px;">As of ${val(app.cert_as_of_date)}</span><br><br>
        <table style="width:100%;font-size:9px;" class="bordered">
          <tr>
            <th></th>
            <th>Vacation Leave</th>
            <th>Sick Leave</th>
          </tr>
          <tr>
            <td><em>Total Earned</em></td>
            <td style="text-align:center;">${app.cert_vl_total_earned ?? ''}</td>
            <td style="text-align:center;">${app.cert_sl_total_earned ?? ''}</td>
          </tr>
          <tr>
            <td><em>Less this application</em></td>
            <td style="text-align:center;">${app.cert_vl_less_this ?? ''}</td>
            <td style="text-align:center;">${app.cert_sl_less_this ?? ''}</td>
          </tr>
          <tr>
            <td><em>Balance</em></td>
            <td style="text-align:center;">${app.cert_vl_balance ?? ''}</td>
            <td style="text-align:center;">${app.cert_sl_balance ?? ''}</td>
          </tr>
        </table>
        <br>
        <div style="text-align:center;">
          <div class="sig-line" style="display:inline-block;">(Authorized Officer)</div>
        </div>
      </td>
      <td style="vertical-align:top;">
        <strong style="font-size:9px;">7.B RECOMMENDATION</strong><br><br>
        <div class="checkbox-row">${checkbox(app.recommendation === 'for_approval')} For approval</div>
        <div class="checkbox-row">${checkbox(app.recommendation === 'for_disapproval')} For disapproval due to ${val(app.recommendation_disapproval_reason)}</div>
        <br><br>
        <div style="text-align:center;">
          <div class="sig-line" style="display:inline-block;">(Authorized Officer)</div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="vertical-align:top;">
        <strong style="font-size:9px;">7.C APPROVED FOR:</strong><br><br>
        <div style="margin:3px 0;">_______ days with pay: <strong>${app.approved_days_with_pay ?? ''}</strong></div>
        <div style="margin:3px 0;">_______ days without pay: <strong>${app.approved_days_without_pay ?? ''}</strong></div>
        <div style="margin:3px 0;">_______ others (Specify): <strong>${app.approved_others ?? ''}</strong></div>
      </td>
      <td style="vertical-align:top;">
        <strong style="font-size:9px;">7.D DISAPPROVED DUE TO:</strong><br><br>
        <div>${val(app.disapproval_reason)}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="text-align:center;padding-top:20px;">
        <div class="sig-line" style="display:inline-block;">(Authorized Official)</div>
      </td>
    </tr>
  </table>

</div>

<script>
  // Auto-print when opened
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;
}
