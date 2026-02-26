import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Users, ClipboardList, Clock, CheckCircle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

interface DepartmentCount {
  department: string;
  count: number;
}

interface LeaveEvent {
  id: string;
  employee_name: string;
  inclusive_date_start: string;
  inclusive_date_end: string;
  leave_type?: { name: string } | null;
}

export function HRDashboardPage() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingApplications: 0,
    approvedThisMonth: 0,
    rejectedThisMonth: 0,
  });
  const [departments, setDepartments] = useState<DepartmentCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employee'),
      supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted'),
      supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('actioned_at', startOfMonth),
      supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .gte('actioned_at', startOfMonth),
      supabase.from('profiles_view').select('office_department').eq('role', 'employee'),
    ]).then(([empRes, pendingRes, approvedRes, rejectedRes, deptRes]) => {
      setStats({
        totalEmployees: empRes.count ?? 0,
        pendingApplications: pendingRes.count ?? 0,
        approvedThisMonth: approvedRes.count ?? 0,
        rejectedThisMonth: rejectedRes.count ?? 0,
      });

      const deptMap = new Map<string, number>();
      (deptRes.data ?? []).forEach((row: { office_department: string }) => {
        const dept = row.office_department;
        deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
      });
      const sorted = Array.from(deptMap.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);
      setDepartments(sorted);

      setLoading(false);
    });
  }, []);

  const fetchLeaveEvents = useCallback(async () => {
    setCalendarLoading(true);
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('leave_applications')
      .select('id, employee_name, inclusive_date_start, inclusive_date_end, leave_type:leave_types(name)')
      .eq('status', 'approved')
      .lte('inclusive_date_start', lastDay)
      .gte('inclusive_date_end', firstDay);

    setLeaveEvents(
      (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        employee_name: row.employee_name as string,
        inclusive_date_start: row.inclusive_date_start as string,
        inclusive_date_end: row.inclusive_date_end as string,
        leave_type: row.leave_type as { name: string } | null,
      }))
    );
    setCalendarLoading(false);
  }, [calendarMonth]);

  useEffect(() => {
    fetchLeaveEvents();
  }, [fetchLeaveEvents]);

  const getEventsForDate = useCallback(
    (dateStr: string) => {
      return leaveEvents.filter(
        (e) => e.inclusive_date_start <= dateStr && e.inclusive_date_end >= dateStr
      );
    },
    [leaveEvents]
  );

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  const cards = [
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      link: '/hr/employees',
    },
    {
      label: 'Pending Applications',
      value: stats.pendingApplications,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50',
      link: '/hr/applications',
    },
    {
      label: 'Approved (this month)',
      value: stats.approvedThisMonth,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
      link: '/hr/applications',
    },
    {
      label: 'Rejected (this month)',
      value: stats.rejectedThisMonth,
      icon: ClipboardList,
      color: 'text-red-600 bg-red-50',
      link: '/hr/applications',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/modules"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Back to Modules
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Employees by Department</h2>
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Department</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">No. of Employees</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {departments.map((dept) => (
                  <tr key={dept.department} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{dept.department}</td>
                    <td className="px-4 py-3 text-gray-700">{dept.count}</td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-gray-400">No departments found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Leave Calendar</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
              {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          {calendarLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : (
            (() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const firstDayOfMonth = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const today = new Date().toISOString().split('T')[0];
              const weeks: (number | null)[][] = [];
              let currentWeek: (number | null)[] = Array(firstDayOfMonth).fill(null);

              for (let day = 1; day <= daysInMonth; day++) {
                currentWeek.push(day);
                if (currentWeek.length === 7) {
                  weeks.push(currentWeek);
                  currentWeek = [];
                }
              }
              if (currentWeek.length > 0) {
                while (currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
              }

              return (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <th key={d} className="px-2 py-3 text-gray-500 font-medium text-center w-[14.28%]">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {weeks.map((week, wi) => (
                      <tr key={wi} className="divide-x">
                        {week.map((day, di) => {
                          if (day === null) {
                            return <td key={di} className="bg-gray-50/50 p-2 h-28 align-top" />;
                          }
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const events = getEventsForDate(dateStr);
                          const isToday = dateStr === today;
                          const isWeekend = di === 0 || di === 6;

                          return (
                            <td key={di} className={`p-2 h-28 align-top ${isWeekend ? 'bg-gray-50/50' : ''}`}>
                              <div className={`text-xs font-medium mb-1 ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-500'}`}>
                                {day}
                              </div>
                              <div className="space-y-0.5 overflow-y-auto max-h-[72px]">
                                {events.slice(0, 3).map((evt) => (
                                  <div
                                    key={evt.id}
                                    className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 truncate"
                                    title={`${evt.employee_name} — ${evt.leave_type?.name ?? 'Leave'}`}
                                  >
                                    {(() => {
                                      const parts = evt.employee_name.split(',').map((s) => s.trim());
                                      const lastName = parts[0] ?? '';
                                      const firstName = parts[1] ?? '';
                                      const middleInitial = parts[2] ? `${parts[2][0]}.` : '';
                                      return `${firstName} ${middleInitial} ${lastName}`.replace(/\s+/g, ' ').trim();
                                    })()}
                                  </div>
                                ))}
                                {events.length > 3 && (
                                  <div className="text-xs text-gray-400 px-1.5">+{events.length - 3} more</div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
