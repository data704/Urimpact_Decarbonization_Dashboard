import { useEffect, useState } from 'react';
import { getRecentActivity, getAuthToken } from '../../api/client';
import './Notifications.css';

function formatAction(action = '') {
    const a = action || '';
    if (a.includes('DOCUMENT_UPLOAD')) return 'uploaded a document';
    if (a.includes('DOCUMENT_PROCESSED')) return 'processed a document';
    if (a.includes('EMISSION_CREATED') || a.includes('EMISSION_CALCULATED')) return 'recorded an emission';
    if (a.includes('EMISSION_DELETED')) return 'deleted an emission';
    if (a.includes('REPORT_GENERATED')) return 'generated a report';
    if (a.includes('USER_LOGIN')) return 'signed in';
    if (a.includes('USER_CREATED')) return 'created a user';
    if (a.includes('USER_ROLE')) return 'changed a user role';
    if (a.includes('USER_ACTIVATED')) return 'activated a user';
    if (a.includes('USER_DEACTIVATED')) return 'deactivated a user';
    return a.replace(/_/g, ' ').toLowerCase();
}

function Notifications() {
    const hasToken = Boolean(getAuthToken());
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!hasToken) {
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
                    setError(err?.message || 'Failed to load notifications');
                    setLogs([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [hasToken]);

    return (
        <div className="notifications-page">
            <div className="page-header">
                <div>
                    <h1>Recent activity</h1>
                    <p>Changes across the platform with user attribution</p>
                </div>
            </div>

            <div className="card dashboard-activity-feed" aria-label="Recent activity list">
                {loading && <div style={{ padding: '1.5rem' }}>Loading activity…</div>}
                {error && !loading && (
                    <div className="dashboard-error dashboard-activity-error" style={{ marginBottom: '0' }}>
                        {error}
                    </div>
                )}
                {!loading && !error && logs.length === 0 && (
                    <div style={{ padding: '1.5rem', fontSize: '0.9rem', color: '#64748B' }}>
                        No recent activity yet. Actions taken across the dashboard will appear here.
                    </div>
                )}

                {logs.length > 0 && (
                    <>
                        <div className="dashboard-activity-header">
                            <h3>
                                <i className="fas fa-bell"></i> Activity log
                            </h3>
                            <span className="dashboard-activity-sub">
                                Latest {logs.length} events across your organisation
                            </span>
                        </div>
                        <ul className="dashboard-activity-list notifications-list">
                            {logs.map((log) => {
                                const who = log.user
                                    ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                                    : 'System';
                                const when = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';
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
        </div>
    );
}

export default Notifications;

