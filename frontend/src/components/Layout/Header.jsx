import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getRecentActivity } from '../../api/client';
import { isAdministrator } from '../../utils/roles';
import { ONBOARDING_EDIT_QUERY } from '../../utils/onboardingRevisit';
import './Layout.css';

function Header({ onMenuToggle }) {
    const { user, logout } = useAuth();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

    const [notifications, setNotifications] = useState([]);

    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const currentDate = new Date().toLocaleDateString(dateLocale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    const isAdminUser = user?.role === 'ADMINISTRATOR' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

    // Load recent activity for notification popup (top 5) — administrators only
    useEffect(() => {
        if (!isAdminUser) {
            setNotifications([]);
            return;
        }
        getRecentActivity(5)
            .then((logs) => {
                const items = Array.isArray(logs) ? logs : [];
                const mapped = items.map((log) => {
                    const who = log.user
                        ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                        : t('header.system');
                    const when = log.timestamp ? new Date(log.timestamp).toLocaleString(dateLocale) : '';
                    const action = (log.action || '').replace(/_/g, ' ').toLowerCase();
                    return {
                        id: log.id,
                        who,
                        action,
                        time: when,
                    };
                });
                setNotifications(mapped);
            })
            .catch(() => {
                setNotifications([]);
            });
    }, [isAdminUser, t, dateLocale]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfile(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const unreadCount = notifications.length;

    const pageTitle = useMemo(() => {
        if (pathname === '/') return t('sidebar.dashboard');
        if (pathname.startsWith('/data-input')) return t('sidebar.ghg');
        if (pathname.startsWith('/decarbonization')) return t('sidebar.esgDecarb');
        if (pathname.startsWith('/reports')) return t('sidebar.gapAnalysis');
        if (pathname.startsWith('/settings')) return t('sidebar.roleSubscription');
        if (pathname.startsWith('/user-management')) return t('sidebar.userManagement');
        if (pathname.startsWith('/notifications')) return t('sidebar.userTasks');
        if (pathname.startsWith('/profile')) return t('header.myProfile');
        return t('sidebar.dashboard');
    }, [pathname, t]);

    const headerInitials = useMemo(() => {
        if (!user?.firstName && !user?.lastName) return '?';
        return `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || '?';
    }, [user]);

    const showOnboardingRevisit =
        isAdministrator(user?.role) &&
        user?.organizationId &&
        (user.organizationOnboardingComplete ||
            user.scope1OnboardingComplete ||
            user.scope2OnboardingComplete);

    const companyLabel = (user?.company || '').trim() || t('header.defaultOrganization');

    return (
        <header className="header">
            <div className="header-left">
                <button type="button" className="menu-toggle" onClick={onMenuToggle} aria-label={t('header.openMenu')}>
                    <i className="fas fa-bars"></i>
                </button>
                <h1 className="header-page-title">{pageTitle}</h1>
                <div className="search-box header-search-desktop">
                    <i className="fas fa-search"></i>
                    <input type="search" placeholder={t('common.searchPlaceholder')} />
                </div>
            </div>

            <div className="header-right">
                <div className="header-item header-company-wrap">
                    <label className="header-company-label" htmlFor="header-company-select">
                        {t('header.company')}
                    </label>
                    <select id="header-company-select" className="header-company-select" aria-label={t('header.company')}>
                        <option value="default">{companyLabel}</option>
                    </select>
                </div>

                <div className="header-item header-date-desktop">
                    <span className="date-display">{currentDate}</span>
                </div>

                <div className="header-item">
                    <select
                        className="header-language-select"
                        value={i18n.language === 'ar' ? 'ar' : 'en'}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        aria-label={t('common.language')}
                    >
                        <option value="en">{t('common.english')}</option>
                        <option value="ar">{t('common.arabic')}</option>
                    </select>
                </div>

                {/* User + Notifications group */}
                <div className="header-item header-user-group" ref={profileRef}>
                    <div className="header-user-trigger-row">
                        <div
                            className="profile-trigger"
                            onClick={() => setShowProfile(!showProfile)}
                        >
                            <div className="header-avatar">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="" />
                                ) : (
                                    <span className="header-avatar-initials">{headerInitials}</span>
                                )}
                            </div>
                            <span className="user-name-header">{user?.firstName || t('header.user')}</span>
                        </div>

                        {isAdminUser && (
                            <div className="header-notification-wrap" ref={notificationRef}>
                                <button
                                    type="button"
                                    className="notification-trigger"
                                    onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
                                    aria-label={`${t('header.notifications')}${unreadCount > 0 ? `, ${unreadCount}` : ''}`}
                                >
                                    <i className="fas fa-bell"></i>
                                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                                </button>

                                <div className={`dropdown-menu notification-dropdown ${showNotifications ? 'active' : ''}`}>
                                    <div className="dropdown-header">
                                        <h4>{t('header.notifications')}</h4>
                                        <button type="button" className="mark-all-read">{t('header.markAllRead')}</button>
                                    </div>
                                    <div className="dropdown-content">
                                        {notifications.length === 0 && (
                                            <div className="notification-item">
                                                <div className="notification-content">
                                                    <p>{t('header.noRecentActivity')}</p>
                                                </div>
                                            </div>
                                        )}
                                        {notifications.map((n) => (
                                            <div key={n.id} className="notification-item unread">
                                                <div className="notification-content">
                                                    <p>
                                                        <strong>{n.who}</strong> {n.action}
                                                    </p>
                                                    <span className="notification-time">{n.time}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="dropdown-footer">
                                        <Link to="/notifications">{t('header.viewAllNotifications')}</Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            className="profile-chevron"
                            onClick={() => setShowProfile(!showProfile)}
                            aria-label={t('header.openProfileMenu')}
                        >
                            <i className="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div className={`dropdown-menu profile-dropdown ${showProfile ? 'active' : ''}`}>
                        <div className="profile-header">
                            <div className="profile-avatar">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="" />
                                ) : (
                                    <span className="header-avatar-initials">{headerInitials}</span>
                                )}
                            </div>
                            <div className="profile-info">
                                <h4>{user ? `${user.firstName} ${user.lastName}` : t('sidebar.guest')}</h4>
                                <p>{user?.email || ''}</p>
                            </div>
                        </div>
                        <div className="dropdown-content">
                            <Link to="/profile" className="dropdown-item" onClick={() => setShowProfile(false)}>
                                <i className="fas fa-user"></i>
                                <span>{t('header.myProfile')}</span>
                            </Link>
                            <Link to="/settings" className="dropdown-item" onClick={() => setShowProfile(false)}>
                                <i className="fas fa-cog"></i>
                                <span>{t('header.settings')}</span>
                            </Link>
                            {showOnboardingRevisit && (
                                <>
                                    <div className="dropdown-divider" />
                                    <div className="dropdown-group-label">{t('header.editOnboarding')}</div>
                                    {user.organizationOnboardingComplete && (
                                        <Link
                                            to={`/company-onboarding${ONBOARDING_EDIT_QUERY}`}
                                            className="dropdown-item"
                                            onClick={() => setShowProfile(false)}
                                        >
                                            <i className="fas fa-building"></i>
                                            <span>{t('header.editOnboardingCompany')}</span>
                                        </Link>
                                    )}
                                    {user.scope1OnboardingComplete && (
                                        <Link
                                            to={`/scope-onboarding${ONBOARDING_EDIT_QUERY}`}
                                            className="dropdown-item"
                                            onClick={() => setShowProfile(false)}
                                        >
                                            <i className="fas fa-fire"></i>
                                            <span>{t('header.editOnboardingScope1')}</span>
                                        </Link>
                                    )}
                                    {user.scope2OnboardingComplete && (
                                        <Link
                                            to={`/scope-2-onboarding${ONBOARDING_EDIT_QUERY}`}
                                            className="dropdown-item"
                                            onClick={() => setShowProfile(false)}
                                        >
                                            <i className="fas fa-bolt"></i>
                                            <span>{t('header.editOnboardingScope2')}</span>
                                        </Link>
                                    )}
                                </>
                            )}
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item logout" onClick={handleLogout}>
                                <i className="fas fa-sign-out-alt"></i>
                                <span>{t('header.signOut')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
