import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRecentActivity } from '../../api/client';
import './Layout.css';

function Header({ onMenuToggle }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

    const [notifications, setNotifications] = useState([]);

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    // Load recent activity for notification popup (top 5)
    useEffect(() => {
        getRecentActivity(5)
            .then((logs) => {
                const items = Array.isArray(logs) ? logs : [];
                const mapped = items.map((log) => {
                    const who = log.user
                        ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                        : 'System';
                    const when = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';
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
    }, []);

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

    return (
        <header className="header">
            <div className="header-left">
                <button className="menu-toggle" onClick={onMenuToggle}>
                    <i className="fas fa-bars"></i>
                </button>
                <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input type="text" placeholder="Search emissions, reports..." />
                </div>
            </div>

            <div className="header-right">
                <div className="header-item">
                    <span className="date-display">{currentDate}</span>
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
                                    <img src={user.avatar} alt="Avatar" />
                                ) : (
                                    <i className="fas fa-user"></i>
                                )}
                            </div>
                            <span className="user-name-header">{user?.firstName || 'User'}</span>
                        </div>

                        <div className="header-notification-wrap" ref={notificationRef}>
                            <button
                                type="button"
                                className="notification-trigger"
                                onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
                                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                            >
                                <i className="fas fa-bell"></i>
                                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                            </button>

                            <div className={`dropdown-menu notification-dropdown ${showNotifications ? 'active' : ''}`}>
                                <div className="dropdown-header">
                                    <h4>Notifications</h4>
                                    <button type="button" className="mark-all-read">Mark all read</button>
                                </div>
                                <div className="dropdown-content">
                                    {notifications.length === 0 && (
                                        <div className="notification-item">
                                            <div className="notification-content">
                                                <p>No recent activity</p>
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
                                    <Link to="/notifications">View all notifications</Link>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="profile-chevron"
                            onClick={() => setShowProfile(!showProfile)}
                            aria-label="Open profile menu"
                        >
                            <i className="fas fa-chevron-down"></i>
                        </button>
                    </div>

                    <div className={`dropdown-menu profile-dropdown ${showProfile ? 'active' : ''}`}>
                        <div className="profile-header">
                            <div className="profile-avatar">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Avatar" />
                                ) : (
                                    <i className="fas fa-user"></i>
                                )}
                            </div>
                            <div className="profile-info">
                                <h4>{user ? `${user.firstName} ${user.lastName}` : 'Guest'}</h4>
                                <p>{user?.email || ''}</p>
                            </div>
                        </div>
                        <div className="dropdown-content">
                            <Link to="/profile" className="dropdown-item" onClick={() => setShowProfile(false)}>
                                <i className="fas fa-user"></i>
                                <span>My Profile</span>
                            </Link>
                            <Link to="/settings" className="dropdown-item" onClick={() => setShowProfile(false)}>
                                <i className="fas fa-cog"></i>
                                <span>Settings</span>
                            </Link>
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item logout" onClick={handleLogout}>
                                <i className="fas fa-sign-out-alt"></i>
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
