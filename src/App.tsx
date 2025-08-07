import { useState } from 'react';
import WelcomePage from './pages/welcome-page';
import LoginPage from './pages/login-page';
import StudentDashboard from './pages/student-dashboard';
import { Toaster } from 'sonner';

// Define page states
type Page = 'welcome' | 'login' | 'dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [loggedInStudentId, setLoggedInStudentId] = useState<string | null>(null);

  const handleLoginSuccess = (studentId: string) => {
    setLoggedInStudentId(studentId);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setLoggedInStudentId(null);
    setCurrentPage('login');
  };

  let content;
  switch (currentPage) {
    case 'welcome':
      content = <WelcomePage onGetStarted={() => setCurrentPage('login')} />;
      break;
    case 'login':
      content = <LoginPage onLoginSuccess={handleLoginSuccess} />;
      break;
    case 'dashboard':
      // Pass the logged-in student ID to the dashboard
      content = loggedInStudentId ? (
        <StudentDashboard studentId={loggedInStudentId} onLogout={handleLogout} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      );
      break;
    default:
      content = <WelcomePage onGetStarted={() => setCurrentPage('login')} />;
  }

  return (
    <>
      {content}
      <Toaster richColors position="top-center" />
    </>
  );
}

export default App;
