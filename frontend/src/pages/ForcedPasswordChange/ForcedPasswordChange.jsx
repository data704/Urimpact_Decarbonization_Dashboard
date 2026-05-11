import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { changePasswordApi } from '../../api/client.js';
import './ForcedPasswordChange.css';

export default function ForcedPasswordChange() {
    const { user, refreshSession } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.passwordMustChange) {
        return <Navigate to="/" replace />;
    }

    const pwdOk = () =>
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!pwdOk()) {
            setError('Use at least 8 characters with one uppercase letter and one special character.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await changePasswordApi({ newPassword: password });
            await refreshSession();
            navigate('/', { replace: true });
        } catch (err) {
            setError(err?.message || 'Could not update password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forced-pw-page">
            <div className="forced-pw-card">
                <h1>Set a new password</h1>
                <p>Your administrator requires you to choose a new password before continuing.</p>
                <form onSubmit={handleSubmit}>
                    {error && <div className="forced-pw-error">{error}</div>}
                    <label>New password</label>
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <label>Confirm password</label>
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={loading} className="forced-pw-submit">
                        {loading ? 'Saving…' : 'Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
