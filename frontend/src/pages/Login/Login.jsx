import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const PWD_RULE = /^(?=.{8,})(?=.*[A-Z])(?=.*[^A-Za-z0-9])/;

function Login() {
    const { t, i18n } = useTranslation();
    const { loginStart, loginVerify, signup, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('signin');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [signInStep, setSignInStep] = useState('credentials');
    const [signInData, setSignInData] = useState({ email: '', password: '', remember: false });
    const [loginChallengeId, setLoginChallengeId] = useState('');
    const [totpRequired, setTotpRequired] = useState(false);
    const [debugOtp, setDebugOtp] = useState('');
    const [otp, setOtp] = useState('');
    const [totpCode, setTotpCode] = useState('');

    const [signUpData, setSignUpData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        password: '',
        confirmPassword: '',
        agreeTerms: false,
    });
    const [signUpDone, setSignUpDone] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState('');

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const checkPasswordStrength = (password) => {
        if (password.length < 8) return 'weak';
        if (PWD_RULE.test(password)) return 'strong';
        return 'medium';
    };

    const handleSignInCredentials = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await loginStart(signInData.email, signInData.password, signInData.remember);
            if (result.completed) {
                navigate('/');
                return;
            }
            const res = result.payload;
            setLoginChallengeId(res.loginChallengeId);
            setTotpRequired(!!res.totpRequired);
            setDebugOtp(res.debugOtp || '');
            setSignInStep('otp');
        } catch (err) {
            setError(err?.message || t('login.invalidEmailOrPassword'));
        } finally {
            setLoading(false);
        }
    };

    const handleSignInOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await loginVerify(loginChallengeId, otp, totpRequired ? totpCode : undefined);
            navigate('/');
        } catch (err) {
            setError(err?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        if (!PWD_RULE.test(signUpData.password)) {
            setError('Password must be at least 8 characters with one uppercase and one special character.');
            return;
        }
        if (signUpData.password !== signUpData.confirmPassword) {
            setError(t('login.passwordsDoNotMatch'));
            return;
        }
        if (!signUpData.agreeTerms) {
            setError(t('login.agreeTermsRequired'));
            return;
        }
        setLoading(true);
        try {
            await signup(signUpData);
            setSignUpDone(true);
            setActiveTab('signin');
            setSignInData((s) => ({ ...s, email: signUpData.email }));
        } catch (err) {
            setError(err?.message || t('login.createAccountFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = (password) => {
        setSignUpData({ ...signUpData, password });
        setPasswordStrength(checkPasswordStrength(password));
    };

    const langIsEn = i18n.language?.startsWith('en');
    const langIsAr = i18n.language?.startsWith('ar');

    return (
        <div className="login-container">
            <div className="login-branding">
                <div className="branding-content">
                    <h1>{t('login.title')}</h1>
                    <p>{t('login.subtitle')}</p>
                    <div className="features">
                        <div className="feature">
                            <i className="fas fa-chart-line"></i>
                            <span>{t('login.featureRealtime')}</span>
                        </div>
                        <div className="feature">
                            <i className="fas fa-file-alt"></i>
                            <span>{t('login.featureReporting')}</span>
                        </div>
                        <div className="feature">
                            <i className="fas fa-leaf"></i>
                            <span>{t('login.featurePathways')}</span>
                        </div>
                        <div className="feature">
                            <i className="fas fa-shield-alt"></i>
                            <span>{t('login.featureCompliance')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="login-form-container">
                <div className="form-wrapper">
                    <div className="login-lang-switch" role="navigation" aria-label={t('login.languageSwitcher')}>
                        <span className="login-lang-label">{t('common.language')}</span>
                        <div className="login-lang-buttons">
                            <button
                                type="button"
                                className={`login-lang-btn ${langIsEn ? 'active' : ''}`}
                                onClick={() => void i18n.changeLanguage('en')}
                                aria-pressed={langIsEn}
                            >
                                {t('common.english')}
                            </button>
                            <button
                                type="button"
                                className={`login-lang-btn ${langIsAr ? 'active' : ''}`}
                                onClick={() => void i18n.changeLanguage('ar')}
                                aria-pressed={langIsAr}
                            >
                                {t('common.arabic')}
                            </button>
                        </div>
                    </div>

                    <div className="auth-tabs">
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('signin');
                                setError('');
                                setSignInStep('credentials');
                            }}
                        >
                            {t('login.signInTab')}
                        </button>
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('signup');
                                setError('');
                            }}
                        >
                            {t('login.signUpTab')}
                        </button>
                    </div>

                    {signUpDone && activeTab === 'signin' && (
                        <div className="error-alert" style={{ borderColor: '#10b981', background: '#ecfdf5', color: '#065f46' }}>
                            <i className="fas fa-check-circle"></i>
                            <span>Account created. Sign in with your email and password.</span>
                        </div>
                    )}

                    {error && (
                        <div className="error-alert">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>{error}</span>
                        </div>
                    )}

                    {activeTab === 'signin' && signInStep === 'credentials' && (
                        <form className="auth-form active" onSubmit={handleSignInCredentials}>
                            <h2>{t('login.welcomeBack')}</h2>
                            <p className="form-subtitle">
                                Corporate email + password. In development, OTP is skipped unless SKIP_LOGIN_OTP=false on the API.
                            </p>

                            <div className="form-group">
                                <label>Corporate email</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-envelope"></i>
                                    </span>
                                    <input
                                        type="email"
                                        name="email"
                                        autoComplete="username"
                                        placeholder={t('login.emailPlaceholder')}
                                        value={signInData.email}
                                        onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('login.password')}</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-lock"></i>
                                    </span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        autoComplete="current-password"
                                        placeholder={t('login.passwordPlaceholder')}
                                        value={signInData.password}
                                        onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
                                    </button>
                                </div>
                            </div>

                            <div className="form-options">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={signInData.remember}
                                        onChange={(e) => setSignInData({ ...signInData, remember: e.target.checked })}
                                    />
                                    <span className="checkmark"></span>
                                    {t('login.rememberMe')} <span style={{ fontSize: '0.78rem', color: '#64748b' }}>(extends session to 30 days)</span>
                                </label>
                            </div>

                            <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                                <span>Continue</span>
                                <i className="fas fa-arrow-right"></i>
                            </button>
                        </form>
                    )}

                    {activeTab === 'signin' && signInStep === 'otp' && (
                        <form className="auth-form active" onSubmit={handleSignInOtp}>
                            <h2>Verify your email</h2>
                            <p className="form-subtitle">
                                Enter the one-time code below. While email delivery is not configured, the same code
                                appears on this page after you continue from your password.
                            </p>
                            {debugOtp && (
                                <div className="error-alert" style={{ borderColor: '#fbbf24', background: '#fffbeb', color: '#92400e' }}>
                                    <span>
                                        Sign-in code: <strong>{debugOtp}</strong>
                                    </span>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Email code</label>
                                <div className="input-wrapper">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="6-digit code"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            {totpRequired && (
                                <div className="form-group">
                                    <label>Authenticator app code</label>
                                    <div className="input-wrapper">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="6-digit TOTP"
                                            value={totpCode}
                                            onChange={(e) => setTotpCode(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                            <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                                <span>{t('login.signInButton')}</span>
                                <i className="fas fa-arrow-right"></i>
                            </button>
                            <button
                                type="button"
                                className="btn-social"
                                style={{ marginTop: 12, border: '1px solid #e2e8f0', background: '#fff' }}
                                onClick={() => {
                                    setSignInStep('credentials');
                                    setOtp('');
                                    setTotpCode('');
                                    setDebugOtp('');
                                }}
                            >
                                Back to credentials
                            </button>
                        </form>
                    )}

                    {activeTab === 'signup' && (
                        <form className="auth-form active" onSubmit={handleSignUp}>
                            <h2>{t('login.createAccount')}</h2>
                            <p className="form-subtitle">{t('login.signUpSubtitle')}</p>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('login.firstName')}</label>
                                    <div className="input-wrapper">
                                        <span className="input-icon" aria-hidden="true">
                                            <i className="fas fa-user"></i>
                                        </span>
                                        <input
                                            type="text"
                                            placeholder={t('login.firstNamePlaceholder')}
                                            value={signUpData.firstName}
                                            onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('login.lastName')}</label>
                                    <div className="input-wrapper">
                                        <span className="input-icon" aria-hidden="true">
                                            <i className="fas fa-user"></i>
                                        </span>
                                        <input
                                            type="text"
                                            placeholder={t('login.lastNamePlaceholder')}
                                            value={signUpData.lastName}
                                            onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Corporate email</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-envelope"></i>
                                    </span>
                                    <input
                                        type="email"
                                        placeholder={t('login.emailPlaceholder')}
                                        value={signUpData.email}
                                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('login.companyName')}</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-building"></i>
                                    </span>
                                    <input
                                        type="text"
                                        placeholder={t('login.companyPlaceholder')}
                                        value={signUpData.company}
                                        onChange={(e) => setSignUpData({ ...signUpData, company: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('login.password')}</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-lock"></i>
                                    </span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={t('login.createPasswordPlaceholder')}
                                        value={signUpData.password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
                                    </button>
                                </div>
                                {signUpData.password && (
                                    <div className="password-strength">
                                        <div className={`strength-bar ${passwordStrength}`}></div>
                                        <span className="strength-text">
                                            {passwordStrength === 'weak'
                                                ? t('login.strengthWeak')
                                                : passwordStrength === 'strong'
                                                  ? t('login.strengthStrong')
                                                  : t('login.strengthMedium')}
                                        </span>
                                    </div>
                                )}
                                <p className="help-text">Min 8 characters, 1 uppercase, 1 special character.</p>
                            </div>

                            <div className="form-group">
                                <label>{t('login.confirmPassword')}</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-lock"></i>
                                    </span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={t('login.confirmPasswordPlaceholder')}
                                        value={signUpData.confirmPassword}
                                        onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <label className="checkbox-label terms">
                                <input
                                    type="checkbox"
                                    checked={signUpData.agreeTerms}
                                    onChange={(e) => setSignUpData({ ...signUpData, agreeTerms: e.target.checked })}
                                />
                                <span className="checkmark"></span>
                                {t('login.termsText')} <a href="#">{t('login.termsOfService')}</a> {t('login.and')}{' '}
                                <a href="#">{t('login.privacyPolicy')}</a>
                            </label>

                            <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                                <span>{t('login.createAccountButton')}</span>
                                <i className="fas fa-arrow-right"></i>
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Login;
