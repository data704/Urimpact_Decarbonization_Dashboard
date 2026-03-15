import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Settings.css';

function Settings() {
    const { user } = useAuth();
    const [notification, setNotification] = useState(null);
    const [settings, setSettings] = useState({
        organization: {
            name: '',
            industry: 'Technology',
            fiscalYear: 'January',
            currency: 'USD'
        },
        emissionFactors: {
            database: 'IPCC 2021',
            gwpValues: 'AR5',
            defaultGridRegion: 'US - WECC'
        },
        notifications: {
            emailAlerts: true,
            weeklyDigest: true,
            targetAlerts: true,
            reportReminders: false
        }
    });

    useEffect(() => {
        if (user?.company != null && user.company !== '') {
            setSettings(prev => ({
                ...prev,
                organization: {
                    ...prev.organization,
                    name: user.company
                }
            }));
        }
    }, [user?.company]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSave = () => {
        showNotification('Settings saved successfully!');
    };

    const updateSetting = (category, field, value) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
    };

    return (
        <div className="settings-content">
            {/* Notification */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className="fas fa-check-circle"></i>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header">
                <h1>Settings</h1>
                <p>Configure your organization and emission calculation preferences</p>
            </div>

            {/* Organization Settings */}
            <div className="card settings-section">
                <div className="section-header">
                    <div className="section-icon">
                        <i className="fas fa-building"></i>
                    </div>
                    <div>
                        <h2>Organization Settings</h2>
                        <p>Configure your organization details</p>
                    </div>
                </div>

                <div className="settings-grid">
                    <div className="form-group">
                        <label>Organization Name</label>
                        <input
                            type="text"
                            value={settings.organization.name}
                            onChange={(e) => updateSetting('organization', 'name', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Industry Sector</label>
                        <select
                            value={settings.organization.industry}
                            onChange={(e) => updateSetting('organization', 'industry', e.target.value)}
                        >
                            <option value="Technology">Technology</option>
                            <option value="Manufacturing">Manufacturing</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Finance">Finance</option>
                            <option value="Retail">Retail</option>
                            <option value="Energy">Energy</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Fiscal Year Start</label>
                        <select
                            value={settings.organization.fiscalYear}
                            onChange={(e) => updateSetting('organization', 'fiscalYear', e.target.value)}
                        >
                            <option value="January">January</option>
                            <option value="April">April</option>
                            <option value="July">July</option>
                            <option value="October">October</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Default Currency</label>
                        <select
                            value={settings.organization.currency}
                            onChange={(e) => updateSetting('organization', 'currency', e.target.value)}
                        >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="CAD">CAD ($)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Emission Factor Settings */}
            <div className="card settings-section">
                <div className="section-header">
                    <div className="section-icon">
                        <i className="fas fa-calculator"></i>
                    </div>
                    <div>
                        <h2>Emission Factors</h2>
                        <p>Configure calculation methodologies</p>
                    </div>
                </div>

                <div className="settings-grid">
                    <div className="form-group">
                        <label>Emission Factor Database</label>
                        <select
                            value={settings.emissionFactors.database}
                            onChange={(e) => updateSetting('emissionFactors', 'database', e.target.value)}
                        >
                            <option value="IPCC 2021">IPCC 2021</option>
                            <option value="EPA 2023">EPA 2023</option>
                            <option value="DEFRA 2023">DEFRA 2023</option>
                            <option value="GHG Protocol">GHG Protocol</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>GWP Values</label>
                        <select
                            value={settings.emissionFactors.gwpValues}
                            onChange={(e) => updateSetting('emissionFactors', 'gwpValues', e.target.value)}
                        >
                            <option value="AR5">AR5 (2014)</option>
                            <option value="AR6">AR6 (2021)</option>
                            <option value="AR4">AR4 (2007)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Default Grid Region</label>
                        <select
                            value={settings.emissionFactors.defaultGridRegion}
                            onChange={(e) => updateSetting('emissionFactors', 'defaultGridRegion', e.target.value)}
                        >
                            <option value="US - WECC">US - WECC</option>
                            <option value="US - RFC">US - RFC</option>
                            <option value="US - SERC">US - SERC</option>
                            <option value="EU - Average">EU - Average</option>
                            <option value="UK - Grid">UK - Grid</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Notification Settings */}
            <div className="card settings-section">
                <div className="section-header">
                    <div className="section-icon">
                        <i className="fas fa-bell"></i>
                    </div>
                    <div>
                        <h2>Notification Preferences</h2>
                        <p>Manage your notification settings</p>
                    </div>
                </div>

                <div className="notification-settings">
                    <div className="toggle-item">
                        <div className="toggle-info">
                            <h4>Email Alerts</h4>
                            <p>Receive important updates via email</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.notifications.emailAlerts}
                                onChange={(e) => updateSetting('notifications', 'emailAlerts', e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                    <div className="toggle-item">
                        <div className="toggle-info">
                            <h4>Weekly Digest</h4>
                            <p>Get a weekly summary of your emissions</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.notifications.weeklyDigest}
                                onChange={(e) => updateSetting('notifications', 'weeklyDigest', e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                    <div className="toggle-item">
                        <div className="toggle-info">
                            <h4>Target Alerts</h4>
                            <p>Notify when approaching emission targets</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.notifications.targetAlerts}
                                onChange={(e) => updateSetting('notifications', 'targetAlerts', e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                    <div className="toggle-item">
                        <div className="toggle-info">
                            <h4>Report Reminders</h4>
                            <p>Reminders for report submissions</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.notifications.reportReminders}
                                onChange={(e) => updateSetting('notifications', 'reportReminders', e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="settings-actions">
                <button className="btn btn-primary" onClick={handleSave}>
                    <i className="fas fa-save"></i>
                    Save Changes
                </button>
            </div>
        </div>
    );
}

export default Settings;
