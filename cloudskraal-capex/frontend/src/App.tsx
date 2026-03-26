import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import ProjectsList from './pages/ProjectsList';
import ProjectDetail from './pages/ProjectDetail';
import CompareProjects from './pages/CompareProjects';
import FarmMapPage from './pages/FarmMapPage';
import CalendarPage from './pages/CalendarPage';
import WikiPage from './pages/WikiPage';

function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-8"><div className="max-w-7xl mx-auto">{children}</div></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
          <Route path="/map" element={<FarmMapPage />} />
          <Route path="/map/:fieldId" element={<FarmMapPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/tasks" element={<CalendarPage />} />
          <Route path="/calendar/tasks/:taskId" element={<CalendarPage />} />
          <Route path="/wiki" element={<WikiPage />} />
          <Route path="/wiki/graph" element={<WikiPage />} />
          <Route path="/wiki/:slug" element={<WikiPage />} />
          <Route path="/projects" element={<PageWrapper><ProjectsList /></PageWrapper>} />
          <Route path="/projects/:id" element={<PageWrapper><ProjectDetail /></PageWrapper>} />
          <Route path="/compare" element={<PageWrapper><CompareProjects /></PageWrapper>} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
