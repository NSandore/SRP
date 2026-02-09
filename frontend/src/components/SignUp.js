import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { FaCheckCircle } from 'react-icons/fa';
import useTagOptions from '../hooks/useTagOptions';

const ROLE_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'student', label: 'Student' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'staff_representative', label: 'Staff / Representative' },
];

const UniversitySearch = React.memo(function UniversitySearch({
  userId,
  selectedIds,
  onToggle,
  onSelect,
  placeholder = 'Search universities',
  emptyHelper = 'Search for a university to follow.',
  actionLabel = 'Follow',
  selectedLabel = 'Following',
  multiSelect = true,
  communityType = 'university',
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    const trimmed = query.trim();
    if (trimmed === '') {
      setResults([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/fetch_all_university_data.php', {
          params: { user_id: userId, page: 1, search: trimmed, community_type: communityType },
          withCredentials: true,
        });
        if (requestIdRef.current !== requestId) return;
        const universities = Array.isArray(res.data?.communities) ? res.data.communities : [];
        setResults(universities);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setResults([]);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, userId]);

  return (
    <div>
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() === '' ? (
        <p className="auth-helper">{emptyHelper}</p>
      ) : loading ? (
        <p>Loading universities…</p>
      ) : (
        <div className="auth-list auth-search-results">
          {results.map((community) => (
            <div key={community.community_id} className="info-card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{community.name}</p>
                  <p className="muted" style={{ margin: '4px 0 0 0' }}>
                    {community.location || 'Location unavailable'}
                  </p>
                </div>
                <button
                  type="button"
                  className={`pill-button ${selectedIds.includes(String(community.community_id)) ? '' : 'secondary'}`}
                  onClick={() => {
                    const id = String(community.community_id);
                    if (multiSelect) {
                      onToggle?.(id, community);
                    } else {
                      onSelect?.(id, community);
                    }
                  }}
                >
                  {selectedIds.includes(String(community.community_id)) ? selectedLabel : actionLabel}
                </button>
              </div>
            </div>
          ))}
          {!results.length && <p className="muted">No matching universities. Try another search.</p>}
        </div>
      )}
    </div>
  );
});

function SignUp({ onAuthenticated, onShowLogin, onContinueAsGuest }) {
  const navigate = useNavigate();
  const { tags: tagOptions, loading: loadingTags } = useTagOptions();
  const onAuthenticatedRef = useRef(onAuthenticated);

  const [step, setStep] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [accountForm, setAccountForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [roleIntent, setRoleIntent] = useState('prospect');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState([]);
  const [interestFilter, setInterestFilter] = useState('topics');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [studentSchoolId, setStudentSchoolId] = useState('');
  const [studentStartDate, setStudentStartDate] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffInstitutionId, setStaffInstitutionId] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('id_photo');
  const [verificationSelfieFile, setVerificationSelfieFile] = useState(null);
  const [verificationIdFrontFile, setVerificationIdFrontFile] = useState(null);
  const [verificationDocumentFile, setVerificationDocumentFile] = useState(null);
  const [verificationPending, setVerificationPending] = useState(false);

  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    if (roleIntent === 'staff_representative' && verificationMethod !== 'id_photo') {
      setVerificationMethod('id_photo');
      setVerificationSelfieFile(null);
      setVerificationIdFrontFile(null);
      setVerificationDocumentFile(null);
    }
  }, [roleIntent, verificationMethod]);

  const applyWizardState = (nextWizard, fallbackStep = 0) => {
    const nextStep = Number(nextWizard?.current_step || fallbackStep || 0);
    setStep(nextStep === 4 ? 5 : nextStep);
    if (nextWizard?.role_intent) {
      setRoleIntent(nextWizard.role_intent);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const res = await axios.get('/api/onboarding_wizard.php', { withCredentials: true });
        if (!isMounted) return;
        if (res.data?.logged_in && res.data?.user) {
          setSessionUser(res.data.user);
          onAuthenticatedRef.current?.(res.data.user);
          applyWizardState(res.data.wizard, 1);
          if (res.data.user.recent_university_id) {
            setStudentSchoolId(res.data.user.recent_university_id);
            setSelectedCommunityIds((prev) =>
              prev.includes(res.data.user.recent_university_id)
                ? prev
                : [...prev, res.data.user.recent_university_id]
            );
          }
          if (res.data.profile_basics) {
            setLocationCity(res.data.profile_basics.location_city || '');
            setLocationState(res.data.profile_basics.location_state || '');
            setSkillsInput(res.data.profile_basics.skills || '');
          }
          if (res.data.context) {
            setStaffPosition(res.data.context.position || '');
            setStaffInstitutionId(res.data.context.community_id || '');
          }
        } else {
          setStep(0);
        }
      } catch (err) {
        if (!isMounted) return;
        setStep(0);
      } finally {
        if (isMounted) setIsBootstrapping(false);
      }
    };
    bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser?.user_id) return;

    const hydrateSelections = async () => {
      try {
        const [tagsRes, followedRes] = await Promise.all([
          axios.get('/api/fetch_tag_interests.php', { params: { user_id: sessionUser.user_id }, withCredentials: true }),
          axios.get('/api/followed_communities.php', { params: { user_id: sessionUser.user_id }, withCredentials: true }),
        ]);
        const tagSlugs = Array.isArray(tagsRes.data?.tags) ? tagsRes.data.tags : [];
        setSelectedTags(tagSlugs);
        const followed = Array.isArray(followedRes.data) ? followedRes.data : [];
        const ids = followed.map((item) => String(item.community_id));
        setSelectedCommunityIds((prev) => {
          const merged = new Set([...prev, ...ids]);
          return Array.from(merged);
        });
      } catch (err) {
        // no-op
      }
    };
    hydrateSelections();
  }, [sessionUser?.user_id]);

  const toggleTag = (slug) => {
    setSelectedTags((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= 8
          ? prev
          : [...prev, slug]
    );
  };

  const toggleCommunitySelection = (communityId) => {
    setSelectedCommunityIds((prev) =>
      prev.includes(communityId)
        ? prev.filter((id) => id !== communityId)
        : [...prev, communityId]
    );
  };

  const selectStudentSchool = (communityId) => {
    setStudentSchoolId(communityId);
    setSelectedCommunityIds((prev) =>
      prev.includes(communityId) ? prev : [...prev, communityId]
    );
  };

  const exitSetup = async () => {
    setError('');
    if (!sessionUser) {
      onContinueAsGuest?.();
      return;
    }
    try {
      await axios.post('/api/onboarding_wizard.php', { action: 'exit_wizard' }, { withCredentials: true });
    } catch (err) {
      // no-op
    }
    navigate('/home');
  };

  const createAccount = async () => {
    setError('');
    setNotice('');
    const { firstName, lastName, email, password, confirmPassword } = accountForm;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('First name, last name, email, and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsWorking(true);
    try {
      const res = await axios.post(
        '/api/init_register.php',
        { firstName, lastName, email, password },
        { withCredentials: true }
      );
      const user = res.data?.user;
      if (!user) {
        setError(res.data?.error || 'Unable to create account.');
        return;
      }
      setSessionUser(user);
      onAuthenticatedRef.current?.(user);
      applyWizardState(res.data?.wizard, res.data?.email_verification_skipped ? 2 : 1);
      if (res.data?.email_verification_skipped) {
        setNotice('Email verification was skipped in development mode.');
      } else {
        setNotice(`Verification code sent to ${user.email}.`);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to create account right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const verifyEmailCode = async () => {
    setError('');
    if (!verificationCode.trim()) {
      setError('Enter the verification code from your email.');
      return;
    }
    setIsWorking(true);
    try {
      const res = await axios.post(
        '/api/verify_user.php',
        { user_id: sessionUser?.user_id, code: verificationCode.trim() },
        { withCredentials: true }
      );
      setNotice(res.data?.message || 'Email verified.');
      applyWizardState(res.data?.wizard, 2);
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid code.');
    } finally {
      setIsWorking(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      const res = await axios.post(
        '/api/resend_verification.php',
        { user_id: sessionUser?.user_id, email: sessionUser?.email },
        { withCredentials: true }
      );
      setNotice(res.data?.message || 'Verification code sent.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not resend verification code.');
    } finally {
      setIsWorking(false);
    }
  };

  const skipEmailVerification = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      await axios.post('/api/onboarding_wizard.php', { action: 'skip_email_verification' }, { withCredentials: true });
      navigate('/home');
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to skip right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const saveRole = async () => {
    setError('');
    if (roleIntent === 'student' && !studentSchoolId) {
      setError('Select the university you currently attend.');
      return;
    }
    if (roleIntent === 'student' && !studentStartDate) {
      setError('Enter your start date.');
      return;
    }
    setIsWorking(true);
    try {
      const res = await axios.post(
        '/api/onboarding_wizard.php',
        {
          action: 'set_role',
          role_intent: roleIntent,
          community_id: roleIntent === 'student' ? studentSchoolId : null,
          start_date: roleIntent === 'student' ? studentStartDate : null,
        },
        { withCredentials: true }
      );
      applyWizardState(res.data?.wizard, 3);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to save role.');
    } finally {
      setIsWorking(false);
    }
  };

  const saveInterests = async () => {
    setError('');
    if (!selectedTags.length) {
      setError('Select at least one interest.');
      return;
    }
    setIsWorking(true);
    try {
      await axios.post(
        '/api/onboarding_wizard.php',
        { action: 'set_interests', tags: selectedTags },
        { withCredentials: true }
      );
      if (selectedCommunityIds.length) {
        await axios.post(
          '/api/onboarding_wizard.php',
          { action: 'set_follows', community_ids: selectedCommunityIds },
          { withCredentials: true }
        );
      }
      applyWizardState(null, 5);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to save interests.');
    } finally {
      setIsWorking(false);
    }
  };

  const saveProfileBasics = async () => {
    setError('');
    setIsWorking(true);
    try {
      const skills = skillsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const res = await axios.post(
        '/api/onboarding_wizard.php',
        {
          action: 'save_profile_basics',
          location_city: locationCity,
          location_state: locationState,
          skills,
        },
        { withCredentials: true }
      );
      applyWizardState(res.data?.wizard, 9);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to save profile basics.');
    } finally {
      setIsWorking(false);
    }
  };


  const submitVerificationRequest = async () => {
    setError('');
    const verificationType = roleIntent;
    if (!['student', 'staff_representative'].includes(verificationType)) {
      setError('Verification is only available for Student and Staff/Representative roles.');
      return;
    }
    if (verificationType === 'staff_representative' && verificationMethod !== 'id_photo') {
      setError('Staff verification currently supports ID photo only.');
      return;
    }
    if (verificationMethod === 'id_photo') {
      if (!verificationSelfieFile || !verificationIdFrontFile) {
        setError('Upload a selfie with your ID and a photo of the front of your ID.');
        return;
      }
    } else if (verificationMethod === 'tuition_statement') {
      if (!verificationDocumentFile) {
        setError('Upload your class schedule or billing statement (last 90 days).');
        return;
      }
    } else {
      setError('Select a valid verification method.');
      return;
    }

    setIsWorking(true);
    try {
      const uploadDocument = async (file, documentType) => {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('document_type', documentType);
        const res = await axios.post('/api/upload_verification_document.php', formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (!res.data?.success || !res.data?.path) {
          throw new Error(res.data?.error || 'Unable to upload verification document.');
        }
        return res.data.path;
      };

      let selfiePath = null;
      let idFrontPath = null;
      let supportingDocPath = null;

      if (verificationMethod === 'id_photo') {
        selfiePath = await uploadDocument(verificationSelfieFile, 'selfie_with_id');
        idFrontPath = await uploadDocument(verificationIdFrontFile, 'id_front');
      } else if (verificationMethod === 'tuition_statement') {
        supportingDocPath = await uploadDocument(verificationDocumentFile, 'supporting_doc');
      }

      const currentAttendanceId = studentSchoolId || staffInstitutionId || null;
      const res = await axios.post(
        '/api/onboarding_wizard.php',
        {
          action: 'submit_verification_request',
          verification_type: verificationType,
          verification_method: verificationMethod,
          community_id: currentAttendanceId,
          staff_position: staffPosition.trim(),
          selfie_path: selfiePath,
          id_front_path: idFrontPath,
          supporting_doc_path: supportingDocPath,
        },
        { withCredentials: true }
      );
      applyWizardState(res.data?.wizard, 9);
      setVerificationPending(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to submit verification request.');
    } finally {
      setIsWorking(false);
    }
  };

  const skipVerification = async () => {
    setError('');
    setIsWorking(true);
    try {
      const res = await axios.post('/api/onboarding_wizard.php', { action: 'skip_verification' }, { withCredentials: true });
      applyWizardState(res.data?.wizard, 9);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to skip verification right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const finishWizard = async () => {
    setIsWorking(true);
    try {
      await axios.post('/api/onboarding_wizard.php', { action: 'complete_wizard' }, { withCredentials: true });
    } catch (err) {
      // no-op
    } finally {
      setIsWorking(false);
      navigate('/home');
    }
  };

  const stepTitle = useMemo(() => {
    if (step === 0) return 'Create account';
    if (step === 1) return 'Verify your email';
    if (step === 2) return 'Choose your role';
    if (step === 3) return 'Interests and topics';
    if (step === 5) return 'Profile basics (optional)';
    if (step === 7) return 'Optional verification';
    return 'You are all set';
  }, [step]);

  if (isBootstrapping) {
    return (
      <div className="auth-welcome">
        <div className="auth-gradient" aria-hidden />
        <div className="auth-content">
          <section className="auth-panel">
            <h2>Loading setup wizard…</h2>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-welcome">
      <div className="auth-gradient" aria-hidden />
      <div className="auth-content">
        <section className="auth-hero">
          <span className="auth-pill">StudentSphere setup</span>
          <h1>Account creation and setup wizard</h1>
          <p>
            Exploration is always available. Verification increases trust and privileges, but it is never a hard gate.
          </p>
          <ul className="auth-benefits">
            {[
              'Progressive onboarding with role-based questions',
              'Verification is optional and can be completed later',
              'Feed personalization starts as soon as interests are selected',
            ].map((copy) => (
              <li key={copy}>
                <FaCheckCircle />
                {copy}
              </li>
            ))}
          </ul>
          <button className="auth-secondary" onClick={onShowLogin}>
            Already have an account?
          </button>
          <button type="button" className="auth-ghost" onClick={exitSetup}>
            Exit setup for now
          </button>
        </section>

        <section className="auth-panel">
          <p className="auth-step-label">
            {step === 0 ? 'Step 0' : `Step ${step}`} · {stepTitle}
          </p>
          <h2>{stepTitle}</h2>
          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-success">{notice}</p>}

          {step === 0 && (
            <div className="auth-form">
              <div className="auth-input-grid">
                <input
                  placeholder="First name"
                  value={accountForm.firstName}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
                <input
                  placeholder="Last name"
                  value={accountForm.lastName}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={accountForm.email}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                type="password"
                placeholder="Password"
                value={accountForm.password}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={accountForm.confirmPassword}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              />
              <button type="button" className="auth-primary" onClick={createAccount} disabled={isWorking}>
                {isWorking ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="auth-form">
              <p>Check your email for a verification code.</p>
              <input
                placeholder="Verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
              />
              <button type="button" className="auth-primary" onClick={verifyEmailCode} disabled={isWorking}>
                {isWorking ? 'Verifying…' : 'Enter code'}
              </button>
              <button type="button" className="auth-link" onClick={resendCode} disabled={isWorking}>
                Resend code
              </button>
              <button type="button" className="auth-link subtle" onClick={skipEmailVerification} disabled={isWorking}>
                Skip for now (limited posting)
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="auth-form">
              <p>Which best describes you right now?</p>
              {ROLE_OPTIONS.map((option) => (
                <label key={option.value} className="auth-checkbox">
                  <input
                    type="radio"
                    checked={roleIntent === option.value}
                    onChange={() => setRoleIntent(option.value)}
                  />
                  {option.label}
                </label>
              ))}
              {roleIntent === 'student' && (
                <>
                  <p className="auth-helper">Select the university you currently attend.</p>
                  <UniversitySearch
                    userId={sessionUser?.user_id}
                    selectedIds={studentSchoolId ? [studentSchoolId] : []}
                    onSelect={selectStudentSchool}
                    placeholder="Search your university"
                    emptyHelper="Search for your current university."
                    actionLabel="Select"
                    selectedLabel="Selected"
                    multiSelect={false}
                  />
                  <input
                    type="date"
                    value={studentStartDate}
                    onChange={(e) => setStudentStartDate(e.target.value)}
                  />
                </>
              )}
              <button type="button" className="auth-primary" onClick={saveRole} disabled={isWorking}>
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="auth-form">
              <p>Select interests to personalize your feed immediately.</p>
              <div className="pill-row">
                {['topics', 'universities', 'groups'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`pill-button ${interestFilter === filter ? '' : 'secondary'}`}
                    onClick={() => setInterestFilter(filter)}
                  >
                    {filter === 'topics' ? 'Topics' : filter === 'universities' ? 'Universities' : 'Groups'}
                  </button>
                ))}
              </div>
              <div className="interest-grid">
                {loadingTags ? (
                  <p>Loading tags…</p>
                ) : (
                  interestFilter === 'topics' &&
                    tagOptions.map((tag) => (
                      <button
                        key={tag.slug}
                        type="button"
                        className={`pill-button ${selectedTags.includes(tag.slug) ? '' : 'secondary'}`}
                        onClick={() => toggleTag(tag.slug)}
                      >
                        {tag.name}
                      </button>
                    ))
                )}
              </div>
              {interestFilter === 'universities' && (
                <UniversitySearch
                  userId={sessionUser?.user_id}
                  selectedIds={selectedCommunityIds}
                  onToggle={toggleCommunitySelection}
                  placeholder="Search universities"
                  emptyHelper="Search for universities to follow."
                  actionLabel="Follow"
                  selectedLabel="Following"
                  communityType="university"
                />
              )}
              {interestFilter === 'groups' && (
                <UniversitySearch
                  userId={sessionUser?.user_id}
                  selectedIds={selectedCommunityIds}
                  onToggle={toggleCommunitySelection}
                  placeholder="Search groups"
                  emptyHelper="Search for groups to follow."
                  actionLabel="Follow"
                  selectedLabel="Following"
                  communityType="group"
                />
              )}
              <button type="button" className="auth-primary" onClick={saveInterests} disabled={isWorking}>
                Continue
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="auth-form">
              <p>Add a little more about yourself. You can skip this and return later.</p>
              <div className="auth-input-grid">
                <input
                  placeholder="City"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                />
                <input
                  placeholder="State"
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                />
              </div>
              <input
                placeholder="Skills (comma-separated)"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
              />
              <button type="button" className="auth-primary" onClick={saveProfileBasics} disabled={isWorking}>
                Save and continue
              </button>
              <button type="button" className="auth-link" onClick={saveProfileBasics} disabled={isWorking}>
                Skip for now
              </button>
            </div>
          )}

          {step === 7 && (
            <div className="auth-form">
              {verificationPending ? (
                <div className="auth-pending">
                  <div className="auth-hourglass" aria-hidden />
                  <h3>Review in progress</h3>
                  <p>Please enjoy exploring in the meantime while we review your submission! We will send you an update on your verification status soon.</p>
                  <button type="button" className="auth-primary" onClick={finishWizard} disabled={isWorking}>
                    Go to home
                  </button>
                </div>
              ) : (
                <>
              <p>Verification is optional. You can skip and return later.</p>
              {roleIntent === 'staff_representative' && (
                <>
                  <label>Institution you represent</label>
                  <UniversitySearch
                    userId={sessionUser?.user_id}
                    selectedIds={staffInstitutionId ? [staffInstitutionId] : []}
                    onSelect={(id) => setStaffInstitutionId(id)}
                    placeholder="Search your institution"
                    emptyHelper="Search for the university you represent."
                    actionLabel="Select"
                    selectedLabel="Selected"
                    multiSelect={false}
                  />
                  <input
                    placeholder="Position / title"
                    value={staffPosition}
                    onChange={(e) => setStaffPosition(e.target.value)}
                  />
                </>
              )}
              <label>Verification method</label>
              <select
                value={verificationMethod}
                onChange={(e) => {
                  const nextMethod = e.target.value;
                  setVerificationMethod(nextMethod);
                  setVerificationSelfieFile(null);
                  setVerificationIdFrontFile(null);
                  setVerificationDocumentFile(null);
                }}
              >
                <option value="id_photo">Selfie with ID + front of ID</option>
                {roleIntent === 'student' && (
                  <option value="tuition_statement">Class schedule or billing statement (last 90 days)</option>
                )}
              </select>

              {verificationMethod === 'id_photo' && (
                <>
                  <label>Selfie holding your ID</label>
                  <input type="file" accept="image/*" onChange={(e) => setVerificationSelfieFile(e.target.files?.[0] || null)} />
                  <label>Front of ID</label>
                  <input type="file" accept="image/*" onChange={(e) => setVerificationIdFrontFile(e.target.files?.[0] || null)} />
                  <p className="auth-helper">Your name and the university logo must be visible.</p>
                </>
              )}

              {verificationMethod === 'tuition_statement' && (
                <>
                  <label>Upload schedule or billing statement</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setVerificationDocumentFile(e.target.files?.[0] || null)} />
                  <p className="auth-helper">Must be within the last 90 days and show your name and university logo.</p>
                </>
              )}
              <button type="button" className="auth-primary" onClick={submitVerificationRequest} disabled={isWorking}>
                Submit verification request
              </button>
              <button type="button" className="auth-link" onClick={skipVerification} disabled={isWorking}>
                Verify later
              </button>
                </>
              )}
            </div>
          )}

          {step === 9 && (
            <div className="auth-form">
              <p>Your account is active. You can continue exploring and finish any pending verification later.</p>
              <button type="button" className="auth-primary" onClick={finishWizard} disabled={isWorking}>
                Go to home
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SignUp;
