// src/components/admin/ResourceManager.jsx
//
// Generic list + create/edit modal + delete for a REST-ish resource.
// Used by UsersAdmin, VendorsAdmin, ProjectsAdmin, RolesAdmin so each of
// those files only has to declare *what* the fields/columns are, not
// re-implement table/modal/loading/error plumbing every time.
//
// field shape:
//   {
//     name: 'role_id',
//     label: 'Role',
//     type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea',
//     required: bool,
//     showOnCreate: bool (default true),
//     showOnEdit: bool (default true),
//     options: [{ value, label }]              // for type: 'select', static
//     loadOptions: async () => [{value,label}] // for type: 'select', dynamic
//     help: 'shown under the input',
//   }

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ResourceManager({
  title,
  service, // { list, create, update, remove }
  columns, // [{ key, label, render?(row) }]
  fields,
  permissionPrefix, // e.g. 'user_management' -> checks user_management.create etc
  createPermission, // override, e.g. 'workflow.manage'
  updatePermission,
  deletePermission,
  searchable = true,
  rowId = 'id',
  emptyMessage = 'Nothing here yet.',
}) {
  const { hasPermission } = useAuth();
  const canCreate = !permissionPrefix || hasPermission(createPermission || `${permissionPrefix}.create`);
  const canUpdate = !permissionPrefix || hasPermission(updatePermission || `${permissionPrefix}.update`);
  const canDelete =
    Boolean(service.remove) && (!permissionPrefix || hasPermission(deletePermission || `${permissionPrefix}.delete`));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [optionsByField, setOptionsByField] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await service.list(searchable ? { search } : undefined);
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [search, service, searchable]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve any dynamic select options (e.g. role dropdown) once on mount.
  useEffect(() => {
    fields.forEach(async (f) => {
      if (f.type === 'select' && f.loadOptions) {
        try {
          const opts = await f.loadOptions();
          setOptionsByField((prev) => ({ ...prev, [f.name]: opts }));
        } catch {
          setOptionsByField((prev) => ({ ...prev, [f.name]: [] }));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function optionsFor(field) {
    return field.options || optionsByField[field.name] || [];
  }

  function openCreate() {
    const initial = {};
    fields.forEach((f) => {
      if (f.showOnCreate === false) return;
      initial[f.name] = f.type === 'checkbox' ? false : '';
    });
    setEditingRow(null);
    setFormValues(initial);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(row) {
    const initial = {};
    fields.forEach((f) => {
      if (f.showOnEdit === false) return;
      const raw = row[f.name] ?? (f.type === 'checkbox' ? false : '');
      initial[f.name] = f.formatForForm ? f.formatForForm(raw) : raw;
    });
    setEditingRow(row);
    setFormValues(initial);
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const payload = {};
      for (const f of activeFields) {
        const raw = formValues[f.name];
        try {
          payload[f.name] = f.parseFromForm ? f.parseFromForm(raw) : raw;
        } catch (parseErr) {
          throw new Error(`${f.label}: ${parseErr.message}`);
        }
      }
      if (editingRow) {
        await service.update(editingRow[rowId], payload);
      } else {
        await service.create(payload);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete "${row[columns[0].key]}"? This can't be undone.`)) return;
    try {
      await service.remove(row[rowId]);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  }

  const activeFields = useMemo(
    () => fields.filter((f) => (editingRow ? f.showOnEdit !== false : f.showOnCreate !== false)),
    [fields, editingRow]
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">{title}</h5>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            + Add {title.replace(/s$/, '')}
          </button>
        )}
      </div>

      {searchable && (
        <div className="mb-3" style={{ maxWidth: 320 }}>
          <input
            className="form-control form-control-sm"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted small">{emptyMessage}</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm align-middle">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                {(canUpdate || canDelete) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[rowId]}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? '')}</td>
                  ))}
                  {(canUpdate || canDelete) && (
                    <td className="text-end">
                      {canUpdate && (
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(row)}>
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h6 className="modal-title">{editingRow ? `Edit ${title.replace(/s$/, '')}` : `New ${title.replace(/s$/, '')}`}</h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  {activeFields.map((f) => (
                    <div className="mb-3" key={f.name}>
                      {f.type !== 'checkbox' && (
                        <label className="form-label small">
                          {f.label} {f.required && <span className="text-danger">*</span>}
                        </label>
                      )}

                      {f.type === 'select' ? (
                        <select
                          className="form-select form-select-sm"
                          required={f.required}
                          value={formValues[f.name] ?? ''}
                          onChange={(e) => setFormValues((v) => ({ ...v, [f.name]: e.target.value }))}
                        >
                          <option value="">Select…</option>
                          {optionsFor(f).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'checkbox' ? (
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={f.name}
                            checked={Boolean(formValues[f.name])}
                            onChange={(e) => setFormValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                          />
                          <label className="form-check-label small" htmlFor={f.name}>
                            {f.label}
                          </label>
                        </div>
                      ) : f.type === 'textarea' ? (
                        <textarea
                          className="form-control form-control-sm"
                          rows={5}
                          required={f.required}
                          value={formValues[f.name] ?? ''}
                          onChange={(e) => setFormValues((v) => ({ ...v, [f.name]: e.target.value }))}
                        />
                      ) : (
                        <input
                          type={f.type || 'text'}
                          className="form-control form-control-sm"
                          required={f.required}
                          value={formValues[f.name] ?? ''}
                          onChange={(e) => setFormValues((v) => ({ ...v, [f.name]: e.target.value }))}
                          autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                        />
                      )}
                      {f.help && <div className="form-text">{f.help}</div>}
                    </div>
                  ))}
                  {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
