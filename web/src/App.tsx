import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { FirmLayout } from '@/layouts/FirmLayout'
import { EngagementLayout } from '@/layouts/EngagementLayout'
import { InboxPage } from '@/pages/firm/InboxPage'
import { EngagementsPage } from '@/pages/firm/EngagementsPage'
import { ClientsPage } from '@/pages/firm/ClientsPage'
import { ControlsPage } from '@/pages/firm/ControlsPage'
import { QualityPage } from '@/pages/firm/QualityPage'
import { SettingsPage } from '@/pages/firm/SettingsPage'
import { DashboardPage } from '@/pages/engagement/DashboardPage'
import { InsightsPage } from '@/pages/engagement/InsightsPage'
import { SheetsPage } from '@/pages/engagement/SheetsPage'
import { FormsPage } from '@/pages/engagement/FormsPage'
import { QuestionnairesPage } from '@/pages/engagement/QuestionnairesPage'
import { RequestsPage } from '@/pages/engagement/RequestsPage'
import { DocumentsPage } from '@/pages/engagement/DocumentsPage'
import { ReportingPage } from '@/pages/engagement/ReportingPage'
import { ConfirmationsPage } from '@/pages/engagement/ConfirmationsPage'
import { TimePage } from '@/pages/engagement/TimePage'
import { InspectionPage } from '@/pages/engagement/InspectionPage'
import { PortalPage } from '@/pages/portal/PortalPage'
import { AddinPage } from '@/pages/engagement/AddinPage'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <FirmLayout />,
        children: [
          { index: true, element: <Navigate to="/engagements" replace /> },
          { path: 'inbox', element: <InboxPage /> },
          { path: 'engagements', element: <EngagementsPage /> },
          { path: 'clients', element: <ClientsPage /> },
          { path: 'controls', element: <ControlsPage /> },
          { path: 'quality', element: <QualityPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      {
        path: 'engagements/:id',
        element: <EngagementLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'sheets', element: <SheetsPage /> },
          { path: 'forms', element: <FormsPage /> },
          { path: 'questionnaires', element: <QuestionnairesPage /> },
          { path: 'requests', element: <RequestsPage /> },
          { path: 'documents', element: <DocumentsPage /> },
          { path: 'reporting', element: <ReportingPage /> },
          { path: 'confirmations', element: <ConfirmationsPage /> },
          { path: 'time', element: <TimePage /> },
          { path: 'inspection', element: <InspectionPage /> },
          { path: 'addin', element: <AddinPage /> },
        ],
      },
      { path: 'portal/:id', element: <PortalPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
