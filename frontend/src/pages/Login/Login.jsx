import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

function Login() {
    const { t } = useTranslation();
    const { login, signup, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('signin');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Sign in form
    const [signInData, setSignInData] = useState({ email: '', password: '', remember: false });
    
    // Sign up form
    const [signUpData, setSignUpData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        password: '',
        confirmPassword: '',
        agreeTerms: false
    });
    
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState('');

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const checkPasswordStrength = (password) => {
        if (password.length < 6) return 'weak';
        if (password.length < 10) return 'medium';
        if (/[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
            return 'strong';
        }
        return 'medium';
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            await login(signInData.email, signInData.password);
            navigate('/');
        } catch (err) {
            setError(err?.message || t('login.invalidEmailOrPassword'));
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        
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
            navigate('/');
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

    return (
        <div className="login-container">
            {/* Left Side - Branding */}
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

            {/* Right Side - Form */}
            <div className="login-form-container">
                <div className="form-wrapper">
                    {/* Tab Switcher */}
                    <div className="auth-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('signin'); setError(''); }}
                        >
                            {t('login.signInTab')}
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('signup'); setError(''); }}
                        >
                            {t('login.signUpTab')}
                        </button>
                    </div>

                    {error && (
                        <div className="error-alert">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Sign In Form */}
                    <form 
                        className={`auth-form ${activeTab === 'signin' ? 'active' : ''}`}
                        onSubmit={handleSignIn}
                    >
                        <h2>{t('login.welcomeBack')}</h2>
                        <p className="form-subtitle">{t('login.signInSubtitle')}</p>

                        <div className="form-group">
                            <label>{t('login.emailAddress')}</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-envelope"></i>
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="off"
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
                                    autoComplete="off"
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
                                {t('login.rememberMe')}
                            </label>
                            <a href="#" className="forgot-link">{t('login.forgotPassword')}</a>
                        </div>

                        <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                            <span>{t('login.signInButton')}</span>
                            <i className="fas fa-arrow-right"></i>
                        </button>

                        <div className="divider">
                            <span>{t('login.orContinueWith')}</span>
                        </div>

                        <div className="social-login">
                            <button type="button" className="btn-social google">
                                <i className="fab fa-google"></i>
                                {t('login.google')}
                            </button>
                            <button type="button" className="btn-social microsoft">
                                <i className="fab fa-microsoft"></i>
                                {t('login.microsoft')}
                            </button>
                        </div>
                    </form>

                    {/* Sign Up Form */}
                    <form 
                        className={`auth-form ${activeTab === 'signup' ? 'active' : ''}`}
                        onSubmit={handleSignUp}
                    >
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
                            <label>{t('login.workEmail')}</label>
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
                            <p className="help-text">{t('login.passwordHelp')}</p>
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
                            {t('login.termsText')} <a href="#">{t('login.termsOfService')}</a> {t('login.and')} <a href="#">{t('login.privacyPolicy')}</a>
                        </label>

                        <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                            <span>{t('login.createAccountButton')}</span>
                            <i className="fas fa-arrow-right"></i>
                        </button>

                        <div className="divider">
                            <span>{t('login.orContinueWith')}</span>
                        </div>

                        <div className="social-login">
                            <button type="button" className="btn-social google">
                                <i className="fab fa-google"></i>
                                {t('login.google')}
                            </button>
                            <button type="button" className="btn-social microsoft">
                                <i className="fab fa-microsoft"></i>
                                {t('login.microsoft')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;
