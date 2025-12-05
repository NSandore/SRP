import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ModalOverlay from './ModalOverlay';

const stripHtml = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

function ReportedItems({ userData }) {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [editTarget, setEditTarget] = useState(null);
  const [editFields, setEditFields] = useState({ title: '', description: '', content: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  const canModerate = useMemo(
    () => Number(userData?.role_id) === 1 || Number(userData?.is_ambassador) === 1,
    [userData]
  );

  const buildItemLink = (report) => {
    if (report.item_type === 'forum') {
      return `/info/forum/${report.item_id}`;
    }
    if (report.item_type === 'thread') {
      const forumId = report.forum_id || report.community_id;
      return forumId ? `/info/forum/${forumId}/thread/${report.item_id}` : '';
    }
    if (report.item_type === 'post' || report.item_type === 'comment') {
      const forumId = report.forum_id || report.community_id;
      const threadId = report.thread_id || report.item_id;
      return forumId && threadId ? `/info/forum/${forumId}/thread/${threadId}` : '';
    }
    return '';
  };

  const fetchReports = async () => {
    if (!canModerate) return;
    setLoading(true);
    setError('');
    try {
      const resp = await axios.get('/api/fetch_reported_items.php', {
        params: { status: statusFilter },
        withCredentials: true,
      });
      if (resp.data.success) {
        setReports(resp.data.reports || []);
        setNoteDrafts({});
      } else {
        setError(resp.data.error || 'Unable to load reported items.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Unable to load reported items.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, canModerate]);

  const updateNote = (reportId, value) => {
    setNoteDrafts((prev) => ({ ...prev, [reportId]: value }));
  };

  const openEditModal = (report) => {
    if (!report) return;
    setInfoMessage('');
    const type = report.item_type;
    const nextFields = { title: '', description: '', content: '' };
    if (type === 'post' || type === 'comment') {
      nextFields.content = report.post_content || report.item_context || '';
    } else if (type === 'thread') {
      nextFields.title = report.thread_title || '';
    } else if (type === 'forum') {
      nextFields.title = report.forum_name || '';
      nextFields.description = report.forum_description || report.item_context || '';
    }
    setEditTarget(report);
    setEditFields(nextFields);
  };

  const handleEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!editTarget) return false;
    setSavingEdit(true);
    setError('');
    setInfoMessage('');
    const type = editTarget.item_type;
    let url = '';
    let payload = {};
    if (type === 'post' || type === 'comment') {
      const content = (editFields.content || '').trim();
      if (!content) {
        setError('Please enter content to save.');
        setSavingEdit(false);
        return false;
      }
      url = '/api/edit_post.php';
      payload = { post_id: editTarget.item_id, content };
    } else if (type === 'thread') {
      const title = (editFields.title || '').trim();
      if (!title) {
        setError('Please enter a title to save.');
        setSavingEdit(false);
        return false;
      }
      url = '/api/edit_thread.php';
      payload = { thread_id: editTarget.item_id, new_title: title };
    } else if (type === 'forum') {
      const title = (editFields.title || '').trim();
      if (!title) {
        setError('Please enter a title to save.');
        setSavingEdit(false);
        return false;
      }
      url = '/api/edit_forum.php';
      payload = {
        forum_id: editTarget.item_id,
        name: title,
        description: (editFields.description || '').trim(),
      };
    } else {
      setError('Editing is not supported for this item type.');
      setSavingEdit(false);
      return false;
    }

    try {
      const resp = await axios.post(url, payload, { withCredentials: true });
      if (resp.data.success) {
        setInfoMessage('Item updated successfully.');
        setEditTarget(null);
        setEditFields({ title: '', description: '', content: '' });
        fetchReports();
        return true;
      } else {
        setError(resp.data.error || resp.data.message || 'Unable to update item.');
        return false;
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Unable to update item.';
      setError(msg);
      return false;
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResolve = async (report, action) => {
    if (!report || processingId) return;
    setProcessingId(report.report_id);
    setError('');
    try {
      if (report.item_type === 'forum' && editTarget?.report_id === report.report_id) {
        const saved = await handleEditSubmit();
        if (!saved) {
          setProcessingId(null);
          return;
        }
      }
      const resp = await axios.post(
        '/api/resolve_report.php',
        {
          report_id: report.report_id,
          action,
          notes: noteDrafts[report.report_id] || '',
        },
        { withCredentials: true }
      );
      if (resp.data.success) {
        fetchReports();
      } else {
        setError(resp.data.error || 'Unable to update report.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Unable to update report.';
      setError(msg);
    } finally {
      setProcessingId(null);
    }
  };

  if (!userData) {
    return (
      <div className="feed-container">
        <div className="report-empty-card">
          <h2>Moderation only</h2>
          <p>Please log in with an ambassador or admin account to review reported items.</p>
        </div>
      </div>
    );
  }

  if (!canModerate) {
    return (
      <div className="feed-container">
        <div className="report-empty-card">
          <h2>Access restricted</h2>
          <p>You do not have permission to review reported items for this community.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container reported-items">
      <div className="reported-items__header">
        <div>
          <p className="report-pill">Moderation</p>
          <h1 className="section-title" style={{ marginBottom: 4 }}>Reported Items</h1>
          <p className="report-subtitle">
            Items flagged by the community. Resolve, edit, or remove them to keep discussions healthy.
          </p>
        </div>
        <div className="reported-actions">
          <label htmlFor="status-filter" className="sr-only">Status filter</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="report-filter"
          >
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="retained">Retained</option>
            <option value="dismissed">Dismissed</option>
            <option value="removed">Removed</option>
            <option value="all">All</option>
          </select>
          <button type="button" className="pill-button ghost" onClick={fetchReports} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="report-error">{error}</div>}
      {infoMessage && <div className="notification success">{infoMessage}</div>}

      {loading ? (
        <p>Loading reports…</p>
      ) : reports.length === 0 ? (
        <div className="report-empty-card">
          <h3>No reported items</h3>
          <p>When someone flags content, it will appear here for review.</p>
        </div>
      ) : (
        <div className="report-grid">
          {reports.map((report) => {
            const link = buildItemLink(report);
            const reporterName = [report.reporter_first, report.reporter_last].filter(Boolean).join(' ') || 'Someone';
            const context =
              stripHtml(
                report.post_content ||
                  report.item_context ||
                  report.thread_title ||
                  report.forum_name ||
                  report.announcement_body ||
                  report.event_description ||
                  ''
              ).slice(0, 240);
            const resolverName = report.resolver_first
              ? `${report.resolver_first} ${report.resolver_last || ''}`.trim()
              : '';
            const hidden =
              Number(report.post_hidden) === 1 ||
              Number(report.thread_hidden) === 1 ||
              Number(report.forum_hidden) === 1 ||
              Number(report.announcement_hidden) === 1 ||
              Number(report.event_hidden) === 1;
            const statusLabel = report.status.replace('_', ' ');

            return (
              <div key={report.report_id} className="report-card card-lift">
                <div className="report-card__meta">
                  <span className="report-chip">{report.item_type}</span>
                  <span className={`status-chip ${report.status}`}>{statusLabel}</span>
                  <span className="report-community">{report.community_name || 'Community'}</span>
                  <span className="report-date">{formatDate(report.created_at)}</span>
                  {hidden && <span className="status-chip hidden-chip">Hidden</span>}
                </div>

                <div className="report-card__title">
                  <div>
                    <div className="report-reason">Reason: {report.reason}</div>
                    <div className="report-reporter">Reported by {reporterName}</div>
                  </div>
                  {link && (
                    <Link className="pill-button ghost" to={link}>
                      Open item
                    </Link>
                  )}
                </div>

                {context && <div className="report-context">{context}</div>}
                {report.details && (
                  <div className="reporter-note">
                    Reporter note: <span>{report.details}</span>
                  </div>
                )}

                {report.status === 'pending' || report.status === 'under_review' ? (
                  <div className="report-card__actions">
                    {report.item_type === 'forum' && (
                      <div className="forum-edit-fields">
                        <label className="report-details-label">Title</label>
                        <input
                          type="text"
                          value={editTarget?.report_id === report.report_id ? editFields.title : report.forum_name || ''}
                          onChange={(e) => {
                            if (editTarget?.report_id !== report.report_id) {
                              openEditModal(report);
                            }
                            setEditFields((prev) => ({ ...prev, title: e.target.value }));
                          }}
                          onFocus={() => {
                            if (editTarget?.report_id !== report.report_id) {
                              openEditModal(report);
                            }
                          }}
                        />
                        <label className="report-details-label">Description</label>
                        <textarea
                          rows={3}
                          value={
                            editTarget?.report_id === report.report_id
                              ? editFields.description
                              : report.forum_description || ''
                          }
                          onFocus={() => {
                            if (editTarget?.report_id !== report.report_id) {
                              openEditModal(report);
                            }
                          }}
                          onChange={(e) => {
                            if (editTarget?.report_id !== report.report_id) {
                              openEditModal(report);
                            }
                            setEditFields((prev) => ({ ...prev, description: e.target.value }));
                          }}
                        />
                        <button
                          type="button"
                          className="pill-button secondary"
                          onClick={() => {
                            if (!editTarget || editTarget.report_id !== report.report_id) {
                              openEditModal(report);
                            }
                            handleEditSubmit();
                          }}
                          disabled={savingEdit || processingId === report.report_id}
                        >
                          {savingEdit ? 'Saving…' : 'Save edits'}
                        </button>
                      </div>
                    )}
                    <textarea
                      placeholder="Resolution notes (optional)"
                      value={noteDrafts[report.report_id] || ''}
                      onChange={(e) => updateNote(report.report_id, e.target.value)}
                      rows={2}
                    />
                    <div className="report-action-buttons">
                      <button
                        type="button"
                        className="pill-button secondary"
                        disabled={processingId === report.report_id}
                        onClick={() => handleResolve(report, 'under_review')}
                      >
                        Mark under review
                      </button>
                      <button
                        type="button"
                        className="pill-button secondary"
                        disabled={processingId === report.report_id}
                        onClick={() => handleResolve(report, hidden ? 'restore' : 'hide')}
                      >
                        {hidden ? 'Restore content' : 'Hide content'}
                      </button>
                      {report.item_type !== 'forum' && (
                        <button
                          type="button"
                          className="pill-button secondary"
                          onClick={() => openEditModal(report)}
                          disabled={processingId === report.report_id}
                        >
                          Edit item
                        </button>
                      )}
                      <button
                        type="button"
                        className="pill-button ghost"
                        disabled={processingId === report.report_id}
                        onClick={() => handleResolve(report, 'retain')}
                      >
                        Retain
                      </button>
                      <button
                        type="button"
                        className="pill-button ghost"
                        disabled={processingId === report.report_id}
                        onClick={() => handleResolve(report, 'dismiss')}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        className="pill-button danger"
                        disabled={processingId === report.report_id}
                        onClick={() => handleResolve(report, 'remove')}
                      >
                        Remove item
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="report-resolution">
                    <span>
                      {report.status === 'removed' ? 'Removed' : 'Retained'} by{' '}
                      {resolverName || 'moderator'}
                    </span>
                    {report.resolved_at && <span> · {formatDate(report.resolved_at)}</span>}
                    {report.resolution_notes && (
                      <div className="resolution-note">Notes: {report.resolution_notes}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editTarget && editTarget.item_type !== 'forum' && (
        <ModalOverlay isOpen onClose={() => { setEditTarget(null); setEditFields({ title: '', description: '', content: '' }); }}>
          <form className="report-modal" onSubmit={handleEditSubmit}>
            <div className="report-modal__header">
              <p className="report-pill">Edit</p>
              <h3 className="report-title">Update reported {editTarget?.item_type}</h3>
              <p className="report-subtitle">Make the necessary edits, then save to keep the item live.</p>
            </div>
            {editTarget?.item_type === 'thread' ? (
              <>
                <label className="report-details-label" htmlFor="edit-title">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  value={editFields.title}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </>
            ) : (
              <>
                <label className="report-details-label" htmlFor="edit-content">Content</label>
                <textarea
                  id="edit-content"
                  value={editFields.content}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  required
                />
              </>
            )}
            <div className="report-actions">
              <button
                type="button"
                className="pill-button ghost"
                onClick={() => { setEditTarget(null); setEditFields({ title: '', description: '', content: '' }); }}
              >
                Cancel
              </button>
              <button type="submit" className="pill-button" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

export default ReportedItems;
