import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import './Settings.css';

const COMPANY_PROFILE = [
    ['Company Name', 'Acme Industries Pvt. Ltd.'],
    ['Industry', 'Manufacturing'],
    ['CIN No.', 'U27100MH2018PTC308XXX'],
    ['GST ID', '27AABCN1234F1Z5'],
    ['Website', 'www.acmeindustries.com'],
    ['Reporting Framework', 'GHG Protocol + GRI Standards'],
    ['Base Year', '2020'],
    ['Primary Contact', 'Arjun Sharma – CSO'],
];

const FACILITIES = [
    { name: 'Plant A', location: 'Mumbai', type: 'Manufacturing', emissions: '18,200 tCO₂e' },
    { name: 'Plant B', location: 'Pune', type: 'Manufacturing', emissions: '14,100 tCO₂e' },
    { name: 'Head Office', location: 'Mumbai', type: 'Commercial', emissions: '2,400 tCO₂e' },
    { name: 'Warehouse', location: 'Chennai', type: 'Logistics', emissions: '3,800 tCO₂e' },
];

const MODULES = [
    'GHG Reporting',
    'ESG Management',
    'Gap Analysis',
    'Decarbonisation',
    'Supply Chain Management',
    'Business Sustainability',
];

function Settings() {
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const [notification, setNotification] = useState(null);
    const [moduleStates, setModuleStates] = useState(
        () => Object.fromEntries(MODULES.map((m) => [m, true]))
    );
    const [profileData, setProfileData] = useState(COMPANY_PROFILE);

    useEffect(() => {
        if (user?.company != null && user.company !== '') {
            setProfileData((prev) =>
                prev.map(([k, v]) => (k === 'Company Name' ? [k, user.company] : [k, v]))
            );
        }
    }, [user?.company]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const toggleModule = (mod) => {
        setModuleStates((prev) => ({ ...prev, [mod]: !prev[mod] }));
    };

    return (
        <div className="cm-page">
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="cm-header">
                <div>
                    <h1 className="cm-title">Company Management</h1>
                    <p className="cm-subtitle">Manage company profile, facilities, and module settings</p>
                </div>
                <div className="cm-header-actions">
                    <div className="cm-lang-select">
                        <label>Language</label>
                        <select
                            value={i18n.language === 'ar' ? 'ar' : 'en'}
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                        >
                            <option value="en">{t('common.english')}</option>
                            <option value="ar">{t('common.arabic')}</option>
                        </select>
                    </div>
                    <button type="button" className="cm-btn cm-btn--primary">+ Add Facility</button>
                </div>
            </div>

            <div className="cm-grid-2">
                {/* Company Profile */}
                <div className="cm-card">
                    <div className="cm-card-title">Company Profile</div>
                    {profileData.map(([key, val]) => (
                        <div key={key} className="cm-profile-row">
                            <span className="cm-profile-key">{key}</span>
                            <span className="cm-profile-val">{val}</span>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="cm-btn cm-btn--outline cm-btn--sm"
                        style={{ marginTop: 14 }}
                        onClick={() => showNotification('Profile edit coming soon')}
                    >
                        Edit Profile
                    </button>
                </div>

                {/* Right column: Facilities + Modules */}
                <div>
                    {/* Facilities */}
                    <div className="cm-card" style={{ marginBottom: 14 }}>
                        <div className="cm-card-title">Facilities</div>
                        {FACILITIES.map((f) => (
                            <div key={f.name} className="cm-facility-row">
                                <div className="cm-facility-avatar">{f.name[0]}</div>
                                <div className="cm-facility-info">
                                    <div className="cm-facility-name">
                                        {f.name} <span className="cm-facility-loc">· {f.location}</span>
                                    </div>
                                    <div className="cm-facility-meta">{f.type} · {f.emissions}</div>
                                </div>
                                <button type="button" className="cm-btn cm-btn--outline cm-btn--sm">Edit</button>
                            </div>
                        ))}
                    </div>

                    {/* Modules Enabled */}
                    <div className="cm-card">
                        <div className="cm-card-title">Modules Enabled</div>
                        {MODULES.map((mod) => (
                            <div key={mod} className="cm-module-row">
                                <div className="cm-module-name">{mod}</div>
                                <label className="cm-toggle">
                                    <input
                                        type="checkbox"
                                        checked={moduleStates[mod]}
                                        onChange={() => toggleModule(mod)}
                                    />
                                    <span className="cm-toggle-slider" />
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
