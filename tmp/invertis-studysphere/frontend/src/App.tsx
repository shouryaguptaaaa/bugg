import { lazy, Suspense } from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import { AdminLayout, PublicLayout, RequireAuth, RequireStaff, StudentLayout } from './components/Layouts';
import { PageLoader } from './components/ui';

// Route-level code splitting (lazy loading)
const Home = lazy(() => import('./pages/public/Home'));
const Library = lazy(() => import('./pages/public/Library'));
const Browse = lazy(() => import('./pages/public/Browse'));
const MaterialDetail = lazy(() => import('./pages/public/MaterialDetail'));
const { About, Faq, Contact, Privacy, Terms, Developer } = {
  About: lazy(() => import('./pages/public/Info').then((m) => ({ default: m.About }))),
  Faq: lazy(() => import('./pages/public/Info').then((m) => ({ default: m.Faq }))),
  Contact: lazy(() => import('./pages/public/Info').then((m) => ({ default: m.Contact }))),
  Privacy: lazy(() => import('./pages/public/Info').then((m) => ({ default: m.Privacy }))),
  Terms: lazy(() => import('./pages/public/Info').then((m) => ({ default: m.Terms }))),
  Developer: lazy(() => import('./pages/public/Info').then((m) => ({ default: m.Developer }))),
};
const AuthPages = {
  Login: lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.Login }))),
  AdminLogin: lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.AdminLogin }))),
  Register: lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.Register }))),
  Forgot: lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.ForgotPassword }))),
  Reset: lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.ResetPassword }))),
  Verify: lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.VerifyEmail }))),
};

const PYQ = lazy(() => import('./pages/public/PYQ'));
const Notifications = lazy(() => import('./pages/student/Notifications'));
const Planner = lazy(() => import('./pages/student/Planner'));
const Workspace = lazy(() => import('./pages/student/Workspace'));
const Quiz = {
  Center: lazy(() => import('./pages/student/Quizzes').then((m) => ({ default: m.QuizCenter }))),
  Take: lazy(() => import('./pages/student/Quizzes').then((m) => ({ default: m.QuizTake }))),
  Result: lazy(() => import('./pages/student/Quizzes').then((m) => ({ default: m.QuizResult }))),
};
const Asg = {
  List: lazy(() => import('./pages/student/Assignments').then((m) => ({ default: m.Assignments }))),
  Detail: lazy(() => import('./pages/student/Assignments').then((m) => ({ default: m.AssignmentDetail }))),
};
const ForumPages = {
  List: lazy(() => import('./pages/student/Forum').then((m) => ({ default: m.Forum }))),
  Thread: lazy(() => import('./pages/student/Forum').then((m) => ({ default: m.Thread }))),
};
const ManageQuizzes = lazy(() => import('./pages/admin/ManageQuizzes'));
const ManageAssignments = lazy(() => import('./pages/admin/ManageAssignments'));
const ForumModeration = lazy(() => import('./pages/admin/ForumModeration'));
const Dashboard = lazy(() => import('./pages/student/Dashboard'));
const Bookmarks = lazy(() => import('./pages/student/Bookmarks'));
const Downloads = lazy(() => import('./pages/student/Downloads'));
const Profile = lazy(() => import('./pages/student/Profile'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const ManageMaterials = lazy(() => import('./pages/admin/ManageMaterials'));
const UploadMaterial = lazy(() => import('./pages/admin/UploadMaterial'));
const AcademicManager = lazy(() => import('./pages/admin/AcademicManager'));
const Users = lazy(() => import('./pages/admin/Users'));
const Communication = {
  Announcements: lazy(() => import('./pages/admin/Communication').then((m) => ({ default: m.Announcements }))),
  Faqs: lazy(() => import('./pages/admin/Communication').then((m) => ({ default: m.Faqs }))),
  Messages: lazy(() => import('./pages/admin/Communication').then((m) => ({ default: m.Messages }))),
};
const Platform = {
  Reports: lazy(() => import('./pages/admin/Platform').then((m) => ({ default: m.Reports }))),
  AuditLogs: lazy(() => import('./pages/admin/Platform').then((m) => ({ default: m.AuditLogs }))),
  Storage: lazy(() => import('./pages/admin/Platform').then((m) => ({ default: m.Storage }))),
  Settings: lazy(() => import('./pages/admin/Platform').then((m) => ({ default: m.WebsiteSettings }))),
  Permissions: lazy(() => import('./pages/admin/Platform').then((m) => ({ default: m.Permissions }))),
};

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-brand">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/pyq" element={<PYQ />} />
          <Route path="/materials/:id" element={<MaterialDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/developer" element={<Developer />} />
          <Route path="/login" element={<AuthPages.Login />} />
          <Route path="/register" element={<AuthPages.Register />} />
          <Route path="/forgot-password" element={<AuthPages.Forgot />} />
          <Route path="/reset-password" element={<AuthPages.Reset />} />
          <Route path="/verify-email" element={<AuthPages.Verify />} />
          <Route path="/admin/login" element={<AuthPages.AdminLogin />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<RequireAuth><StudentLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/quizzes" element={<Quiz.Center />} />
          <Route path="/quizzes/take/:attemptId" element={<Quiz.Take />} />
          <Route path="/quizzes/result/:attemptId" element={<Quiz.Result />} />
          <Route path="/assignments" element={<Asg.List />} />
          <Route path="/assignments/:id" element={<Asg.Detail />} />
          <Route path="/forum" element={<ForumPages.List />} />
          <Route path="/forum/:id" element={<ForumPages.Thread />} />
        </Route>

        <Route path="/admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
          <Route index element={<AdminDashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="materials" element={<ManageMaterials />} />
          <Route path="upload" element={<UploadMaterial />} />
          <Route path="reports" element={<Platform.Reports />} />
          <Route path="quizzes" element={<ManageQuizzes />} />
          <Route path="assignments" element={<ManageAssignments />} />
          <Route path="forum" element={<ForumModeration />} />
          {(['courses', 'branches', 'semesters', 'subjects', 'modules', 'categories', 'academic-years'] as const).map((k) => (
            <Route key={k} path={k} element={<AcademicManager kind={k} />} />
          ))}
          <Route path="students" element={<Users group="students" />} />
          <Route path="administrators" element={<Users group="staff" />} />
          <Route path="announcements" element={<Communication.Announcements />} />
          <Route path="faqs" element={<Communication.Faqs />} />
          <Route path="messages" element={<Communication.Messages />} />
          <Route path="storage" element={<Platform.Storage />} />
          <Route path="audit-logs" element={<Platform.AuditLogs />} />
          <Route path="settings" element={<Platform.Settings />} />
          <Route path="permissions" element={<Platform.Permissions />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
