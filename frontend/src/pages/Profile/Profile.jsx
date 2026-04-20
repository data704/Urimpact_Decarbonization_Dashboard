import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

function Profile() {
    const { t } = useTranslation();
    const { user, updateProfile } = useAuth();
    const [notification, setNotification] = useState(null);
    const fileInputRef = useRef(null);
    
    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        company: user?.company || '',
        role: user?.role || '',
        phone: '',
        timezone: 'UTC-8'
    });

    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateProfile({ avatar: reader.result });
                showNotification(t('profile.avatarUpdated'));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProfileSave = (e) => {
        e.preventDefault();
        updateProfile({
            firstName: formData.firstName,
            lastName: formData.lastName,
            company: formData.company
        });
        showNotification(t('profile.profileUpdated'));
    };

    const handlePasswordChange = (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            showNotification(t('profile.passwordsMismatch'), 'error');
            return;
        }
        if (passwords.new.length < 6) {
            showNotification(t('profile.passwordTooShort'), 'error');
            return;
        }
        showNotification(t('profile.passwordChanged'));
        setPasswords({ current: '', new: '', confirm: '' });
    };

    return (
        <div className="profile-content">
            {/* Notification */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className={`fas fa-${notification.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header">
                <h1>{t('profile.title')}</h1>
                <p>{t('profile.subtitle')}</p>
            </div>

            <div className="profile-grid">
                {/* Profile Card */}
                <div className="card profile-card">
                    <div className="profile-avatar-section" onClick={handleAvatarClick}>
                        <div className="profile-avatar-large">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="Avatar" />
                            ) : (
                                <i className="fas fa-user"></i>
                            )}
                            <div className="avatar-overlay">
                                <i className="fas fa-camera"></i>
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            accept="image/*"
                            hidden
                        />
                        <h3>{user ? `${user.firstName} ${user.lastName}` : 'User'}</h3>
                        <span className="profile-role">{user?.role || 'Admin'}</span>
                        <span className="profile-company">{user?.company || 'Company'}</span>
                    </div>

                    <div className="profile-stats">
                        <div className="profile-stat">
                            <span className="stat-number">24</span>
                            <span className="stat-text">Reports</span>
                        </div>
                        <div className="profile-stat">
                            <span className="stat-number">156</span>
                            <span className="stat-text">Entries</span>
                        </div>
                        <div className="profile-stat">
                            <span className="stat-number">12</span>
                            <span className="stat-text">Offsets</span>
                        </div>
                    </div>
                </div>

                {/* Profile Form */}
                <div className="card profile-form-card">
                    <h2>Personal Information</h2>
                    <form onSubmit={handleProfileSave}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>First Name</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled
                            />
                            <span className="input-hint">Email cannot be changed</span>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Company</label>
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <input
                                    type="text"
                                    value={formData.role}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Phone Number</label>
                                <input
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Timezone</label>
                                <select
                                    value={formData.timezone}
                                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                >
                                    <option value="UTC-8">Pacific Time (UTC-8)</option>
                                    <option value="UTC-5">Eastern Time (UTC-5)</option>
                                    <option value="UTC+0">GMT (UTC+0)</option>
                                    <option value="UTC+1">Central European (UTC+1)</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary">
                            <i className="fas fa-save"></i>
                            Save Changes
                        </button>
                    </form>
                </div>

                {/* Password Change */}
                <div className="card password-card">
                    <h2>Change Password</h2>
                    <form onSubmit={handlePasswordChange}>
                        <div className="form-group">
                            <label>Current Password</label>
                            <input
                                type="password"
                                placeholder="Enter current password"
                                value={passwords.current}
                                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                placeholder="Enter new password"
                                value={passwords.new}
                                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary">
                            <i className="fas fa-key"></i>
                            Update Password
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Profile;
