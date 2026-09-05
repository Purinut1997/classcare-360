/**
 * Translates PostgreSQL, PostgREST, and Supabase error codes / messages into
 * clear, actionable Thai explanations for educators and school administrators.
 */
export function translateDatabaseError(rawMessage?: string | null): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'ระบบไม่ได้รับการตอบกลับที่สมบูรณ์ กรุณาลองใหม่อีกครั้ง';
  }

  const message = rawMessage.trim();
  const lower = message.toLowerCase();

  // Resource & Plan Limit Triggers
  if (lower.includes('workspace_student_limit_reached')) {
    return 'นำเข้าไม่สำเร็จ: จำนวนนักเรียนเกินขีดจำกัดสูงสุดของแพ็กเกจปัจจุบัน กรุณาอัปเกรดแพ็กเกจ หรือตรวจสอบรายชื่อเก่าที่สามารถเก็บถาวรได้';
  }
  if (lower.includes('workspace_classroom_limit_reached')) {
    return 'นำเข้าไม่สำเร็จ: จำนวนห้องเรียนเกินขีดจำกัดของแพ็กเกจปัจจุบัน กรุณาเลือกตัวเลือก "นำเข้าตรงเข้าห้องเรียนปัจจุบัน" หรืออัปเกรดแพ็กเกจ';
  }
  if (lower.includes('workspace_collaborator_limit_reached')) {
    return 'ไม่สามารถเพิ่มผู้ร่วมงานได้: จำนวนบุคลากรเกินขีดจำกัดของแพ็กเกจปัจจุบัน';
  }

  // Foreign Key Constraints (e.g. deleting student linked to guardians or transition records)
  if (
    lower.includes('foreign key constraint') ||
    lower.includes('violates foreign key') ||
    lower.includes('23503') ||
    lower.includes('student_guardians')
  ) {
    return 'ไม่สามารถลบได้เนื่องจากยังมีข้อมูลผู้ปกครองหรือประวัติการเรียนผูกอยู่ ระบบได้ทำการล้างข้อมูลที่ผูกค้างให้แล้ว กรุณากดดำเนินการอีกครั้ง';
  }

  // Unique Constraints (e.g. student_code duplication)
  if (
    lower.includes('unique constraint') ||
    lower.includes('23505') ||
    lower.includes('duplicate key value')
  ) {
    return 'พบรหัสนักเรียนซ้ำซ้อนกับในระบบ กรุณาใช้โหมด "ฟื้นคืนชีพและอัปเดต" เพื่อรวมข้อมูล หรือตรวจสอบรหัสประจำตัว';
  }

  // Deletion Safety Rules
  if (lower.includes('delete_requires_archived_reviewed_duplicates')) {
    return 'ต้องย้ายนักเรียนไปไว้ในหมวด "เก็บถาวร" ก่อน จึงจะสามารถลบออกจากระบบได้อย่างปลอดภัย';
  }

  // Authentication & RLS Permissions
  if (
    lower.includes('permission denied') ||
    lower.includes('42501') ||
    lower.includes('not allowed') ||
    lower.includes('row-level security')
  ) {
    return 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลนี้ (ต้องใช้สิทธิ์ผู้ดูแลระบบโรงเรียนหรือครูประจำชั้น)';
  }
  if (
    lower.includes('jwt expired') ||
    lower.includes('pgrst301') ||
    lower.includes('token is expired')
  ) {
    return 'เซสชันการเชื่อมต่อหมดอายุ กรุณารีเฟรชหน้าจอหรือเข้าสู่ระบบใหม่อีกครั้ง';
  }

  // Network / Server errors
  if (lower.includes('failed to fetch') || lower.includes('network error')) {
    return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ต';
  }
  if (lower.includes('bad request') || message === '400') {
    return 'ข้อมูลที่ส่งไปไม่ถูกต้องตามรูปแบบ กรุณาตรวจสอบคอลัมน์ในไฟล์';
  }

  return message;
}
