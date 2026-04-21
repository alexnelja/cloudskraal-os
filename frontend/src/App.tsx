import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import AppShell from './components/layout/AppShell';
import { ToasterProvider } from './components/ui/Toaster';
import Dashboard from './pages/Dashboard';
import ProjectsList from './pages/ProjectsList';
import ProjectDetail from './pages/ProjectDetail';
import CompareProjects from './pages/CompareProjects';
import FarmMapPage from './pages/FarmMapPage';
import CalendarPage from './pages/CalendarPage';
import WikiPage from './pages/WikiPage';
import EquipmentPage from './pages/EquipmentPage';
import LivestockPage from './pages/LivestockPage';
import ProductionPage from './pages/ProductionPage';
import EmployeesPage from './pages/EmployeesPage';
import InventoryPage from './pages/InventoryPage';
import FinancialsPage from './pages/FinancialsPage';
import AnnotationsPage from './pages/AnnotationsPage';
import TaskManagerPage from './pages/TaskManagerPage';

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
          <Route path="/annotations" element={<PageWrapper><AnnotationsPage /></PageWrapper>} />
        </Routes>
          </AppShell>
        </BrowserRouter>
      </ToasterProvider>
    </MotionConfig>
  );
}
