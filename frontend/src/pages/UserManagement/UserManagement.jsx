import { useState } from 'react';
import './UserManagement.css';

function UserManagement() {
    const [notification, setNotification] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    const users = [
        { id: 1, name: 'John Smith', email: 'john.smith@company.com', role: 'Admin', status: 'active', lastActive: '2 hours ago' },
        { id: 2, name: 'Sarah Johnson', email: 'sarah.j@company.com', role: 'Editor', status: 'active', lastActive: '5 mins ago' },
        { id: 3, name: 'Mike Wilson', email: 'mike.w@company.com', role: 'Viewer', status: 'active', lastActive: '1 day ago' },
        { id: 4, name: 'Emily Brown', email: 'emily.b@company.com', role: 'Editor', status: 'inactive', lastActive: '2 weeks ago' },
        { id: 5, name: 'David Lee', email: 'david.l@company.com', role: 'Viewer', status: 'active', lastActive: '3 hours ago' },
    ];

    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'Admin').length,
        editors: users.filter(u => u.role === 'Editor').length,
        viewers: users.filter(u => u.role === 'Viewer').length
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleInviteUser = () => {
        showNotification('Invitation sent successfully!');
    };

    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="user-management-content">
            {/* Notification */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <i className="fas fa-check-circle"></i>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1>User Management</h1>
                    <p>Manage team members and their permissions</p>
                </div>
                <button className="btn btn-primary" onClick={handleInviteUser}>
                    <i className="fas fa-user-plus"></i>
                    Invite User
                </button>
            </div>

            {/* Stats Cards */}
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
                        <i className="fas fa-user-edit"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.editors}</span>
                        <span className="stat-label">Editors</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon viewer">
                        <i className="fas fa-user"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.viewers}</span>
                        <span className="stat-label">Viewers</span>
                    </div>
                </div>
            </div>

            {/* Users Table */}
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

                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Last Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.id}>
                                <td>
                                    <div className="user-cell">
                                        <div className="user-avatar">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div className="user-info">
                                            <span className="user-name">{user.name}</span>
                                            <span className="user-email">{user.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`role-badge ${user.role.toLowerCase()}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-dot ${user.status}`}></span>
                                    {user.status === 'active' ? 'Active' : 'Inactive'}
                                </td>
                                <td>{user.lastActive}</td>
                                <td>
                                    <div className="action-buttons">
                                        <button className="action-btn" title="Edit">
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button className="action-btn" title="Delete">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default UserManagement;
