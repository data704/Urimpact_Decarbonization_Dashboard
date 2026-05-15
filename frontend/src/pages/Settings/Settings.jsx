import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOrganizationMe } from '../../api/client.js';
import { ISIC_SECTORS } from '../../data/isicRev4GHGSectors.js';
import './Settings.css';

const FALLBACK_PROFILE = [
    ['Company Name', 'Demo'],
    ['Industry', 'Manufacturing'],
    ['CR ID', 'CR-00000000'],
    ['Website', 'www.demo.com'],
    ['Reporting Framework', 'GHG Protocol + GRI Standards'],
    ['Base Year', '2026'],
    ['Primary Contact', 'Ahmad – CSO'],
];

const FACILITIES = [
    { name: 'Plant A', location: 'Mumbai', type: 'Manufacturing', emissions: '18,200 tCO\u2082e' },
    { name: 'Plant B', location: 'Pune', type: 'Manufacturing', emissions: '14,100 tCO\u2082e' },
    { name: 'Head Office', location: 'Mumbai', type: 'Commercial', emissions: '2,400 tCO\u2082e' },
    { name: 'Warehouse', location: 'Chennai', type: 'Logistics', emissions: '3,800 tCO\u2082e' },
];

/** Build the company profile rows from onboarding organization data */
function buildProfileFromOrg(org) {
    const draft = org?.onboardingDraft || {};

    const companyName = org?.companyName || draft.legalName || 'Demo';
    const crId = draft.commercialRegistrationNumber || 'CR-00000000';
    const website = companyName && companyName !== 'Demo'
        ? `www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
        : 'www.demo.com';

    // Resolve industry from ISIC sector code
    let industry = 'Manufacturing';
    if (draft.sectorIsicCode) {
        const sector = ISIC_SECTORS.find((s) => s.code === draft.sectorIsicCode);
        if (sector) industry = sector.label || sector.name || industry;
    }

    const contactName = draft.pocFullName || 'Ahmad';
    const contactDesignation = draft.pocDesignation || 'CSO';

    return [
        ['Company Name', companyName],
        ['Industry', industry],
        ['CR ID', crId],
        ['Website', website],
        ['Reporting Framework', 'GHG Protocol + GRI Standards'],
        ['Base Year', '2026'],
        ['Primary Contact', `${contactName} – ${contactDesignation}`],
    ];
}

function Settings() {
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const [notification, setNotification] = useState(null);
    const [profileData, setProfileData] = useState(FALLBACK_PROFILE);
    const [facilitiesData, setFacilitiesData] = useState(FACILITIES);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});

    // Fetch onboarding data from the backend and populate the profile
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchOrganizationMe();
                const org = data.organization || data;
                if (!cancelled) {
                    const profile = buildProfileFromOrg(org);
                    setProfileData(profile);

                    // Populate facilities from onboarding if available
                    const draft = org?.onboardingDraft || {};
                    if (Array.isArray(draft.facilities) && draft.facilities.length > 0) {
                        setFacilitiesData(
                            draft.facilities.map((f) => ({
                                name: f.name || 'Unnamed',
                                location: f.location || '—',
                                type: (f.facilityType || 'Other').replace(/_/g, ' '),
                                emissions: '—',
                            }))
                        );
                    }
                }
            } catch (_) {
                // If API fails, keep fallback data but still apply user.company if available
                if (!cancelled && user?.company) {
                    setProfileData((prev) =>
                        prev.map(([k, v]) => (k === 'Company Name' ? [k, user.company] : [k, v]))
                    );
                }
            }
        })();
        return () => { cancelled = true; };
    }, [user?.organizationId, user?.company]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const startEditing = () => {
        setEditForm(Object.fromEntries(profileData));
        setEditing(true);
    };

    const saveEditing = () => {
        setProfileData(Object.entries(editForm));
        setEditing(false);
        showNotification('Profile updated successfully');
    };

    const cancelEditing = () => {
        setEditing(false);
        setEditForm({});
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
                    {editing ? (
                        <>
                            {Object.entries(editForm).map(([key, val]) => (
                                <div key={key} className="cm-profile-row">
                                    <span className="cm-profile-key">{key}</span>
                                    <input
                                        className="cm-profile-input"
                                        value={val}
                                        onChange={(e) =>
                                            setEditForm((prev) => ({ ...prev, [key]: e.target.value }))
                                        }
                                    />
                                </div>
                            ))}
                            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    className="cm-btn cm-btn--primary cm-btn--sm"
                                    onClick={saveEditing}
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    className="cm-btn cm-btn--outline cm-btn--sm"
                                    onClick={cancelEditing}
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
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
                                onClick={startEditing}
                            >
                                Edit Profile
                            </button>
                        </>
                    )}
                </div>

                {/* Right column: Facilities + Modules */}
                <div>
                    {/* Facilities */}
                    <div className="cm-card" style={{ marginBottom: 14 }}>
                        <div className="cm-card-title">Facilities</div>
                        {facilitiesData.map((f) => (
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
                        {['GHG Reporting', 'ESG Management', 'Gap Analysis', 'Decarbonisation', 'Supply Chain Management', 'Business Sustainability'].map((mod) => (
                            <div key={mod} className="cm-module-row">
                                <div className="cm-module-name">{mod}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
