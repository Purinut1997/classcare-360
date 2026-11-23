import { ArrowLeft, CheckCircle2, Cloud, FileCheck2, Lock, Scale, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';

interface LegalDocumentPageProps {
  docType: 'privacy' | 'terms';
}

export function LegalDocumentPage({ docType }: LegalDocumentPageProps) {
  const isPrivacy = docType === 'privacy';

  return (
    <main className="min-h-screen bg-[#FAFBF8] text-[#1C342B]">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#DCE3D7] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <AppLogo className="h-9 w-9 rounded-xl bg-white p-0.5 shadow-2xs ring-1 ring-[#DCE3D7]" />
            <div>
              <p className="text-sm font-black tracking-tight text-[#1C342B]">ClassCare 360</p>
              <p className="text-[11px] font-semibold text-[#5A6F64]">
                ศูนย์เอกสารทางกฎหมายและความปลอดภัยข้อมูลสถานศึกษา
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={isPrivacy ? '/terms' : '/privacy'}
              className="rounded-xl border border-[#DCE3D7] bg-white px-3 py-1.5 text-xs font-bold text-[#1C342B] transition hover:bg-[#F3F6F1]"
            >
              {isPrivacy ? 'ข้อกำหนดการใช้งาน (Terms)' : 'นโยบายความเป็นส่วนตัว (Privacy)'}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C342B] px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-[#2F7D5B]"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>กลับหน้าหลัก</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="rounded-3xl border border-[#DCE3D7] bg-white p-6 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E9F0EA] px-3.5 py-1.5 text-xs font-black text-[#2F7D5B] ring-1 ring-[#DCE3D7]">
            {isPrivacy ? <ShieldCheck size={15} /> : <Scale size={15} />}
            <span>
              {isPrivacy
                ? 'Privacy Policy · PDPA & Google API Limited Use Compliance'
                : 'Terms of Service · ข้อตกลงและเงื่อนไขการใช้บริการ'}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#1C342B] sm:text-3xl">
            {isPrivacy
              ? 'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคล (Privacy Policy)'
              : 'ข้อกำหนดและเงื่อนไขการใช้บริการ (Terms of Service)'}
          </h1>
          <p className="mt-2 text-xs font-bold text-[#5A6F64]">
            มีผลบังคับใช้ตั้งแต่วันที่ 1 มกราคม 2569 · อัปเดตล่าสุด: พฤศจิกายน 2569 · แพลตฟอร์ม ClassCare 360 (https://classcare-360.pages.dev)
          </p>

          {isPrivacy ? (
            <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs font-semibold leading-6 text-emerald-950">
                <p className="flex items-center gap-1.5 text-sm font-black text-emerald-900">
                  <Lock size={15} /> สรุปหลักการสำคัญ (Executive Privacy Guarantee)
                </p>
                <p className="mt-1">
                  ClassCare 360 ออกแบบภายใต้สถาปัตยกรรมแยกข้อมูลรายโรงเรียน (Strict Multi-Tenant Row Level Security) ข้อมูลนักเรียน คะแนน เวลาเรียน การเยี่ยมบ้าน และไฟล์เอกสารทั้งหมดเป็นกรรมสิทธิ์ของสถานศึกษาและครูผู้ดูแลระบบ ไม่มีการนำข้อมูลไปขาย ใช้โฆษณา หรือเปิดเผยข้ามสถานศึกษาโดยเด็ดขาด
                </p>
              </div>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  1. บทบาทตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>ผู้ควบคุมข้อมูลส่วนบุคคล (Data Controller):</strong> สถานศึกษา หรือครูผู้ดูแลพื้นที่ทำงานของโรงเรียน (Workspace Owner) เป็นผู้กำหนดวัตถุประสงค์ในการจัดเก็บและใช้ข้อมูลนักเรียน ผู้ปกครอง และบุคลากรในความดูแลเพื่อภารกิจทางการศึกษาและงานทะเบียนวัดผลตามระเบียบกระทรวงศึกษาธิการ (ปพ.5 / ปพ.6)
                  </li>
                  <li>
                    <strong>ผู้ประมวลผลข้อมูลส่วนบุคคล (Data Processor):</strong> แพลตฟอร์ม ClassCare 360 ทำหน้าที่ประมวลผล จัดเก็บ สำรองข้อมูล และรักษาความมั่นคงปลอดภัยของข้อมูลตามคำสั่งของสถานศึกษาเท่านั้น
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  2. ข้อมูลที่มีการจัดเก็บและประมวลผล
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>ข้อมูลบัญชีผู้ใช้ของครูและบุคลากร:</strong> ชื่อ-นามสกุล อีเมล บทบาทหน้าที่ในโรงเรียน และประวัติการเข้าใช้งานเพื่อตรวจสอบความปลอดภัย (Audit Logs)
                  </li>
                  <li>
                    <strong>ข้อมูลนักเรียนและการจัดการชั้นเรียน:</strong> รหัสประจำตัวนักเรียน ชื่อ-นามสกุล ชั้น/ห้อง ข้อมูลเวลาเรียน คะแนนเก็บ/ผลการเรียน พฤติกรรม คุณลักษณะอันพึงประสงค์ สุขภาพ เงินออม และการเยี่ยมบ้าน
                  </li>
                  <li>
                    <strong>ไฟล์รูปภาพและเอกสารประกอบ:</strong> ภาพประจำตัวนักเรียน ภาพถ่ายการเยี่ยมบ้าน ใบลา และไฟล์สำรองข้อมูล ซึ่งถูกบีบอัดในรูปแบบ <code>.webp</code> เพื่อความรวดเร็วและประหยัดพื้นที่จัดเก็บ
                  </li>
                </ul>
              </section>

              <section className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
                <h2 className="flex items-center gap-2 text-base font-black text-cyan-950">
                  <Cloud size={18} className="text-cyan-700" />
                  3. การเชื่อมต่อ Google Drive และการปฏิบัติตาม Google API Services User Data Policy
                </h2>
                <p className="mt-2 text-xs font-semibold leading-6 text-slate-700">
                  เมื่อผู้ดูแลโรงเรียนเลือกเชื่อมต่อบัญชี Google Drive (Bring Your Own Storage - BYOS) แพลตฟอร์ม ClassCare 360 จะขอสิทธิ์เฉพาะระดับ <code>https://www.googleapis.com/auth/drive.file</code> เท่านั้น โดยมีหลักประกันดังนี้:
                </p>
                <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-xs font-semibold leading-6 text-slate-700">
                  <li>
                    <strong>เข้าถึงเฉพาะไฟล์ที่แอปสร้างขึ้น (Per-File Scope Only):</strong> ระบบสามารถสร้างและอ่านเฉพาะโฟลเดอร์และไฟล์ที่ ClassCare 360 อัปโหลดขึ้นไปเท่านั้น ระบบ <u>ไม่สามารถ</u> มองเห็น ค้นหา แก้ไข หรือลบไฟล์ส่วนตัวอื่นๆ ใน Google Drive ของผู้ใช้ได้
                  </li>
                  <li>
                    <strong>การปกป้อง OAuth Refresh Token:</strong> รหัสเชื่อมต่อ (Refresh Token) ถูกเข้ารหัสด้วยมาตรฐาน AES-GCM 256-bit และจัดเก็บในตารางความลับฝั่งเซิร์ฟเวอร์ที่ปิดกั้นการอ่านจากเบราว์เซอร์ 100%
                  </li>
                  <li>
                    <strong>ข้อกำหนด Limited Use ของ Google:</strong> การใช้งานและส่งต่อข้อมูลที่ได้รับจาก Google APIs ของ ClassCare 360 ปฏิบัติตาม{' '}
                    <a
                      href="https://developers.google.com/terms/api-services-user-data-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-black text-cyan-800 underline"
                    >
                      Google API Services User Data Policy
                    </a>{' '}
                    อย่างเคร่งครัด รวมถึงข้อกำหนด Limited Use โดยไม่นำข้อมูลจาก Google Drive ไปใช้เพื่อการโฆษณา ไม่ขายต่อให้บุคคลที่สาม และไม่นำไปใช้ฝึกสอนโมเดล AI สาธารณะ
                  </li>
                  <li>
                    <strong>การยกเลิกการเชื่อมต่อ:</strong> ผู้ดูแลสามารถกดปุ่ม <em>“ยกเลิกเชื่อม”</em> ในหน้าตั้งค่าโรงเรียนได้ทุกเมื่อ ซึ่งระบบจะเพิกถอนโทเค็นกับ Google OAuth Server ทันทีโดยไม่ลบไฟล์เดิมที่อยู่ใน Google Drive ของผู้ใช้
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  4. มาตรการรักษาความมั่นคงปลอดภัยของข้อมูล
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>การเข้ารหัสการรับส่งข้อมูลผ่าน HTTPS / TLS 1.3 ทุกช่องทาง</li>
                  <li>การแยกสิทธิ์ข้อมูลระดับแถว (PostgreSQL Row Level Security) และกุญแจอ้างอิงแบบผสม (Composite Foreign Keys) ป้องกันข้อมูลข้ามโรงเรียน 100%</li>
                  <li>การบันทึกประวัติการเข้าถึงและแก้ไขข้อมูลสำคัญในระบบ Audit Logs</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  5. สิทธิของเจ้าของข้อมูลและช่องทางติดต่อ
                </h2>
                <p className="mt-2">
                  เจ้าของข้อมูลสามารถขอตรวจสอบ แก้ไข ส่งออกข้อมูลในรูปแบบไฟล์มาตรฐาน (JSON / Excel / CSV) หรือขอลบข้อมูลผ่านผู้ดูแลระบบของสถานศึกษา หรือติดต่อทีมผู้พัฒนา ClassCare 360 ได้ที่{' '}
                  <Link to="/support" className="font-black text-[#2F7D5B] underline">
                    ศูนย์ช่วยเหลือ (/support)
                  </Link>{' '}
                  หรืออีเมลผู้ดูแลระบบ: <span className="font-mono font-bold">themik4015@gmail.com</span>
                </p>
              </section>
            </div>
          ) : (
            <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-700">
                <p className="flex items-center gap-1.5 text-sm font-black text-[#1C342B]">
                  <FileCheck2 size={15} /> ขอบเขตการให้บริการ
                </p>
                <p className="mt-1">
                  ClassCare 360 เป็นแพลตฟอร์มบริหารจัดการชั้นเรียน งานวิชาการ ระบบวัดผล ปพ.5/ปพ.6 และการดูแลช่วยเหลือนักเรียนสำหรับครูและสถานศึกษา การเข้าใช้งานระบบถือว่าท่านยอมรับข้อกำหนดและเงื่อนไขฉบับนี้
                </p>
              </div>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  1. บัญชีผู้ใช้งานและสิทธิ์ความรับผิดชอบของสถานศึกษา
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>ผู้สร้างพื้นที่โรงเรียน (Teacher Owner) มีหน้าที่บริหารจัดการสิทธิ์ครูผู้สอนและบุคลากรภายในโรงเรียนให้ตรงตามภารกิจจริง</li>
                  <li>ผู้ใช้ต้องเก็บรักษารหัสผ่านและรหัสเชื่อมต่อต่างๆ ไว้เป็นความลับ และออกจากระบบทุกครั้งเมื่อใช้งานบนคอมพิวเตอร์ส่วนกลางของโรงเรียน</li>
                  <li>สถานศึกษาเป็นผู้รับผิดชอบความถูกต้องของข้อมูลนักเรียนและการขอความยินยอมตามระเบียบของสถานศึกษา</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  2. กรรมสิทธิ์ในข้อมูลและการสำรองข้อมูล
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>ข้อมูลนักเรียน คะแนน เวลาเรียน รูปภาพ และเอกสารทั้งหมดที่สถานศึกษานำเข้าสู่ระบบ เป็นกรรมสิทธิ์ของสถานศึกษา 100%</li>
                  <li>สถานศึกษาสามารถส่งออกข้อมูลทั้งหมดเป็นไฟล์ Excel, CSV, PDF หรือ JSON Backup รวมถึงเชื่อมต่อ Google Drive ของโรงเรียนเพื่อเก็บไฟล์ไว้ในพื้นที่ของตนเองได้ตลอดเวลา</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  3. ข้อห้ามในการใช้งาน
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>ห้ามใช้ระบบเพื่อจัดเก็บหรือเผยแพร่เนื้อหาที่ผิดกฎหมาย ละเมิดสิทธิส่วนบุคคล หรือมีโค้ดอันตราย (Malware / Script Injection)</li>
                  <li>ห้ามพยายามเจาะระบบ ทดสอบช่องโหว่โดยไม่ได้รับอนุญาต หรือเข้าถึงข้อมูลของสถานศึกษาอื่นที่ตนไม่ได้รับสิทธิ์</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-black text-[#1C342B]">
                  4. ความต่อเนื่องของการให้บริการและการปรับปรุงระบบ
                </h2>
                <p className="mt-2">
                  ทีมพัฒนา ClassCare 360 มุ่งมั่นดูแลระบบให้พร้อมใช้งานอย่างต่อเนื่องด้วยมาตรฐาน Zero-Downtime และสำรองข้อมูลอัตโนมัติ ทั้งนี้ หากมีข้อสงสัยหรือต้องการความช่วยเหลือ สามารถติดต่อผ่าน{' '}
                  <Link to="/support" className="font-black text-[#2F7D5B] underline">
                    ศูนย์ช่วยเหลือ (/support)
                  </Link>{' '}
                  ได้ตลอดเวลา
                </p>
              </section>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#DCE3D7] pt-6 text-xs font-bold text-[#5A6F64]">
            <div className="flex items-center gap-2 text-[#2F7D5B]">
              <CheckCircle2 size={15} />
              <span>ตรวจสอบและรับรองมาตรฐานความปลอดภัยข้อมูล ClassCare 360</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/privacy" className="hover:text-[#1C342B] hover:underline">
                นโยบายความเป็นส่วนตัว
              </Link>
              <Link to="/terms" className="hover:text-[#1C342B] hover:underline">
                ข้อกำหนดการใช้งาน
              </Link>
              <Link to="/support" className="hover:text-[#1C342B] hover:underline">
                ติดต่อศูนย์ช่วยเหลือ
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
