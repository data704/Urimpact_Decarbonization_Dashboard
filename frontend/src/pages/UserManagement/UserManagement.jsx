import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './UserManagement.css';

const ROLE_OPTIONS = [
    { value: 'ADMINISTRATOR', labelKey: 'roleAdmin' },
    { value: 'DATA_CONTRIBUTOR', labelKey: 'roleDataEntry' },
    { value: 'ANALYST', labelKey: 'roleAnalyst' },
    { value: 'VIEWER', labelKey: 'roleViewer' },
    { value: 'SUPER_ADMIN', labelKey: 'roleSuperAdmin' },
];

const PLAN_DISPLAY = {
    ENTERPRISE: {
        planKey: 'planEnterprise',
        billingKey: 'billingAnnual',
        amountValueKey: 'amountEnterpriseValue',
        supportKey: 'supportDedicated',
        descKey: 'planDescEnterprise',
    },
    PREMIUM: {
        planKey: 'planPremium',
        billingKey: 'billingAnnual',
        amountValueKey: 'amountPremiumValue',
        supportKey: 'supportPriority',
        descKey: 'planDescPremium',
    },
    STANDARD: {
        planKey: 'planStandard',
        billingKey: 'billingMonthly',
        amountValueKey: 'amountStandardValue',
        supportKey: 'supportEmail',
        descKey: 'planDescStandard',
    },
    FREE: {
        planKey: 'planFree',
        billingKey: 'billingNone',
        amountValueKey: 'amountFreeValue',
        supportKey: 'supportCommunity',
        descKey: 'planDescFree',
    },
};

function formatLastActive(isoDate, t) {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '—';
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('userManagement.lastActiveJustNow');
    if (mins < 60) return t('userManagement.lastActiveMins', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('userManagement.lastActiveHours', { count: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return t('userManagement.lastActiveYesterday');
    if (days < 7) return t('userManagement.lastActiveDays', { count: days });
    return d.toLocaleDateString();
}

function rolePillClass(role) {
    const r = String(role || '').toUpperCase();
    if (r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN' || r === 'ADMIN') return 'rs-pill rs-pill--dark';
    if (r === 'ANALYST') return 'rs-pill rs-pill--teal';
    if (r === 'DATA_CONTRIBUTOR' || r === 'USER') return 'rs-pill rs-pill--blue';
    return 'rs-pill rs-pill--gray';
}

function moduleAccessForRole(role, t) {
    const r = String(role || '').toUpperCase();
    if (r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN' || r === 'ADMIN') return t('userManagement.moduleAll');
    if (r === 'ANALYST') return t('userManagement.moduleGhgEsg');
    if (r === 'DATA_CONTRIBUTOR' || r === 'USER') return t('userManagement.moduleGhgOnly');
    return t('userManagement.moduleDashboard');
}

function UserManagement() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [notification, setNotification] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [organizationLimit, setOrganizationLimit] = useState(null);
    const [editUserId, setEditUserId] = useState(null);
    const [rolesUserId, setRolesUserId] = useState(null);
    const [rolesDraft, setRolesDraft] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [roleSubmitting, setRoleSubmitting] = useState(false);

    const [createForm, setCreateForm] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        company: '',
        role: 'DATA_CONTRIBUTOR',
    });
    const [createSubmitting, setCreateSubmitting] = useState(false);

    const roleLabel = useCallback(
        (role) => {
            const opt = ROLE_OPTIONS.find((o) => o.value === role);
            if (opt) return t(`userManagement.${opt.labelKey}`);
            const r = String(role || '').toUpperCase();
            if (r === 'USER') return t('userManagement.roleDataEntry');
            return role;
        },
        [t]
    );

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAdminUsers({ limit: '100' });
            setUsers(Array.isArray(result.data) ? result.data : []);
            setOrganizationLimit(result.organizationLimit ?? null);
        } catch (e) {
            setError(e?.message || t('userManagement.loadFailed'));
            setUsers([]);
            setOrganizationLimit(null);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateSubmitting(true);
        try {
            await createAdminUser({
                email: createForm.email.trim(),
                password: createForm.password,
                firstName: createForm.firstName.trim(),
                lastName: createForm.lastName.trim(),
                company: createForm.company.trim() || undefined,
                role: createForm.role,
            });
            showNotification(t('userManagement.createdSuccess'));
            setInviteOpen(false);
            setCreateForm({
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                company: '',
                role: 'DATA_CONTRIBUTOR',
            });
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || t('userManagement.createFailed'), 'error');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const handleToggleActive = async (u, nextActive) => {
        try {
            await updateAdminUser(u.id, { isActive: nextActive });
            showNotification(nextActive ? t('userManagement.activated') : t('userManagement.deactivated'));
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || t('userManagement.updateFailed'), 'error');
        }
    };

    const handleRoleChange = async (u) => {
        if (!rolesDraft || rolesDraft === u.role) {
            setRolesUserId(null);
            return;
        }
        setRoleSubmitting(true);
        try {
            await updateAdminUser(u.id, { role: rolesDraft });
            showNotification(t('userManagement.roleUpdated'));
            setRolesUserId(null);
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || t('userManagement.updateFailed'), 'error');
        } finally {
            setRoleSubmitting(false);
        }
    };

    const handleDeleteUser = async (u) => {
        if (!u?.id) return;
        try {
            await deleteAdminUser(u.id);
            showNotification(t('userManagement.deletedSuccess'));
            setDeleteConfirmId(null);
            setEditUserId(null);
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || t('userManagement.deleteFailed'), 'error');
        }
    };

    const filteredUsers = users.filter((u) => {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesSearch = name.includes(q) || email.includes(q);
        const matchesRole = roleFilter === 'All' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const canAssignSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const atUserLimit =
        organizationLimit != null && organizationLimit.userCount >= organizationLimit.maxUsers;

    const editUser = editUserId ? users.find((x) => x.id === editUserId) : null;
    const rolesUser = rolesUserId ? users.find((x) => x.id === rolesUserId) : null;

    const subscriptionMeta = useMemo(() => {
        const planCode = String(currentUser?.subscriptionPlan || 'STANDARD').toUpperCase();
        const display = PLAN_DISPLAY[planCode] || PLAN_DISPLAY.STANDARD;
        const max = organizationLimit?.maxUsers ?? 3;
        const active = organizationLimit?.userCount ?? users.filter((u) => u.isActive).length;
        const renewal = new Date();
        renewal.setMonth(renewal.getMonth() + 3);
        renewal.setDate(31);
        return {
            display,
            usersLine: t('userManagement.usersAllowed', { max, active }),
            renewal: renewal.toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            }),
        };
    }, [currentUser?.subscriptionPlan, organizationLimit, users, t]);

    const subscriptionRows = useMemo(
        () => [
            [t('userManagement.subPlan'), t(`userManagement.${subscriptionMeta.display.planKey}`)],
            [t('userManagement.subBilling'), t(`userManagement.${subscriptionMeta.display.billingKey}`)],
            [t('userManagement.subRenewal'), subscriptionMeta.renewal],
            [t('userManagement.subUsers'), subscriptionMeta.usersLine],
            [
                t('userManagement.subAmount'),
                `${t(`userManagement.${subscriptionMeta.display.amountValueKey}`)} ${t('userManagement.amountPeriod')}`,
            ],
            [t('userManagement.subSupport'), t(`userManagement.${subscriptionMeta.display.supportKey}`)],
        ],
        [subscriptionMeta, t]
    );

    const openRolesModal = (u) => {
        setRolesDraft(u.role);
        setRolesUserId(u.id);
    };

    return (
        <div className="rs-page">
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <span>{notification.message}</span>
                </div>
            )}

            <div className="rs-header">
                <div>
                    <h1 className="rs-title">{t('userManagement.pageTitle')}</h1>
                    <p className="rs-subtitle">{t('userManagement.pageSubtitle')}</p>
                    {organizationLimit != null && (
                        <p className="rs-limit-hint">
                            {t('userManagement.orgLimit', {
                                current: organizationLimit.userCount,
                                max: organizationLimit.maxUsers,
                            })}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    className="rs-btn rs-btn--primary"
                    onClick={() => setInviteOpen(true)}
                    disabled={atUserLimit}
                    title={
                        atUserLimit
                            ? t('userManagement.atLimitTitle', { max: organizationLimit?.maxUsers ?? 3 })
                            : undefined
                    }
                >
                    {t('userManagement.inviteUser')}
                </button>
            </div>

            {error && (
                <div className="notification error rs-inline-error">
                    <span>{error}</span>
                </div>
            )}

            <div className="rs-table-card">
                <div className="rs-table-header">
                    <div className="rs-table-title">{t('userManagement.usersRolesTitle')}</div>
                    <div className="rs-table-filters">
                        <div className="rs-search">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                placeholder={t('userManagement.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select className="rs-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="All">{t('userManagement.filterAllRoles')}</option>
                            <option value="ADMINISTRATOR">{t('userManagement.roleAdmin')}</option>
                            <option value="ANALYST">{t('userManagement.roleAnalyst')}</option>
                            <option value="DATA_CONTRIBUTOR">{t('userManagement.roleDataEntry')}</option>
                            <option value="VIEWER">{t('userManagement.roleViewer')}</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="rs-table-loading">{t('userManagement.loading')}</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="rs-table-empty">{t('userManagement.noUsers')}</div>
                ) : (
                    <table className="rs-table">
                        <thead>
                            <tr>
                                <th>{t('userManagement.colUser')}</th>
                                <th>{t('userManagement.colRole')}</th>
                                <th>{t('userManagement.colModuleAccess')}</th>
                                <th>{t('userManagement.colLastActive')}</th>
                                <th>{t('userManagement.colStatus')}</th>
                                <th>{t('userManagement.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => {
                                const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                                const initials = name
                                    .split(' ')
                                    .map((w) => w[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();
                                const isSelf = currentUser?.id === u.id;
                                const canEdit =
                                    !isSelf && !(u.role === 'SUPER_ADMIN' && !canAssignSuperAdmin);

                                return (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="rs-user-cell">
                                                <div className="rs-user-avatar">{initials}</div>
                                                <div>
                                                    <div className="rs-user-name">{name}</div>
                                                    <div className="rs-user-email">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={rolePillClass(u.role)}>{roleLabel(u.role)}</span>
                                        </td>
                                        <td className="rs-module-access">{moduleAccessForRole(u.role, t)}</td>
                                        <td className="rs-last-active">{formatLastActive(u.lastLoginAt, t)}</td>
                                        <td>
                                            <span
                                                className={`rs-badge ${u.isActive ? 'rs-badge--green' : 'rs-badge--gray'}`}
                                            >
                                                {u.isActive
                                                    ? t('userManagement.statusActive')
                                                    : t('userManagement.statusInactive')}
                                            </span>
                                        </td>
                                        <td>
                                            {canEdit ? (
                                                <div className="rs-actions">
                                                    <button
                                                        type="button"
                                                        className="rs-btn rs-btn--outline rs-btn--sm"
                                                        onClick={() => setEditUserId(u.id)}
                                                    >
                                                        {t('userManagement.edit')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rs-btn rs-btn--outline rs-btn--sm"
                                                        onClick={() => openRolesModal(u)}
                                                    >
                                                        {t('userManagement.roles')}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="rs-last-active">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="rs-card">
                <div className="rs-card-title">{t('userManagement.subscriptionTitle')}</div>
                <div className="rs-sub-grid">
                    <div>
                        {subscriptionRows.map(([key, val]) => (
                            <div key={key} className="rs-sub-row">
                                <span className="rs-sub-key">{key}</span>
                                <span className="rs-sub-val">{val}</span>
                            </div>
                        ))}
                    </div>
                    <div className="rs-sub-highlight">
                        <div className="rs-sub-plan-name">
                            {t(`userManagement.${subscriptionMeta.display.planKey}`)}
                        </div>
                        <div className="rs-sub-price">
                            {t(`userManagement.${subscriptionMeta.display.amountValueKey}`)}
                            <span>{t('userManagement.amountPeriod')}</span>
                        </div>
                        <p className="rs-sub-desc">{t(`userManagement.${subscriptionMeta.display.descKey}`)}</p>
                        <button type="button" className="rs-btn rs-btn--primary rs-sub-manage">
                            {t('userManagement.manageSubscription')}
                        </button>
                    </div>
                </div>
            </div>

            {inviteOpen && (
                <div className="rs-modal-overlay" onClick={() => !createSubmitting && setInviteOpen(false)}>
                    <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('userManagement.inviteModalTitle')}</h3>
                        <p className="rs-modal-hint">{t('userManagement.inviteModalHint')}</p>
                        <form onSubmit={handleCreateUser}>
                            <label>
                                {t('userManagement.email')}
                                <input
                                    type="email"
                                    required
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                                />
                            </label>
                            <label>
                                {t('userManagement.password')}
                                <input
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                                />
                            </label>
                            <div className="rs-form-row">
                                <label>
                                    {t('userManagement.firstName')}
                                    <input
                                        required
                                        value={createForm.firstName}
                                        onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                                    />
                                </label>
                                <label>
                                    {t('userManagement.lastName')}
                                    <input
                                        required
                                        value={createForm.lastName}
                                        onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                                    />
                                </label>
                            </div>
                            <label>
                                {t('userManagement.companyOptional')}
                                <input
                                    value={createForm.company}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, company: e.target.value }))}
                                />
                            </label>
                            <label>
                                {t('userManagement.colRole')}
                                <select
                                    value={createForm.role}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                                >
                                    {ROLE_OPTIONS.filter(
                                        (o) => o.value !== 'SUPER_ADMIN' || canAssignSuperAdmin
                                    ).map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {t(`userManagement.${o.labelKey}`)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="rs-modal-actions">
                                <button
                                    type="button"
                                    className="rs-btn rs-btn--outline"
                                    onClick={() => setInviteOpen(false)}
                                >
                                    {t('userManagement.cancel')}
                                </button>
                                <button type="submit" className="rs-btn rs-btn--primary" disabled={createSubmitting}>
                                    {createSubmitting
                                        ? t('userManagement.creating')
                                        : t('userManagement.createUser')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editUser && (
                <div className="rs-modal-overlay" onClick={() => setEditUserId(null)}>
                    <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('userManagement.editModalTitle')}</h3>
                        <div className="rs-modal-user-preview">
                            <div className="rs-user-avatar">
                                {`${editUser.firstName || ''} ${editUser.lastName || ''}`
                                    .trim()
                                    .split(' ')
                                    .map((w) => w[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase() || '?'}
                            </div>
                            <div>
                                <div className="rs-user-name">
                                    {`${editUser.firstName || ''} ${editUser.lastName || ''}`.trim() || editUser.email}
                                </div>
                                <div className="rs-user-email">{editUser.email}</div>
                            </div>
                        </div>
                        <div className="rs-modal-toggle-row">
                            <span>{t('userManagement.statusActive')}</span>
                            <label className="rs-toggle">
                                <input
                                    type="checkbox"
                                    checked={editUser.isActive}
                                    onChange={(e) => handleToggleActive(editUser, e.target.checked)}
                                />
                                <span className="rs-toggle-slider" />
                            </label>
                        </div>
                        <p className="rs-modal-hint">{t('userManagement.editModalHint')}</p>
                        <div className="rs-modal-actions">
                            <button
                                type="button"
                                className="rs-btn rs-btn--outline"
                                onClick={() => setDeleteConfirmId(editUser.id)}
                            >
                                {t('userManagement.deleteUser')}
                            </button>
                            <button type="button" className="rs-btn rs-btn--primary" onClick={() => setEditUserId(null)}>
                                {t('userManagement.done')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {rolesUser && (
                <div className="rs-modal-overlay" onClick={() => !roleSubmitting && setRolesUserId(null)}>
                    <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('userManagement.rolesModalTitle')}</h3>
                        <p className="rs-modal-hint">
                            {t('userManagement.rolesModalHint', {
                                name: `${rolesUser.firstName || ''} ${rolesUser.lastName || ''}`.trim() || rolesUser.email,
                            })}
                        </p>
                        <label>
                            {t('userManagement.colRole')}
                            <select
                                value={rolesDraft}
                                onChange={(e) => setRolesDraft(e.target.value)}
                                disabled={roleSubmitting}
                            >
                                {ROLE_OPTIONS.filter(
                                    (o) => o.value !== 'SUPER_ADMIN' || canAssignSuperAdmin
                                ).map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {t(`userManagement.${o.labelKey}`)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <p className="rs-modal-hint" style={{ marginTop: 8 }}>
                            {t('userManagement.moduleAccessPreview')}:{' '}
                            <strong>{moduleAccessForRole(rolesDraft, t)}</strong>
                        </p>
                        <div className="rs-modal-actions">
                            <button
                                type="button"
                                className="rs-btn rs-btn--outline"
                                onClick={() => setRolesUserId(null)}
                                disabled={roleSubmitting}
                            >
                                {t('userManagement.cancel')}
                            </button>
                            <button
                                type="button"
                                className="rs-btn rs-btn--primary"
                                disabled={roleSubmitting}
                                onClick={() => handleRoleChange(rolesUser)}
                            >
                                {roleSubmitting ? t('userManagement.saving') : t('userManagement.saveRole')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="rs-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
                    <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('userManagement.deleteModalTitle')}</h3>
                        <p className="rs-modal-hint">{t('userManagement.deleteModalHint')}</p>
                        <div className="rs-modal-actions">
                            <button type="button" className="rs-btn rs-btn--outline" onClick={() => setDeleteConfirmId(null)}>
                                {t('userManagement.cancel')}
                            </button>
                            <button
                                type="button"
                                className="rs-btn rs-btn--danger"
                                onClick={() => {
                                    const u = users.find((x) => x.id === deleteConfirmId);
                                    handleDeleteUser(u);
                                }}
                            >
                                {t('userManagement.confirmDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
