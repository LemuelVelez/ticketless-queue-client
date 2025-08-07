import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WelcomePage from './pages/welcome-page';
import LoginPage from './pages/auth/login-page';
import StudentDashboard from './pages/dashboard/student-dashboard';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student" element={<StudentDashboard />} />
        </Routes>
        <Toaster richColors position="top-center" />
      </Router>
    </AuthProvider>
  );
}

export default App;
