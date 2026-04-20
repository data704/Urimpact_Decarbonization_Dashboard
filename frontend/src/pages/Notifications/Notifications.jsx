import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecentActivity, getAuthToken } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './Notifications.css';

function Notifications() {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const isAdminUser = user?.role === 'ADMINISTRATOR' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
    const hasToken = Boolean(getAuthToken());
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

    const formatAction = (action = '') => {
        const a = action || '';
        if (a.includes('DOCUMENT_UPLOAD')) return t('notifications.actionUploadDoc');
        if (a.includes('DOCUMENT_PROCESSED')) return t('notifications.actionProcessDoc');
        if (a.includes('EMISSION_CREATED') || a.includes('EMISSION_CALCULATED')) return t('notifications.actionEmission');
        if (a.includes('EMISSION_DELETED')) return t('notifications.actionDeleteEmission');
        if (a.includes('REPORT_GENERATED')) return t('notifications.actionReport');
        if (a.includes('USER_LOGIN')) return t('notifications.actionLogin');
        if (a.includes('USER_CREATED')) return t('notifications.actionUserCreated');
        if (a.includes('USER_ROLE')) return t('notifications.actionRoleChanged');
        if (a.includes('USER_ACTIVATED')) return t('notifications.actionActivated');
        if (a.includes('USER_DEACTIVATED')) return t('notifications.actionDeactivated');
        return a.replace(/_/g, ' ').toLowerCase();
    };

    useEffect(() => {
        if (!hasToken || !isAdminUser) {
            setLogs([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        getRecentActivity(50)
            .then((items) => {
                if (!cancelled) {
                    setLogs(Array.isArray(items) ? items : []);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err?.message || t('notifications.failedLoad'));
                    setLogs([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [hasToken, isAdminUser, t]);

    return (
        <div className="notifications-page">
            <div className="page-header">
                <div>
                    <h1>{t('notifications.title')}</h1>
                    <p>{t('notifications.subtitle')}</p>
                </div>
            </div>

            {!isAdminUser && (
                <div className="card dashboard-activity-feed" aria-label={t('notifications.title')}>
                    <div style={{ padding: '1.5rem', fontSize: '0.9rem', color: '#64748B' }}>
                        {t('notifications.adminOnly')}
                    </div>
                </div>
            )}

            {isAdminUser && (
            <div className="card dashboard-activity-feed" aria-label={t('notifications.title')}>
                {loading && <div style={{ padding: '1.5rem' }}>{t('notifications.loading')}</div>}
                {error && !loading && (
                    <div className="dashboard-error dashboard-activity-error" style={{ marginBottom: '0' }}>
                        {error}
                    </div>
                )}
                {!loading && !error && logs.length === 0 && (
                    <div style={{ padding: '1.5rem', fontSize: '0.9rem', color: '#64748B' }}>
                        {t('notifications.empty')}
                    </div>
                )}

                {logs.length > 0 && (
                    <>
                        <div className="dashboard-activity-header">
                            <h3>
                                <i className="fas fa-bell"></i> {t('notifications.activityLog')}
                            </h3>
                            <span className="dashboard-activity-sub">
                                {t('notifications.latestEvents', { count: logs.length })}
                            </span>
                        </div>
                        <ul className="dashboard-activity-list notifications-list">
                            {logs.map((log) => {
                                const who = log.user
                                    ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                                    : t('header.system');
                                const when = log.timestamp ? new Date(log.timestamp).toLocaleString(dateLocale) : '';
                                const actionLabel = formatAction(log.action);
                                return (
                                    <li key={log.id} className="dashboard-activity-item">
                                        <span className="dashboard-activity-who">{who}</span>
                                        <span className="dashboard-activity-action">{actionLabel}</span>
                                        {log.resource && (
                                            <span className="dashboard-activity-meta">{log.resource}</span>
                                        )}
                                        <span className="dashboard-activity-when">{when}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
            )}
        </div>
    );
}

export default Notifications;
