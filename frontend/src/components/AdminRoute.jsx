import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return <div className="report-loading" style={{ padding: '2rem' }}>Loading</div>;
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    const r = String(user.role || '');
    const allowed =
      r === 'SUPER_ADMIN' ||
      r === 'ADMINISTRATOR' ||
      r === 'ADMIN';
    if (!allowed) {
        return <Navigate to="/" replace />;
    }
    return children;
}
