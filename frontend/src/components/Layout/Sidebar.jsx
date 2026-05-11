import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    canUpload,
    canAccessDashboard,
    canGenerateReports,
    canManageUsers,
    planAllowsPremiumAnalytics,
    roleLabel,
} from '../../utils/roles';
import './Layout.css';

function Sidebar({ isOpen, onClose }) {
    const { user } = useAuth();
    const { t } = useTranslation();

    const guestLabel = t('sidebar.guest');
    const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || guestLabel : guestLabel;
    const initials =
        displayName !== guestLabel
            ? (user?.firstName?.charAt(0) || '') + (user?.lastName?.charAt(0) || '')
            : '?';
    const plan = user?.subscriptionPlan || 'STANDARD';
    const premiumPlan = planAllowsPremiumAnalytics(plan);

    const linkItems = [
        { to: '/', icon: 'fas fa-gauge-high', label: t('sidebar.dashboard'), end: true, show: () => canAccessDashboard(user?.role) },
        { to: '/data-input', icon: 'fas fa-leaf', label: t('sidebar.ghg'), show: () => canUpload(user?.role) },
        {
            to: '/decarbonization',
            icon: 'fas fa-seedling',
            label: t('sidebar.esgDecarb'),
            show: () =>
                premiumPlan &&
                (canGenerateReports(user?.role) || String(user?.role || '').toUpperCase() === 'VIEWER'),
        },
        {
            to: '/reports',
            icon: 'fas fa-magnifying-glass-chart',
            label: t('sidebar.gapAnalysis'),
            show: () => premiumPlan && canGenerateReports(user?.role),
        },
        { to: '/notifications', icon: 'fas fa-list-check', label: t('sidebar.userTasks'), show: () => canAccessDashboard(user?.role) },
        {
            to: '/user-management',
            icon: 'fas fa-user-group',
            label: t('sidebar.userManagement'),
            show: () => canManageUsers(user?.role),
        },
        { to: '/settings', icon: 'fas fa-id-badge', label: t('sidebar.roleSubscription'), show: () => canManageUsers(user?.role) },
    ];

    const soonItems = [
        { icon: 'fas fa-link', label: t('sidebar.supplychain') },
        { icon: 'fas fa-building', label: t('sidebar.businessSustainability') },
        { icon: 'fas fa-graduation-cap', label: t('sidebar.learnWithUs') },
    ];

    const visibleLinks = linkItems.filter((item) => (item.show ? item.show() : true));

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <aside className={`sidebar ${isOpen ? 'active' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <img src="/logo.svg" alt="URIMPACT" className="logo-img" />
                    </div>
                </div>

                <nav className="sidebar-nav" aria-label={t('sidebar.mainNav')}>
                    <ul>
                        {visibleLinks.map((item) => (
                            <li key={`${item.label}`}>
                                <NavLink
                                    to={item.to}
                                    end={item.end === true}
                                    className={({ isActive }) => (isActive ? 'active' : '')}
                                    onClick={onClose}
                                >
                                    <i className={item.icon} />
                                    <span>{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                        {soonItems.map((item) => (
                            <li key={item.label}>
                                <button type="button" className="sidebar-nav-soon" disabled title={t('sidebar.comingSoon')}>
                                    <i className={item.icon} />
                                    <span>{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    <Link to="/profile" className="sidebar-user-card" onClick={onClose} aria-label={t('sidebar.viewProfile')}>
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
                        <i className="fas fa-chevron-right sidebar-user-chevron" aria-hidden />
                    </Link>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
