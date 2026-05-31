import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ roles }) => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-bg-primary text-accent">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <div className="h-screen w-screen flex items-center justify-center bg-bg-primary text-status-danger">Unauthorized Access</div>;
  }

  return <Outlet />;
};

export default ProtectedRoute;
