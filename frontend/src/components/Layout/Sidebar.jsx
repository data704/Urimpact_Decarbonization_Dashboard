import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    canUpload,
    canAccessDashboard,
    canGenerateReports,
    canManageUsers,
    roleLabel,
} from '../../utils/roles';
import './Layout.css';

function Sidebar({ isOpen, onClose }) {
    const { user } = useAuth();

    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Guest' : 'Guest';
    const initials = displayName !== 'Guest'
        ? (user?.firstName?.charAt(0) || '') + (user?.lastName?.charAt(0) || '')
        : '?';
    const allNavItems = [
        { to: '/data-input', icon: 'fas fa-pen-to-square', label: 'Data Input', show: () => canUpload(user?.role) },
        { to: '/', icon: 'fas fa-gauge-high', label: 'Dashboard', show: () => canAccessDashboard(user?.role) },
        { to: '/decarbonization', icon: 'fas fa-seedling', label: 'Decarbonization', show: () => canGenerateReports(user?.role) || String(user?.role || '').toUpperCase() === 'VIEWER' },
        { to: '/reports', icon: 'fas fa-file-lines', label: 'Reports', show: () => canGenerateReports(user?.role) },
        { to: '/settings', icon: 'fas fa-gear', label: 'Settings', show: () => canManageUsers(user?.role) },
        { to: '/user-management', icon: 'fas fa-user-group', label: 'User Management', show: () => canManageUsers(user?.role) },
    ];
    const navItems = allNavItems.filter((item) => (item.show ? item.show() : true));

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
            
            <aside className={`sidebar ${isOpen ? 'active' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <img src="/logo.svg" alt="URIMPACT" className="logo-img" />
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <ul>
                        {navItems.map((item) => (
                            <li key={item.to}>
                                <NavLink 
                                    to={item.to} 
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                    onClick={onClose}
                                >
                                    <i className={item.icon}></i>
                                    <span>{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    <Link to="/profile" className="sidebar-user-card" onClick={onClose} aria-label="View profile">
                        <div className="sidebar-user-avatar">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="" />
                            ) : (
                                <span className="sidebar-user-initials">{initials}</span>
                            )}
                        </div>
                        <div className="sidebar-user-meta">
                            <span className="sidebar-user-name">{displayName}</span>
                            <span className="sidebar-user-role">{roleLabel(user?.role)}</span>
                        </div>
                        <i className="fas fa-chevron-right sidebar-user-chevron" aria-hidden></i>
                    </Link>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
