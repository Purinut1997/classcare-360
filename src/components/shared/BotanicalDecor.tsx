import type { ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  Compass,
  FlaskConical,
  Globe2,
  Home,
  Languages,
  Laptop,
  Leaf,
  Palette,
  Sigma,
  Sparkles,
  Target,
  Trees,
  Wrench,
} from 'lucide-react';
import { AppLogo } from '../brand/AppLogo';

interface BotanicalCornerWatermarkProps {
  className?: string;
  color?: string;
  opacity?: number;
}

/** Subtle organic branch & leaf vector watermark for hero banners and featured panels. */
export function BotanicalCornerWatermark({
  className = '',
  color = '#2F7D5B',
  opacity = 0.16,
}: BotanicalCornerWatermarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      fill="none"
      height="132"
      style={{ opacity }}
      viewBox="0 0 176 132"
      width="176"
    >
      <path
        d="M20 126 C54 96, 94 72, 158 30"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d="M62 96 C46 72, 54 48, 76 42 C80 64, 76 84, 62 96 Z"
        fill={color}
        fillOpacity="0.24"
        stroke={color}
        strokeWidth="1.6"
      />
      <path
        d="M98 70 C84 46, 92 24, 116 18 C120 40, 114 58, 98 70 Z"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="1.6"
      />
      <path
        d="M92 80 C114 80, 136 92, 146 114 C122 114, 102 102, 92 80 Z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="1.6"
      />
      <circle cx="148" cy="20" fill={color} fillOpacity="0.28" r="5" />
      <circle cx="132" cy="14" fill={color} fillOpacity="0.22" r="3" />
    </svg>
  );
}

interface BotanicalCardSprigProps {
  className?: string;
  color?: string;
  opacity?: number;
}

/** Delicate top-right botanical sprig accent for metric and shortcut cards. */
export function BotanicalCardSprig({
  className = '',
  color = '#2F7D5B',
  opacity = 0.22,
}: BotanicalCardSprigProps) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      fill="none"
      height="44"
      style={{ opacity }}
      viewBox="0 0 48 48"
      width="44"
    >
      <path
        d="M8 40 C16 28, 26 18, 38 10"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path
        d="M20 26 C15 17, 20 10, 28 10 C28 18, 25 23, 20 26 Z"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="1.4"
      />
      <path
        d="M24 24 C32 23, 38 27, 40 34 C32 34, 27 30, 24 24 Z"
        fill={color}
        fillOpacity="0.14"
        stroke={color}
        strokeWidth="1.4"
      />
    </svg>
  );
}

interface BotanicalProgressRingProps {
  color?: string;
  percent: number;
  size?: number;
  trackColor?: string;
}

/** Clean circular SVG progress ring for summary and completeness metrics. */
export function BotanicalProgressRing({
  color = '#2F7D5B',
  percent,
  size = 46,
  trackColor = '#EDF1EA',
}: BotanicalProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      aria-label={`${clamped}%`}
      className="shrink-0"
      height={size}
      viewBox="0 0 46 46"
      width={size}
    >
      <circle cx="23" cy="23" fill="none" r={radius} stroke={trackColor} strokeWidth="4.5" />
      <circle
        cx="23"
        cy="23"
        fill="none"
        r={radius}
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth="4.5"
        transform="rotate(-90 23 23)"
      />
      <text
        fill="currentColor"
        fontSize="10.5"
        fontWeight="700"
        textAnchor="middle"
        x="23"
        y="26.8"
      >
        {clamped}%
      </text>
    </svg>
  );
}

interface BotanicalEmptyStateProps {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}

/** Consistent, zero-emoji botanical empty state anchored by the official AppLogo or an icon. */
export function BotanicalEmptyState({
  action,
  description,
  icon,
  title,
}: BotanicalEmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-6 text-center shadow-xs sm:p-8">
      <BotanicalCornerWatermark className="absolute -bottom-3 -right-3" opacity={0.12} />
      <div className="relative z-10 mx-auto max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#DCE3D7] bg-white shadow-xs">
          {icon || <AppLogo className="h-9 w-9" />}
        </div>
        <h3 className="mt-3.5 font-display text-base font-bold text-[#1F2A22]">{title}</h3>
        <p className="mt-1.5 text-sm font-medium leading-6 text-[#5B6A5F]">{description}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

/** Crisp Lucide icon mapped to Thai school subject/activity names (zero emoji). */
export function SubjectLucideIcon({
  className = '',
  size = 18,
  subject = '',
}: {
  className?: string;
  size?: number;
  subject?: string;
}) {
  const norm = subject.trim();
  const props = { 'aria-hidden': true as const, className: `shrink-0 ${className}`.trim(), size };

  if (/ลูกเสือ|เนตรนารี|ยุวกาชาด|บำเพ็ญ/.test(norm)) return <Trees {...props} />;
  if (/ชุมนุม|ชมรม|กิจกรรม/.test(norm)) return <Target {...props} />;
  if (/แนะแนว/.test(norm)) return <Compass {...props} />;
  if (/ซ่อมเสริม|ทบทวน|ติว/.test(norm)) return <Leaf {...props} />;
  if (/โฮมรูม/.test(norm)) return <Home {...props} />;
  if (/สวดมนต์|จริยธรรม|ศีลธรรม|คุณธรรม/.test(norm)) return <Sparkles {...props} />;
  if (/คณิต|คำนวณ|คิดเลข|สถิติ/.test(norm)) return <Sigma {...props} />;
  if (/ไทย|วรรณคดี|การอ่าน/.test(norm)) return <BookOpen {...props} />;
  if (/วิทย์|ฟิสิกส์|เคมี|ชีว|ดาราศาสตร์/.test(norm)) return <FlaskConical {...props} />;
  if (/อังกฤษ|eng|จีน|ญี่ปุ่น|ต่างประเทศ/i.test(norm)) return <Languages {...props} />;
  if (/สังคม|ประวัติศาสตร์|ภูมิศาสตร์|หน้าที่พลเมือง|ศาสนา/.test(norm)) return <Globe2 {...props} />;
  if (/สุขศึกษา|พละ|พลศึกษา|กีฬา|ว่ายน้ำ/.test(norm)) return <Activity {...props} />;
  if (/ศิลปะ|ทัศนศิลป์|ดนตรี|นาฏศิลป์/.test(norm)) return <Palette {...props} />;
  if (/การงาน|เกษตร|ช่าง|คหกรรม/.test(norm)) return <Wrench {...props} />;
  if (/คอม|เทคโนโลยี|วิทยาการคำนวณ|ai|coding/i.test(norm)) return <Laptop {...props} />;
  return <BookOpen {...props} />;
}
