// src/components/Layout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Workflow',
    items: [
      { to: '/inbox', label: 'My Desk', show: () => true },
      { to: '/my-claims', label: 'My claims', show: (user) => user?.role_name === 'Vendor' },
      { to: '/claims/new', label: 'New claim', permission: 'claim.create' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'Users', permission: 'user_management.read' },
      { to: '/admin/vendors', label: 'Vendors', permission: 'vendor.read' },
      { to: '/admin/projects', label: 'Projects', permission: 'procurement.read' },
      { to: '/admin/roles', label: 'Roles & Permissions', permission: 'role_management.read' },
      { to: '/admin/workflows', label: 'Workflows', permission: 'workflow.manage' },
    ],
  },
];

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <aside className="border-end bg-body-tertiary p-3" style={{ width: 240, flexShrink: 0 }}>
        <div className="fw-semibold mb-4">APTS Bills Tracking</div>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => (item.show ? item.show(user) : true) && (!item.permission || hasPermission(item.permission))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-4">
              <div className="text-uppercase text-muted small fw-semibold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                {section.label}
              </div>
              <ul className="nav nav-pills flex-column gap-1">
                {visibleItems.map((item) => (
                  <li className="nav-item" key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => `nav-link py-1 px-2 small ${isActive ? 'active' : 'text-body'}`}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </aside>

      <div className="flex-grow-1 d-flex flex-column">
        <nav className="navbar navbar-expand border-bottom bg-white px-3">
          <div className="ms-auto d-flex align-items-center gap-3">
            <span className="small text-muted">{user?.name} · {user?.role_name}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>Sign out</button>
          </div>
        </nav>
        <main className="p-4 flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
