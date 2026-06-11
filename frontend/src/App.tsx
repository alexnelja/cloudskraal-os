import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import AppShell from './components/layout/AppShell';
import { ToasterProvider } from './components/ui/Toaster';
import LoadingOverlay from './components/ui/LoadingOverlay';
import Dashboard from './pages/Dashboard';
import ProjectsList from './pages/ProjectsList';
import ProjectDetail from './pages/ProjectDetail';
import CompareProjects from './pages/CompareProjects';

// Lazy-load heavy routes so MapLibre, calendar internals, wiki (mermaid/katex),
// and the task manager don't ship in the entry bundle. Each becomes its own
// chunk, fetched only when its route activates.
const FarmMapPage = lazy(() => import('./pages/FarmMapPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const WikiPage = lazy(() => import('./pages/WikiPage'));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const LivestockPage = lazy(() => import('./pages/LivestockPage'));
const ProductionPage = lazy(() => import('./pages/ProductionPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const CostMapPage = lazy(() => import('./pages/CostMapPage'));
const EnterprisesPage = lazy(() => import('./pages/EnterprisesPage'));
const FinancialsPage = lazy(() => import('./pages/FinancialsPage'));
const AnnotationsPage = lazy(() => import('./pages/AnnotationsPage'));
const TaskManagerPage = lazy(() => import('./pages/TaskManagerPage'));

function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-8"><div className="max-w-7xl mx-auto">{children}</div></div>;
}

export default function App() {
  return (
    // `reducedMotion="user"` honours the OS prefers-reduced-motion setting:
    // framer-motion skips to end-state instead of animating. Paired with
    // the @media (prefers-reduced-motion: reduce) block in index.css that
    // also neutralises CSS transitions / view-transitions.
    <MotionConfig reducedMotion="user">
      <ToasterProvider>
        <BrowserRouter>
          <AppShell>
            <Suspense fallback={<LoadingOverlay variant="spinner" />}>
              <Routes>
                <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
                <Route path="/map" element={<FarmMapPage />} />
                <Route path="/map/:fieldId" element={<FarmMapPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/calendar/tasks" element={<CalendarPage />} />
                <Route path="/calendar/tasks/:taskId" element={<CalendarPage />} />
                <Route path="/tasks" element={<TaskManagerPage />} />
                <Route path="/wiki/*" element={<WikiPage />} />
                <Route path="/projects" element={<PageWrapper><ProjectsList /></PageWrapper>} />
                <Route path="/projects/:id" element={<PageWrapper><ProjectDetail /></PageWrapper>} />
                <Route path="/compare" element={<PageWrapper><CompareProjects /></PageWrapper>} />
                <Route path="/equipment" element={<EquipmentPage />} />
                <Route path="/livestock" element={<LivestockPage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/financials" element={<FinancialsPage />} />
                <Route path="/cost-map" element={<CostMapPage />} />
                <Route path="/enterprises" element={<EnterprisesPage />} />
                <Route path="/annotations" element={<PageWrapper><AnnotationsPage /></PageWrapper>} />
              </Routes>
            </Suspense>
          </AppShell>
        </BrowserRouter>
      </ToasterProvider>
    </MotionConfig>
  );
}
