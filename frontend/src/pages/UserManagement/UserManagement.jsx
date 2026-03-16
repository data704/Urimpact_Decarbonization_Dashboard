import { useState, useEffect, useCallback } from 'react';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './UserManagement.css';

const ROLE_OPTIONS = [
    { value: 'ADMINISTRATOR', label: 'Administrator' },
    { value: 'DATA_CONTRIBUTOR', label: 'Data Contributor' },
    { value: 'ANALYST', label: 'Analyst' },
    { value: 'VIEWER', label: 'Viewer' },
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

function formatLastActive(isoDate) {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '—';
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? 'Just now' : `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
}

function roleLabel(role) {
    const r = ROLE_OPTIONS.find((o) => o.value === role);
    return r ? r.label : role;
}

function UserManagement() {
    const { user: currentUser } = useAuth();
    const [notification, setNotification] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [organizationLimit, setOrganizationLimit] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const [createForm, setCreateForm] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        company: '',
        role: 'USER',
    });
    const [createSubmitting, setCreateSubmitting] = useState(false);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAdminUsers({ limit: '100' });
            setUsers(Array.isArray(result.data) ? result.data : []);
            setOrganizationLimit(result.organizationLimit ?? null);
        } catch (e) {
            setError(e?.message || 'Failed to load users');
            setUsers([]);
            setOrganizationLimit(null);
        } finally {
            setLoading(false);
        }
    }, []);

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
            showNotification('User created. They can sign in with the password you set.');
            setCreateOpen(false);
            setCreateForm({
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                company: '',
                role: 'USER',
            });
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || 'Failed to create user', 'error');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const handleToggleActive = async (u) => {
        try {
            await updateAdminUser(u.id, { isActive: !u.isActive });
            showNotification(u.isActive ? 'User deactivated' : 'User activated');
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || 'Update failed', 'error');
        }
    };

    const handleRoleChange = async (u, newRole) => {
        if (newRole === u.role) return;
        try {
            await updateAdminUser(u.id, { role: newRole });
            showNotification('Role updated');
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || 'Update failed', 'error');
        }
    };

    const handleDeleteUser = async (u) => {
        if (!u || !u.id) return;
        try {
            await deleteAdminUser(u.id);
            showNotification('User deleted');
            setDeleteConfirmId(null);
            await loadUsers();
        } catch (err) {
            showNotification(err?.message || 'Failed to delete user', 'error');
        }
    };

    const filteredUsers = users.filter((u) => {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    const stats = {
        total: users.length,
        admins: users.filter((u) => {
            const r = String(u.role || '');
            return r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN' || r === 'ADMIN';
        }).length,
        active: users.filter((u) => u.isActive).length,
        inactive: users.filter((u) => !u.isActive).length,
    };

    const canAssignSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

    const atUserLimit =
        organizationLimit != null &&
        organizationLimit.userCount >= organizationLimit.maxUsers;

    return (
        <div className="user-management-content">
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i
                        className={`fas fa-${
                            notification.type === 'success'
                                ? 'check-circle'
                                : notification.type === 'error'
                                  ? 'exclamation-circle'
                                  : 'info-circle'
                        }`}
                    ></i>
                    <span>{notification.message}</span>
                </div>
            )}

            <div className="page-header">
                <div>
                    <h1>User Management</h1>
                    <p>Manage team members and their permissions. New users sign in with limited access by role.</p>
                    {organizationLimit != null && (
                        <p className="user-limit-hint">
                            Organization limit: {organizationLimit.userCount} / {organizationLimit.maxUsers} users
                        </p>
                    )}
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setCreateOpen(true)}
                    disabled={atUserLimit}
                    title={atUserLimit ? `Your organization has reached the maximum of ${organizationLimit?.maxUsers ?? 3} users.` : ''}
                >
                    <i className="fas fa-user-plus"></i>
                    Add User
                </button>
            </div>

            {error && (
                <div className="notification error" style={{ marginBottom: '1rem' }}>
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{error}</span>
                </div>
            )}

            <div className="user-stats">
                <div className="stat-card">
                    <div className="stat-icon total">
                        <i className="fas fa-users"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total Users</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon admin">
                        <i className="fas fa-user-shield"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.admins}</span>
                        <span className="stat-label">Admins</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon editor">
                        <i className="fas fa-user-check"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.active}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon viewer">
                        <i className="fas fa-user-slash"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.inactive}</span>
                        <span className="stat-label">Inactive</span>
                    </div>
                </div>
            </div>

            <div className="card users-table-card">
                <div className="table-header">
                    <h2>Team Members</h2>
                    <div className="table-search">
                        <i className="fas fa-search"></i>
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>Loading users…</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => {
                                const name =
                                    `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                                const isSelf = currentUser?.id === u.id;
                                return (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar">
                                                    {(u.firstName?.charAt(0) || u.email?.charAt(0) || '?').toUpperCase()}
                                                </div>
                                                <div className="user-info">
                                                    <span className="user-name">{name}</span>
                                                    <span className="user-email">{u.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {isSelf || (u.role === 'SUPER_ADMIN' && !canAssignSuperAdmin) ? (
                                                <span className={`role-badge ${String(u.role || 'DATA_CONTRIBUTOR').toLowerCase().replace(/_/g, '-')}`}>
                                                    {roleLabel(u.role)}
                                                </span>
                                            ) : (
                                                <select
                                                    className="role-select"
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u, e.target.value)}
                                                    disabled={u.role === 'SUPER_ADMIN' && !canAssignSuperAdmin}
                                                >
                                                    {ROLE_OPTIONS.filter(
                                                        (o) => o.value !== 'SUPER_ADMIN' || canAssignSuperAdmin
                                                    ).map((o) => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`status-dot ${u.isActive ? 'active' : 'inactive'}`}></span>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </td>
                                        <td>{formatLastActive(u.lastLoginAt)}</td>
                                        <td>
                                            <div className="action-buttons">
                                                {!isSelf && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="action-btn"
                                                            title={u.isActive ? 'Deactivate' : 'Activate'}
                                                            onClick={() => handleToggleActive(u)}
                                                        >
                                                            <i
                                                                className={`fas fa-${u.isActive ? 'user-slash' : 'user-check'}`}
                                                            ></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="action-btn danger"
                                                            title="Delete user"
                                                            onClick={() => setDeleteConfirmId(u.id)}
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {createOpen && (
                <div className="modal-overlay" onClick={() => !createSubmitting && setCreateOpen(false)}>
                    <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
                        <h3>Add user</h3>
                        <p className="modal-hint">
                            Password must be 8+ chars with uppercase, lowercase, and a number. User can sign in
                            immediately; access is limited by role.
                        </p>
                        <form onSubmit={handleCreateUser}>
                            <label>
                                Email
                                <input
                                    type="email"
                                    required
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                                />
                            </label>
                            <label>
                                Password
                                <input
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                                />
                            </label>
                            <div className="form-row">
                                <label>
                                    First name
                                    <input
                                        required
                                        value={createForm.firstName}
                                        onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                                    />
                                </label>
                                <label>
                                    Last name
                                    <input
                                        required
                                        value={createForm.lastName}
                                        onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                                    />
                                </label>
                            </div>
                            <label>
                                Company (optional)
                                <input
                                    value={createForm.company}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, company: e.target.value }))}
                                />
                            </label>
                            <label>
                                Role
                                <select
                                    value={createForm.role}
                                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                                >
                                    {ROLE_OPTIONS.filter(
                                        (o) => o.value !== 'SUPER_ADMIN' || canAssignSuperAdmin
                                    ).map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={createSubmitting}>
                                    {createSubmitting ? 'Creating…' : 'Create user'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {deleteConfirmId && (
                <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
                    <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete user</h3>
                        <p className="modal-hint">
                            This will permanently remove the user and their access. Emissions and documents they
                            created will remain for reporting.
                        </p>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setDeleteConfirmId(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => {
                                    const u = users.find((x) => x.id === deleteConfirmId);
                                    handleDeleteUser(u);
                                }}
                            >
                                Delete user
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
