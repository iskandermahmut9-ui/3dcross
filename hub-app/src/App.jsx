import React from 'react';
// 🟢 Мы импортируем HashRouter, но даем ему "никнейм" Router, 
// чтобы в коде ниже ничего не менять.
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

// --- ИМПОРТ КОНТЕКСТА АВТОРИЗАЦИИ ---
import { AuthProvider } from './context/AuthContext';

// --- ТВОИ ИМПОРТЫ ---
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import Workspace from './components/Workspace';
import Designers from './pages/Designers';
import Auth from './pages/Auth';
import EditTZ from './pages/EditTZ';

function App() {
  return (
    <AuthProvider>
      {/* 🟢 Здесь мы убрали basename="/hub", так как HashRouter 
          сам поймет, что он находится в папке /hub/ по символу # */}
      <Router>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/room/:roomId/edit-tz" element={<EditTZ />} />

          <Route path="/" element={<Designers />} /> 
          <Route path="/projects" element={<Dashboard />} /> 
          <Route path="/designer/:designerId" element={<Dashboard />} />
          
          <Route path="/project/:id" element={<ProjectView />} />
          <Route path="/workspace/:roomId" element={<Workspace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;