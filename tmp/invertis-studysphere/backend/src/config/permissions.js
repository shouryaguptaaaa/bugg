// Permission catalogue. The Super Admin can change which role holds which permission
// (stored in PlatformSettings.rolePermissions). Super Admin always holds everything.

export const ROLES = ['super_admin', 'admin', 'content_manager', 'student'];

export const PERMISSIONS = {
  'materials.upload': 'Upload study materials',
  'materials.edit': 'Edit / replace materials (content managers: own uploads only)',
  'materials.delete': 'Delete and restore materials',
  'materials.approve': 'Approve, reject and publish materials directly',
  'academic.manage': 'Manage courses, branches, semesters, subjects, modules, categories',
  'users.manage': 'Manage students and staff accounts',
  'communication.manage': 'Announcements, FAQs and contact messages',
  'reports.manage': 'Review reported materials',
  'analytics.view': 'View dashboard, analytics and storage usage',
  'audit.view': 'View audit logs',
  'settings.manage': 'Edit website, branding and company settings',
  'quizzes.manage': 'Create, edit, publish and delete quizzes',
  'assignments.manage': 'Create assignments and review / grade submissions',
  'forum.moderate': 'Moderate the discussion forum (hide, delete, review reports)',
};

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    'materials.upload',
    'materials.edit',
    'materials.delete',
    'materials.approve',
    'academic.manage',
    'users.manage',
    'communication.manage',
    'reports.manage',
    'analytics.view',
    'audit.view',
    'quizzes.manage',
    'assignments.manage',
    'forum.moderate',
  ],
  content_manager: ['materials.upload', 'materials.edit', 'analytics.view', 'quizzes.manage'],
  student: [],
};

export const STAFF_ROLES = ['super_admin', 'admin', 'content_manager'];
