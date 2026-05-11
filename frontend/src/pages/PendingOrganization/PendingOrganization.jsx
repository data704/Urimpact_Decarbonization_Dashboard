import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './PendingOrganization.css';

export default function PendingOrganization() {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const langIsEn = i18n.language?.startsWith('en');
    const langIsAr = i18n.language?.startsWith('ar');

    const handleSignOut = () => {
        logout();
        navigate('/login', { replace: true });
    };

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.organizationOnboardingComplete) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="pending-setup-page">
            <div className="pending-setup-lang" role="navigation" aria-label={t('login.languageSwitcher')}>
                <span className="pending-setup-lang-label">{t('common.language')}</span>
                <div className="pending-setup-lang-buttons">
                    <button
                        type="button"
                        className={`pending-setup-lang-btn ${langIsEn ? 'active' : ''}`}
                        onClick={() => void i18n.changeLanguage('en')}
                        aria-pressed={langIsEn}
                    >
                        {t('common.english')}
                    </button>
                    <button
                        type="button"
                        className={`pending-setup-lang-btn ${langIsAr ? 'active' : ''}`}
                        onClick={() => void i18n.changeLanguage('ar')}
                        aria-pressed={langIsAr}
                    >
                        {t('common.arabic')}
                    </button>
                </div>
            </div>

            <div className="pending-setup-card">
                <h1>{t('pendingSetup.title')}</h1>
                <p className="pending-setup-desc">{t('pendingSetup.description')}</p>
                <p className="pending-setup-hint">{t('pendingSetup.signOutHint')}</p>
                <button type="button" className="pending-setup-signout" onClick={handleSignOut}>
                    {t('pendingSetup.signOutButton')}
                </button>
            </div>
        </div>
    );
}
