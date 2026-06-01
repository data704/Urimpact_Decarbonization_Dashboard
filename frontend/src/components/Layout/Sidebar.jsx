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

/* ── inline SVG icons matching the v2 reference ── */
const icons = {
    dashboard: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    ghg: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 20h20M6 20V10l6-6 6 6v10" />
        </svg>
    ),
    esg: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
        </svg>
    ),
    gapAnalysis: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6" />
            <path d="M15 19v-3a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v3" />
            <path d="M21 19v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <line x1="1" y1="19" x2="23" y2="19" />
        </svg>
    ),
    decarbonisation: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    roiScenario: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    ),
    supplyChain: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    ),
    businessSustainability: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
    ),
    companyMgmt: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h18" />
            <rect x="2" y="2" width="9" height="19" rx="1" />
            <path d="M13 6h8a1 1 0 0 1 1 1v14" />
        </svg>
    ),
    roleSubscription: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    learnWithUs: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    ),
};

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
    const orgLine = (user?.company || '').trim() || roleLabel(user?.role);

    const premiumEsgDecarb = () =>
        premiumPlan && (canGenerateReports(user?.role) || String(user?.role || '').toUpperCase() === 'VIEWER');

    const navGroups = [
        {
            sectionKey: 'sidebar.sectionOverview',
            items: [
                {
                    to: '/',
                    icon: icons.dashboard,
                    labelKey: 'sidebar.dashboard',
                    end: true,
                    show: () => canAccessDashboard(user?.role),
                },
            ],
        },
        {
            sectionKey: 'sidebar.sectionReporting',
            items: [
                { to: '/data-input', icon: icons.ghg, labelKey: 'sidebar.ghg', show: () => canUpload(user?.role) },
                {
                    to: '/esg',
                    icon: icons.esg,
                    labelKey: 'sidebar.esg',
                    show: () => premiumEsgDecarb(),
                },
                {
                    to: '/reports',
                    icon: icons.gapAnalysis,
                    labelKey: 'sidebar.gapAnalysis',
                    show: () => premiumPlan && canGenerateReports(user?.role),
                },
            ],
        },
        {
            sectionKey: 'sidebar.sectionPlanning',
            items: [
                {
                    to: '/decarbonization',
                    icon: icons.decarbonisation,
                    labelKey: 'sidebar.decarbonisation',
                    show: () => premiumEsgDecarb(),
                },
                { to: '/roi', icon: icons.roiScenario, labelKey: 'sidebar.roiScenario' },
                { to: '/supply-chain', icon: icons.supplyChain, labelKey: 'sidebar.supplychain' },
                { to: '/bsm', icon: icons.businessSustainability, labelKey: 'sidebar.businessSustainability' },
            ],
        },
        {
            sectionKey: 'sidebar.sectionAdmin',
            items: [
                {
                    to: '/settings',
                    icon: icons.companyMgmt,
                    labelKey: 'sidebar.companyMgmt',
                    show: () => canAccessDashboard(user?.role),
                },
                {
                    to: canManageUsers(user?.role) ? '/user-management' : '/settings',
                    icon: icons.roleSubscription,
                    labelKey: 'sidebar.roleSubscription',
                    badge: 3,
                    show: () => canAccessDashboard(user?.role),
                },
                { to: '/learn', icon: icons.learnWithUs, labelKey: 'sidebar.learnWithUs' },
            ],
        },
    ];

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <aside className={`sidebar ${isOpen ? 'active' : ''}`}>
                <div className="sidebar-header sb-logo">
                    <Link to="/" className="logo sb-logo-link" onClick={onClose} aria-label={t('sidebar.dashboard')}>
                        <img src="/logo.svg" alt="URIMPACT" className="logo-img sb-logo-img" />
                    </Link>
                </div>

                <nav className="sidebar-nav sb-nav" aria-label={t('sidebar.mainNav')}>
                    {navGroups.map((group) => {
                        const visible = group.items.filter((item) => {
                            if (item.soon) return true;
                            return item.show ? item.show() : true;
                        });
                        if (!visible.length) return null;
                        return (
                            <div key={group.sectionKey} className="sb-group">
                                <div className="sb-sec" role="presentation">
                                    {t(group.sectionKey)}
                                </div>
                                <ul className="sb-sec-list">
                                    {visible.map((item) =>
                                        item.soon ? (
                                            <li key={item.labelKey}>
                                                <button
                                                    type="button"
                                                    className="sidebar-nav-soon sb-nav-soon"
                                                    disabled
                                                    title={t('sidebar.comingSoon')}
                                                >
                                                    <span className="sb-nav-icon">{item.icon}</span>
                                                    <span className="sb-nav-label">{t(item.labelKey)}</span>
                                                </button>
                                            </li>
                                        ) : (
                                            <li key={item.labelKey}>
                                                <NavLink
                                                    to={item.to}
                                                    end={item.end === true}
                                                    className={({ isActive }) => (isActive ? 'active sb-nav-link' : 'sb-nav-link')}
                                                    onClick={onClose}
                                                >
                                                    <span className="sb-nav-icon">{item.icon}</span>
                                                    <span className="sb-nav-label">{t(item.labelKey)}</span>
                                                    {item.badge != null && (
                                                        <span className="sb-nav-badge" aria-label={t('sidebar.roleBadgeAria', { count: item.badge })}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </NavLink>
                                            </li>
                                        )
                                    )}
                                </ul>
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer sb-user">
                    <Link to="/profile" className="sidebar-user-card sb-user-link" onClick={onClose} aria-label={t('sidebar.viewProfile')}>
                        <div className="sidebar-user-avatar sb-avatar">
                            {user?.avatar ? <img src={user.avatar} alt="" /> : <span className="sidebar-user-initials">{initials}</span>}
                        </div>
                        <div className="sidebar-user-meta">
                            <span className="sidebar-user-name">{displayName}</span>
                            <span className="sidebar-user-role">{orgLine}</span>
                        </div>
                    </Link>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
