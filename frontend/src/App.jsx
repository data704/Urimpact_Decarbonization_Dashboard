import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataStoreProvider } from './context/DataStoreContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataInput from './pages/DataInput';
import Reports from './pages/Reports';
import Decarbonization from './pages/Decarbonization';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';

function App() {
    return (
        <AuthProvider>
            <DataStoreProvider>
                <Router>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        
                        {/* Protected Routes */}
                        <Route element={<Layout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/data-input" element={<DataInput />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/decarbonization" element={<Decarbonization />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/user-management" element={<UserManagement />} />
                            <Route path="/profile" element={<Profile />} />
                        </Route>
                    </Routes>
                </Router>
            </DataStoreProvider>
        </AuthProvider>
    );
}

export default App;
