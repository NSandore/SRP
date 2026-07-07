import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { isSuperAdmin } from '../constants/roles';
import { getApiBase } from '../utils/apiBase';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const labelForMethod = (method) => {
  if (method === 'id_photo') return 'Selfie + ID front';
  if (method === 'tuition_statement') return 'Schedule / Billing statement';
  return method;
};

export default function VerificationReview({ userData }) {
  const [status, setStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAllowed = isSuperAdmin(userData?.role_id);
  const [searchParams] = useSearchParams();
  const highlightRequestId = searchParams.get('request_id');
  const cardRefs = useRef({});
  const filterSegmentRef = useRef(null);
  const apiBase = getApiBase();

  const resolveAssetUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '');
    const encoded = encodeURIComponent(path);
    return `${base}/api/serve_upload.php?path=${encoded}`;
  };

  const fetchRequests = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await axios.get('/api/fetch_verification_requests.php', {
        params: { status },
        withCredentials: true,
      });
      const list = Array.isArray(res.data?.requests) ? res.data.requests : [];
      setRequests(list);
    } catch (err) {
      setError('Unable to load verification submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAllowed) return;
    if (highlightRequestId && status !== 'all') {
      setStatus('all');
      return;
    }
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAllowed]);

  useEffect(() => {
    if (!highlightRequestId) return;
    const target = cardRefs.current[highlightRequestId];
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [requests, highlightRequestId]);

  const handleDecision = async (requestId, decision) => {
    setError('');
    try {
      await axios.post('/api/update_verification_request.php', { request_id: requestId, decision }, { withCredentials: true });
      setRequests((prev) => prev.filter((item) => item.request_id !== requestId));
      window.dispatchEvent(new CustomEvent('sidebarCountsUpdated'));
    } catch (err) {
      setError('Unable to update verification request.');
    }
  };

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) =>
      [
        request.first_name,
        request.last_name,
        request.email,
        request.community_name,
        request.verification_type,
        labelForMethod(request.verification_method),
        request.staff_position,
        request.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [requests, searchTerm]);

  const emptyState = useMemo(() => {
    if (loading) return 'Loading submissions…';
    if (error) return error;
    if (requests.length > 0 && filteredRequests.length === 0) {
      return 'No submissions match your search.';
    }
    return 'No submissions in this view.';
  }, [loading, error, requests.length, filteredRequests.length]);

  const updateSegmentIndicator = useCallback(() => {
    const container = filterSegmentRef.current;
    if (!container) return;
    const activeChip = container.querySelector('.chip.active');
    if (!activeChip) return;
    const containerRect = container.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    const left = Math.max(chipRect.left - containerRect.left, 0);
    const width = chipRect.width;
    container.style.setProperty('--seg-left', `${left}px`);
    container.style.setProperty('--seg-width', `${width}px`);
  }, []);

  const scheduleSegmentUpdate = useCallback(() => {
    const run = () => updateSegmentIndicator();
    const raf1 = requestAnimationFrame(run);
    const raf2 = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [updateSegmentIndicator]);

  useEffect(() => {
    return scheduleSegmentUpdate();
  }, [status, scheduleSegmentUpdate]);

  useEffect(() => {
    const handleResize = () => updateSegmentIndicator();
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [updateSegmentIndicator]);

  if (!userData) {
    return <p className="admin-helper">Log in to view verification submissions.</p>;
  }

  if (!isAllowed) {
    return <p className="admin-helper">Only super admins can access verification submissions.</p>;
  }

  return (
    <div className="admin-review">
      <div className="admin-review__header">
        <div>
          <h1>Verification submissions</h1>
          <p className="admin-review__subtitle muted-text">Review student and staff proof uploads and take action.</p>
        </div>
        <div className="admin-review__toolbar filter-toolbar filter-toolbar--filter-first">
          <div
            ref={filterSegmentRef}
            className="admin-review__filters chips-row segmented-control"
            style={{
              '--seg-count': STATUS_OPTIONS.length,
              '--seg-index': STATUS_OPTIONS.findIndex((opt) => opt.value === status)
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chip ${status === opt.value ? 'active' : ''}`}
                onClick={() => setStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="admin-review__search">
            <span className="sr-only">Search verification submissions</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search submissions"
            />
          </label>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="admin-review__empty">{emptyState}</div>
      ) : (
        <div className="admin-review__grid">
          {filteredRequests.map((req) => (
            <div
              key={req.request_id}
              ref={(el) => {
                if (el) {
                  cardRefs.current[req.request_id] = el;
                }
              }}
              className={`admin-review__card${highlightRequestId === req.request_id ? ' highlight' : ''}`}
            >
              <div className="admin-review__card-head">
                <div>
                  <div className="admin-review__name">{req.first_name} {req.last_name}</div>
                  <div className="admin-review__meta">{req.email}</div>
                </div>
                <div className={`admin-review__status admin-review__status--${req.status}`}>
                  {req.status}
                </div>
              </div>

              <div className="admin-review__details">
                <div><strong>Community:</strong> {req.community_name || 'Not provided'}</div>
                <div><strong>Type:</strong> {req.verification_type}</div>
                <div><strong>Method:</strong> {labelForMethod(req.verification_method)}</div>
                {req.staff_position && <div><strong>Position:</strong> {req.staff_position}</div>}
                <div><strong>Submitted:</strong> {req.created_at}</div>
              </div>

              <div className="admin-review__uploads">
                {req.selfie_path && (
                  <a href={resolveAssetUrl(req.selfie_path)} target="_blank" rel="noreferrer" className="admin-review__file">
                    <img src={resolveAssetUrl(req.selfie_path)} alt="Selfie with ID" />
                    <span>Selfie + ID</span>
                  </a>
                )}
                {req.id_front_path && (
                  <a href={resolveAssetUrl(req.id_front_path)} target="_blank" rel="noreferrer" className="admin-review__file">
                    <img src={resolveAssetUrl(req.id_front_path)} alt="ID front" />
                    <span>ID front</span>
                  </a>
                )}
                {req.supporting_doc_path && (
                  <a href={resolveAssetUrl(req.supporting_doc_path)} target="_blank" rel="noreferrer" className="admin-review__file">
                    <div className="admin-review__doc">PDF</div>
                    <span>Statement</span>
                  </a>
                )}
              </div>

              <div className="admin-review__actions">
                {req.status === 'pending' ? (
                  <>
                    <button className="admin-review__approve" onClick={() => handleDecision(req.request_id, 'approve')}>Approve</button>
                    <button className="admin-review__reject" onClick={() => handleDecision(req.request_id, 'reject')}>Reject</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
