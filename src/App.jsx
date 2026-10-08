import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams, Outlet } from "react-router-dom";
import { PublicLayout, ScrollTop } from "@/components/layout/PublicLayout";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageLoader, EmptyState } from "@/components/common/Primitives";
import HomePage from "@/pages/public/HomePage";
import IntroReveal from "@/components/common/IntroReveal";

const AboutPage = lazy(() => import("@/pages/public/AboutPage"));
const TeamsPage = lazy(() => import("@/pages/public/TeamsPage"));
const TeamDetailPage = lazy(() => import("@/pages/public/TeamDetailPage"));
const EventsPage = lazy(() => import("@/pages/public/EventsPage"));
const EventDetailPage = lazy(() => import("@/pages/public/EventDetailPage"));
const EventRegisterPage = lazy(() => import("@/pages/public/EventRegisterPage"));
const EventChatPage = lazy(() => import("@/pages/public/EventChatPage"));
const PublicFormPage = lazy(() => import("@/pages/public/PublicFormPage"));
const GalleryPage = lazy(() => import("@/pages/public/GalleryPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const JoinPage = lazy(() => import("@/pages/auth/JoinPage"));
const SetupPage = lazy(() => import("@/pages/auth/SetupPage"));
const OverviewPage = lazy(() => import("@/pages/dashboard/OverviewPage"));
const OnboardingPage = lazy(() => import("@/pages/dashboard/OnboardingPage"));
const MembersPage = lazy(() => import("@/pages/dashboard/MembersPage"));
const YearReviewPage = lazy(() => import("@/pages/dashboard/YearReviewPage"));
const EventsManagePage = lazy(() => import("@/pages/dashboard/EventsManagePage"));
const EventEditorPage = lazy(() => import("@/pages/dashboard/EventEditorPage"));
const EventManagePage = lazy(() => import("@/pages/dashboard/EventManagePage"));
const RegistrationsPage = lazy(() => import("@/pages/dashboard/RegistrationsPage"));
const FormsPage = lazy(() => import("@/pages/dashboard/FormsPage"));
const FormEditorPage = lazy(() => import("@/pages/dashboard/FormEditorPage"));
const FormResponsesPage = lazy(() => import("@/pages/dashboard/FormResponsesPage"));
const MediaStudioPage = lazy(() => import("@/pages/dashboard/MediaStudioPage"));
const CanvaReturnPage = lazy(() => import("@/pages/dashboard/CanvaReturnPage"));
const VideoStudioPage = lazy(() => import("@/pages/dashboard/VideoStudioPage"));
const DocsHomePage = lazy(() => import("@/pages/dashboard/DocsHomePage"));
const DocsEventPage = lazy(() => import("@/pages/dashboard/DocsEventPage"));
const ApprovalsPage = lazy(() => import("@/pages/dashboard/ApprovalsPage"));
const LogsPage = lazy(() => import("@/pages/dashboard/LogsPage"));

/** Poster QR target: /form/<event-slug> → event page (registration). */
function FormSlugRedirect() { const { slug } = useParams(); return <Navigate to={`/events/${slug}`} replace />; }

function ChatLayout() { return <><SiteHeader /><Outlet /></>; }

export default function App() {
  return <>
    <ScrollTop />
    <IntroReveal />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<ChatLayout />}>
          <Route path="/events/:slug/chat" element={<EventChatPage />} />
        </Route>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:slug" element={<EventDetailPage />} />
          <Route path="events/:slug/register" element={<EventRegisterPage />} />
          <Route path="form/:slug" element={<FormSlugRedirect />} />
          <Route path="f/:formId" element={<PublicFormPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="join" element={<JoinPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="profile" element={<OnboardingPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="year-review" element={<YearReviewPage />} />
            <Route path="events" element={<EventsManagePage />} />
            <Route path="events/new" element={<EventEditorPage />} />
            <Route path="events/:slug" element={<EventManagePage />} />
            <Route path="events/:slug/edit" element={<EventEditorPage />} />
            <Route path="registrations" element={<RegistrationsPage />} />
            <Route path="registrations/:slug" element={<RegistrationsPage />} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="forms/new" element={<FormEditorPage />} />
            <Route path="forms/:formId" element={<FormResponsesPage />} />
            <Route path="media" element={<MediaStudioPage />} />
            <Route path="media/canva-return" element={<CanvaReturnPage />} />
            <Route path="media/video" element={<VideoStudioPage />} />
            <Route path="posters" element={<Navigate to="/dashboard/media" replace />} />
            <Route path="documentation" element={<DocsHomePage />} />
            <Route path="documentation/:slug" element={<DocsEventPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="logs" element={<LogsPage />} />
          </Route>
          <Route path="*" element={<div className="section"><EmptyState title="Page not found">That link doesn't go anywhere.</EmptyState></div>} />
        </Route>
      </Routes>
    </Suspense>
  </>;
}
