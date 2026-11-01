import { useApi } from '../lib/utils';

export interface AcademicValue { course: string; branch: string; semester: string; subject: string; module: string }
export const emptyAcademic: AcademicValue = { course: '', branch: '', semester: '', subject: '', module: '' };

/** Cascading Course -> Branch -> Semester -> Subject -> Module selector, driven entirely by database records. */
export function AcademicSelect({ value, onChange, withModule = true, required }: { value: AcademicValue; onChange: (v: AcademicValue) => void; withModule?: boolean; required?: boolean }) {
  const courses = useApi<{ items: any[] }>('/academic/courses');
  const branches = useApi<{ items: any[] }>(value.course ? `/academic/branches?parent=${value.course}` : null);
  const semesters = useApi<{ items: any[] }>(value.branch ? `/academic/semesters?parent=${value.branch}` : null);
  const subjects = useApi<{ items: any[] }>(value.semester ? `/academic/subjects?parent=${value.semester}` : null);
  const modules = useApi<{ items: any[] }>(withModule && value.subject ? `/academic/modules?parent=${value.subject}` : null);

  const sel = (label: string, key: keyof AcademicValue, list: any[] | undefined, reset: Partial<AcademicValue>, disabled: boolean, optional = false) => (
    <div>
      <label className="label">{label}{required && !optional && <span className="text-red-500"> *</span>}</label>
      <select className="input" value={value[key]} disabled={disabled} onChange={(e) => onChange({ ...value, [key]: e.target.value, ...reset })}>
        <option value="">{optional ? `No ${label.toLowerCase()}` : `Select ${label.toLowerCase()}`}</option>
        {list?.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sel('Course', 'course', courses.data?.items, { branch: '', semester: '', subject: '', module: '' }, false)}
      {sel('Branch', 'branch', branches.data?.items, { semester: '', subject: '', module: '' }, !value.course)}
      {sel('Semester', 'semester', semesters.data?.items, { subject: '', module: '' }, !value.branch)}
      {sel('Subject', 'subject', subjects.data?.items, { module: '' }, !value.semester)}
      {withModule && sel('Module', 'module', modules.data?.items, {}, !value.subject, true)}
    </div>
  );
}
