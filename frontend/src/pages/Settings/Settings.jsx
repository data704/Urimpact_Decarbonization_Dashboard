import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import './Settings.css';

function Settings() {
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const [notification, setNotification] = useState(null);
    const [settings, setSettings] = useState({
        organization: {
            name: '',
            industry: 'Technology',
            fiscalYear: 'January',
            currency: 'USD'
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
        showNotification(t('settings.saved'));
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
                <h1>{t('settings.title')}</h1>
                <p>{t('settings.subtitle')}</p>
            </div>

            {/* Organization Settings */}
            <div className="card settings-section">
                <div className="section-header">
                    <div className="section-icon">
                        <i className="fas fa-building"></i>
                    </div>
                    <div>
                        <h2>{t('settings.orgTitle')}</h2>
                        <p>{t('settings.orgSubtitle')}</p>
                    </div>
                </div>

                <div className="settings-grid">
                    <div className="form-group">
                        <label>{t('settings.organizationName')}</label>
                        <input
                            type="text"
                            value={settings.organization.name}
                            onChange={(e) => updateSetting('organization', 'name', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('settings.industrySector')}</label>
                        <select
                            value={settings.organization.industry}
                            onChange={(e) => updateSetting('organization', 'industry', e.target.value)}
                        >
                            <option value="Technology">{t('settings.industry.Technology')}</option>
                            <option value="Manufacturing">{t('settings.industry.Manufacturing')}</option>
                            <option value="Healthcare">{t('settings.industry.Healthcare')}</option>
                            <option value="Finance">{t('settings.industry.Finance')}</option>
                            <option value="Retail">{t('settings.industry.Retail')}</option>
                            <option value="Energy">{t('settings.industry.Energy')}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('settings.fiscalYearStart')}</label>
                        <select
                            value={settings.organization.fiscalYear}
                            onChange={(e) => updateSetting('organization', 'fiscalYear', e.target.value)}
                        >
                            <option value="January">{t('settings.fiscalMonth.January')}</option>
                            <option value="April">{t('settings.fiscalMonth.April')}</option>
                            <option value="July">{t('settings.fiscalMonth.July')}</option>
                            <option value="October">{t('settings.fiscalMonth.October')}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('settings.defaultCurrency')}</label>
                        <select
                            value={settings.organization.currency}
                            onChange={(e) => updateSetting('organization', 'currency', e.target.value)}
                        >
                            <option value="USD">{t('settings.currency.USD')}</option>
                            <option value="EUR">{t('settings.currency.EUR')}</option>
                            <option value="GBP">{t('settings.currency.GBP')}</option>
                            <option value="CAD">{t('settings.currency.CAD')}</option>
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
                        <h2>{t('settings.notificationTitle')}</h2>
                        <p>{t('settings.notificationSubtitle')}</p>
                    </div>
                </div>

                <div className="toggle-item">
                    <div className="toggle-info">
                        <h4>{t('settings.languageTitle')}</h4>
                        <p>{t('settings.languageSubtitle')}</p>
                    </div>
                    <select
                        value={i18n.language === 'ar' ? 'ar' : 'en'}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        style={{ minWidth: 160 }}
                    >
                        <option value="en">{t('common.english')}</option>
                        <option value="ar">{t('common.arabic')}</option>
                    </select>
                </div>

                <div className="notification-settings">
                    <div className="toggle-item">
                        <div className="toggle-info">
                            <h4>{t('settings.emailAlerts')}</h4>
                            <p>{t('settings.emailAlertsDesc')}</p>
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
                            <h4>{t('settings.weeklyDigest')}</h4>
                            <p>{t('settings.weeklyDigestDesc')}</p>
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
                            <h4>{t('settings.targetAlerts')}</h4>
                            <p>{t('settings.targetAlertsDesc')}</p>
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
                            <h4>{t('settings.reportReminders')}</h4>
                            <p>{t('settings.reportRemindersDesc')}</p>
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
                    {t('settings.saveChanges')}
                </button>
            </div>
        </div>
    );
}

export default Settings;
