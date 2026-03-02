import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/useAuth';
import { AuthGuard } from './features/auth/AuthGuard';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import BoardPage from './features/dashboard/BoardPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/board" element={<AuthGuard><BoardPage /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
