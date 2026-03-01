import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

function Header({ onMenuToggle }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

    const notifications = [
        { id: 1, type: 'success', message: 'Emission data verified successfully', time: '5 min ago', unread: true },
        { id: 2, type: 'warning', message: 'Monthly target approaching limit', time: '1 hour ago', unread: true },
        { id: 3, type: 'info', message: 'New report available for download', time: '2 hours ago', unread: false },
        { id: 4, type: 'success', message: 'Carbon offset certificate generated', time: '1 day ago', unread: false },
    ];

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

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

    const unreadCount = notifications.filter(n => n.unread).length;

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
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`notification-item ${notification.unread ? 'unread' : ''}`}
                                        >
                                            <div className={`notification-icon ${notification.type}`}>
                                                <i className={`fas fa-${
                                                    notification.type === 'success' ? 'check' :
                                                    notification.type === 'warning' ? 'exclamation-triangle' :
                                                    notification.type === 'error' ? 'times' : 'info'
                                                }`}></i>
                                            </div>
                                            <div className="notification-content">
                                                <p>{notification.message}</p>
                                                <span className="notification-time">{notification.time}</span>
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
