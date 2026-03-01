import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

function Login() {
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
            setError(err?.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        
        if (signUpData.password !== signUpData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        if (!signUpData.agreeTerms) {
            setError('Please agree to the terms and conditions');
            return;
        }
        
        setLoading(true);
        
        try {
            await signup(signUpData);
            navigate('/');
        } catch (err) {
            setError(err?.message || 'Failed to create account');
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
                    <h1>Carbon Emission Dashboard</h1>
                    <p>
                        Track, analyze, and reduce your organization's carbon footprint 
                        with our comprehensive emission management platform.
                    </p>
                    <div className="features">
                        <div className="feature">
                            <i className="fas fa-chart-line"></i>
                            <span>Real-time emission tracking</span>
                        </div>
                        <div className="feature">
                            <i className="fas fa-file-alt"></i>
                            <span>Automated reporting</span>
                        </div>
                        <div className="feature">
                            <i className="fas fa-leaf"></i>
                            <span>Decarbonization pathways</span>
                        </div>
                        <div className="feature">
                            <i className="fas fa-shield-alt"></i>
                            <span>Compliance management</span>
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
                            Sign In
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('signup'); setError(''); }}
                        >
                            Sign Up
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
                        <h2>Welcome Back</h2>
                        <p className="form-subtitle">Sign in to continue to your dashboard</p>

                        <div className="form-group">
                            <label>Email Address</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-envelope"></i>
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    placeholder="name@company.com"
                                    value={signInData.email}
                                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-lock"></i>
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    autoComplete="off"
                                    placeholder="Enter your password"
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
                                Remember me
                            </label>
                            <a href="#" className="forgot-link">Forgot password?</a>
                        </div>

                        <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                            <span>Sign In</span>
                            <i className="fas fa-arrow-right"></i>
                        </button>

                        <div className="divider">
                            <span>or continue with</span>
                        </div>

                        <div className="social-login">
                            <button type="button" className="btn-social google">
                                <i className="fab fa-google"></i>
                                Google
                            </button>
                            <button type="button" className="btn-social microsoft">
                                <i className="fab fa-microsoft"></i>
                                Microsoft
                            </button>
                        </div>
                    </form>

                    {/* Sign Up Form */}
                    <form 
                        className={`auth-form ${activeTab === 'signup' ? 'active' : ''}`}
                        onSubmit={handleSignUp}
                    >
                        <h2>Create Account</h2>
                        <p className="form-subtitle">Start your journey to net zero</p>

                        <div className="form-row">
                            <div className="form-group">
                                <label>First Name</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-user"></i>
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="John"
                                        value={signUpData.firstName}
                                        onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <div className="input-wrapper">
                                    <span className="input-icon" aria-hidden="true">
                                        <i className="fas fa-user"></i>
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Doe"
                                        value={signUpData.lastName}
                                        onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Work Email</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-envelope"></i>
                                </span>
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={signUpData.email}
                                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Company Name</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-building"></i>
                                </span>
                                <input
                                    type="text"
                                    placeholder="Your Company"
                                    value={signUpData.company}
                                    onChange={(e) => setSignUpData({ ...signUpData, company: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-lock"></i>
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Create a password"
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
                                    <span className="strength-text">{passwordStrength}</span>
                                </div>
                            )}
                            <p className="help-text">Min 8 characters, with uppercase, lowercase and a number</p>
                        </div>

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <div className="input-wrapper">
                                <span className="input-icon" aria-hidden="true">
                                    <i className="fas fa-lock"></i>
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Confirm your password"
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
                            I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
                        </label>

                        <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading}>
                            <span>Create Account</span>
                            <i className="fas fa-arrow-right"></i>
                        </button>

                        <div className="divider">
                            <span>or continue with</span>
                        </div>

                        <div className="social-login">
                            <button type="button" className="btn-social google">
                                <i className="fab fa-google"></i>
                                Google
                            </button>
                            <button type="button" className="btn-social microsoft">
                                <i className="fab fa-microsoft"></i>
                                Microsoft
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;
