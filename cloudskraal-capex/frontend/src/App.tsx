import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
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

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<FarmMapPage />} />
          <Route path="/map/:fieldId" element={<FarmMapPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/tasks" element={<CalendarPage />} />
          <Route path="/calendar/tasks/:taskId" element={<CalendarPage />} />
          <Route path="/wiki/*" element={<WikiPage />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/compare" element={<CompareProjects />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/livestock" element={<LivestockPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/financials" element={<FinancialsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
