import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Coins,
  DatabaseZap,
  HeartHandshake,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { CSSProperties } from 'react';

export interface AttendanceTrendPoint {
  absent: number;
  date: string;
  late: number;
  leave: number;
  present: number;
  total: number;
}

export interface ClassroomAnalyticsData {
  attendance: {
    absent: number;
    late: number;
    leave: number;
    present: number;
    totalSessions: number;
  };
  attendanceTrend: AttendanceTrendPoint[];
  behavior: {
    negativePoints: number;
    positivePoints: number;
    totalRecords: number;
  };
  classroomName: string;
  dataCompleteness: {
    attendanceCheckedToday: boolean;
    behaviorRecorded: boolean;
    homeVisitsCount: number;
    scoresEnteredCount: number;
    studentsCount: number;
  };
  savings: {
    accountCount: number;
    activeAccounts: number;
    monthlyDeposits: number;
    totalBalance: number;
  };
  scores: {
    assessmentCount: number;
    averagePercent: number;
    passedStudentsCount: number;
  };
}

interface ClassroomDistributionItem {
  classroomId: string;
  classroomName: string;
  count: number;
}

interface ClassroomAnalyticsChartsProps {
  classroomDistribution: ClassroomDistributionItem[];
  data: ClassroomAnalyticsData;
  onSelectClassroom: (classroomId: string) => void;
  selectedClassroomId: string;
}

const shortDate = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
});

function formatTrendDate(date: string) {
  return shortDate.format(new Date(`${date}T12:00:00+07:00`)).replace('.', '');
}

export function ClassroomAnalyticsCharts({
  classroomDistribution,
  data,
  onSelectClassroom,
  selectedClassroomId,
}: ClassroomAnalyticsChartsProps) {
  const { attendance, attendanceTrend, behavior, dataCompleteness, savings, scores } = data;
  const trendTotal = attendanceTrend.reduce((sum, item) => sum + item.total, 0);
  const trendPresent = attendanceTrend.reduce((sum, item) => sum + item.present, 0);
  const attendanceRate = trendTotal > 0 ? Math.round((trendPresent / trendTotal) * 100) : 0;
  const attendanceScale = Math.max(dataCompleteness.studentsCount, ...attendanceTrend.map((item) => item.total), 1);
  const maxClassroomSize = Math.max(...classroomDistribution.map((item) => item.count), 1);
  const positiveBehaviorRate = behavior.totalRecords > 0
    ? Math.round((Math.abs(behavior.positivePoints) / Math.max(Math.abs(behavior.positivePoints) + Math.abs(behavior.negativePoints), 1)) * 100)
    : 0;
  const savingsCoverage = dataCompleteness.studentsCount > 0
    ? Math.round((savings.activeAccounts / dataCompleteness.studentsCount) * 100)
    : 0;
  const homeVisitCoverage = dataCompleteness.studentsCount > 0
    ? Math.round((dataCompleteness.homeVisitsCount / dataCompleteness.studentsCount) * 100)
    : 0;
  const completenessItems = [
    dataCompleteness.studentsCount > 0,
    dataCompleteness.attendanceCheckedToday,
    scores.assessmentCount > 0,
    savings.accountCount > 0,
    dataCompleteness.behaviorRecorded,
    dataCompleteness.homeVisitsCount >= dataCompleteness.studentsCount && dataCompleteness.studentsCount > 0,
  ];
  const completenessScore = Math.round((completenessItems.filter(Boolean).length / completenessItems.length) * 100);

  return (
    <section className="dashboard-analytics mt-5" aria-label="สถิติและแนวโน้มห้องเรียน">
      <div className="dashboard-analytics-heading">
        <div>
          <p className="dashboard-section-label">CLASSROOM INTELLIGENCE</p>
          <h2>สัญญาณสำคัญของ {data.classroomName || 'ห้องเรียนที่เลือก'}</h2>
          <p>ดูแนวโน้มจริงจากเวลาเรียน ข้อมูลนักเรียน คะแนน พฤติกรรม และงานดูแลในมุมเดียว</p>
        </div>
        <Link className="dashboard-report-link" to="/app/dashboard?view=reports">
          เปิดศูนย์รายงาน <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="dashboard-analytics-grid">
        <article className="dashboard-chart-card dashboard-attendance-trend">
          <header className="dashboard-card-header">
            <div>
              <span className="dashboard-card-icon is-teal"><TrendingUp size={18} /></span>
              <div>
                <h3>แนวโน้มการเข้าเรียน 7 วันล่าสุด</h3>
                <p>สรุปจากรายการเช็กชื่อจริงของห้องนี้</p>
              </div>
            </div>
            <strong className="dashboard-chart-score">{attendanceRate}%<small>อัตรามาเรียน</small></strong>
          </header>

          <div className="dashboard-chart-legend" aria-label="คำอธิบายกราฟ">
            <span><i className="is-present" />มาเรียน</span>
            <span><i className="is-late" />มาสาย</span>
            <span><i className="is-leave" />ลา</span>
            <span><i className="is-absent" />ขาด</span>
          </div>

          {trendTotal > 0 ? (
            <div className="dashboard-stacked-chart">
              <div className="dashboard-chart-axis" aria-hidden="true"><span>{attendanceScale}</span><span>{Math.round(attendanceScale / 2)}</span><span>0</span></div>
              <div className="dashboard-chart-grid" aria-hidden="true"><i /><i /><i /></div>
              <div className="dashboard-chart-bars">
                {attendanceTrend.map((item) => (
                  <div className="dashboard-chart-column" key={item.date} title={`${formatTrendDate(item.date)}: ${item.total} รายการ`}>
                    <div className="dashboard-bar-value">{item.total || ''}</div>
                    <div className="dashboard-stacked-bar" style={{ height: `${Math.max(4, (item.total / attendanceScale) * 100)}%` }}>
                      {item.absent > 0 ? <i className="is-absent" style={{ flex: item.absent }} /> : null}
                      {item.leave > 0 ? <i className="is-leave" style={{ flex: item.leave }} /> : null}
                      {item.late > 0 ? <i className="is-late" style={{ flex: item.late }} /> : null}
                      {item.present > 0 ? <i className="is-present" style={{ flex: item.present }} /> : null}
                    </div>
                    <span>{formatTrendDate(item.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="dashboard-chart-empty">
              <CalendarCheck2 size={28} />
              <strong>ยังไม่มีข้อมูลพอสำหรับแสดงแนวโน้ม</strong>
              <span>เมื่อเริ่มเช็กชื่อ กราฟ 7 วันจะอัปเดตจากข้อมูลจริงโดยอัตโนมัติ</span>
            </div>
          )}

          <footer className="dashboard-chart-summary">
            <div><span>วันนี้</span><strong>{dataCompleteness.attendanceCheckedToday ? 'เช็กชื่อแล้ว' : 'ยังไม่เช็กชื่อ'}</strong></div>
            <div><span>มาเรียน</span><strong className="text-emerald-700">{attendance.present} คน</strong></div>
            <div><span>มาสาย</span><strong className="text-amber-700">{attendance.late} คน</strong></div>
            <div><span>ขาด/ลา</span><strong className="text-rose-700">{attendance.absent + attendance.leave} คน</strong></div>
          </footer>
        </article>

        <div className="dashboard-insight-column">
          <article className="dashboard-chart-card dashboard-classroom-comparison">
            <header className="dashboard-card-header">
              <div>
                <span className="dashboard-card-icon is-blue"><Users size={18} /></span>
                <div><h3>นักเรียนแยกตามห้อง</h3><p>เลือกห้องเพื่อเจาะรายละเอียด</p></div>
              </div>
            </header>
            <div className="dashboard-horizontal-bars">
              {classroomDistribution.map((item) => (
                <button
                  className={item.classroomId === selectedClassroomId ? 'is-selected' : ''}
                  disabled={item.classroomId === 'unassigned'}
                  key={item.classroomId}
                  onClick={() => onSelectClassroom(item.classroomId)}
                  type="button"
                >
                  <span>{item.classroomName}</span>
                  <i><b style={{ width: `${(item.count / maxClassroomSize) * 100}%` }} /></i>
                  <strong>{item.count}</strong>
                </button>
              ))}
              {!classroomDistribution.length ? <p className="dashboard-mini-empty">ยังไม่มีข้อมูลห้องเรียน</p> : null}
            </div>
          </article>

          <article className="dashboard-chart-card dashboard-readiness-card">
            <header className="dashboard-card-header">
              <div>
                <span className="dashboard-card-icon is-lime"><DatabaseZap size={18} /></span>
                <div><h3>ความพร้อมของข้อมูล</h3><p>6 หมวดที่จำเป็นต่อรายงาน</p></div>
              </div>
            </header>
            <div className="dashboard-readiness-body">
              <div className="dashboard-readiness-ring" style={{ '--readiness': `${completenessScore * 3.6}deg` } as CSSProperties}>
                <span><strong>{completenessScore}%</strong>พร้อมใช้</span>
              </div>
              <div className="dashboard-readiness-list">
                <span><i className="is-ready" />พร้อมแล้ว <strong>{completenessItems.filter(Boolean).length} หมวด</strong></span>
                <span><i className="is-pending" />ต้องเติม <strong>{completenessItems.filter((item) => !item).length} หมวด</strong></span>
                <span><i className="is-neutral" />เยี่ยมบ้าน <strong>{homeVisitCoverage}%</strong></span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="dashboard-signal-grid">
        <article className="dashboard-signal-card is-learning">
          <span className="dashboard-card-icon is-purple"><Award size={18} /></span>
          <div><p>ผลการเรียน</p><strong>{scores.averagePercent}%</strong><span>คะแนนเฉลี่ยจาก {scores.assessmentCount} ชุดประเมิน</span></div>
          <div className="dashboard-signal-meter"><i style={{ width: `${scores.averagePercent}%` }} /></div>
          <small>{scores.passedStudentsCount} คนผ่านเกณฑ์</small>
        </article>
        <article className="dashboard-signal-card is-behavior">
          <span className="dashboard-card-icon is-mint"><Sparkles size={18} /></span>
          <div><p>พฤติกรรมเชิงบวก</p><strong>{positiveBehaviorRate}%</strong><span>{behavior.totalRecords} รายการที่บันทึก</span></div>
          <div className="dashboard-signal-meter"><i style={{ width: `${positiveBehaviorRate}%` }} /></div>
          <small>{behavior.positivePoints} คะแนนบวก · {Math.abs(behavior.negativePoints)} คะแนนลบ</small>
        </article>
        <article className="dashboard-signal-card is-savings">
          <span className="dashboard-card-icon is-amber"><Coins size={18} /></span>
          <div><p>เงินออมประจำห้อง</p><strong>{savings.totalBalance.toLocaleString('th-TH')}</strong><span>บาท · {savings.activeAccounts} บัญชี active</span></div>
          <div className="dashboard-signal-meter"><i style={{ width: `${savingsCoverage}%` }} /></div>
          <small>นักเรียนร่วมออม {savingsCoverage}%</small>
        </article>
        <article className="dashboard-signal-card is-care">
          <span className="dashboard-card-icon is-coral"><HeartHandshake size={18} /></span>
          <div><p>การเยี่ยมบ้าน</p><strong>{homeVisitCoverage}%</strong><span>{dataCompleteness.homeVisitsCount} จาก {dataCompleteness.studentsCount} คน</span></div>
          <div className="dashboard-signal-meter"><i style={{ width: `${homeVisitCoverage}%` }} /></div>
          <small>{homeVisitCoverage === 100 ? <><CheckCircle2 size={12} /> ครบทั้งห้องแล้ว</> : <><AlertTriangle size={12} /> ยังต้องติดตาม</>}</small>
        </article>
      </div>

      <Link className="dashboard-mobile-report-link" to="/app/dashboard?view=reports">
        <BarChart3 size={17} /> ดูรายงานเชิงลึกทั้งหมด <ArrowRight size={15} />
      </Link>
    </section>
  );
}
