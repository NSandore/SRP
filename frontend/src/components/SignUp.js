import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FaArrowRight,
  FaBookOpen,
  FaCheck,
  FaCheckCircle,
  FaCompass,
  FaShieldAlt,
  FaUniversity,
  FaUsers,
} from 'react-icons/fa';
import './Login.css';
import './SignUp.css';
import {
  AUDIENCE_OPTIONS,
  NEED_OPTIONS,
  ambassadorMessageDestination,
  needsForTags,
  primaryRoleForAudiences,
  rankGuideRecommendations,
  tagsForNeeds,
} from './signupOptions';
import { getPasswordLengthError } from '../utils/passwordValidation';

const INFO_COMMUNITY_ID = 'c57b7fd6c45b9d57b';
const MAX_NEEDS = 8;

const AUDIENCE_ICONS = {
  exploring: FaCompass,
  currently_enrolled: FaBookOpen,
  previously_attended: FaUniversity,
  supporting_student: FaUsers,
  school_professional: FaUniversity,
  mentor_resource: FaUsers,
};

const stepFromWizard = (wizard, fallback = 0) => {
  const internalStep = Number(wizard?.current_step ?? fallback);
  if (internalStep <= 1) return internalStep;
  if (internalStep === 2) return 2;
  if (internalStep === 3) return 3;
  return 9;
};

const visibleStepNumber = (step) => {
  if (step <= 1) return 1;
  if (step === 2) return 2;
  if (step === 3) return 3;
  return 4;
};

const roleIntentFromUser = (user) => {
  const value = String(user?.education_status || '').toLowerCase();
  if (value.includes('staff')) return 'staff_representative';
  if (value.includes('student')) return 'student';
  if (value.includes('alumni')) return 'alumni';
  return 'prospect';
};

const UniversitySearch = React.memo(function UniversitySearch({
  userId,
  selectedIds,
  onToggle,
  onSelect,
  multiSelect = true,
  inputId = 'signup-school-search',
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!userId) return undefined;
    const trimmed = query.trim();
    if (trimmed === '') {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/fetch_all_university_data.php', {
          params: { user_id: userId, page: 1, search: trimmed, community_type: 'university' },
          withCredentials: true,
        });
        if (requestIdRef.current !== requestId) return;
        setResults(Array.isArray(response.data?.communities) ? response.data.communities : []);
      } catch (error) {
        if (requestIdRef.current === requestId) setResults([]);
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, userId]);

  return (
    <div className="signup-school-search">
      <label htmlFor={inputId}>School or program name</label>
      <input
        id={inputId}
        type="search"
        placeholder="Start typing a school name"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      <p className="signup-field-help">Optional. Add one now, or connect with schools later.</p>
      {loading && <p className="signup-inline-status" role="status">Searching schools…</p>}
      {!loading && query.trim() !== '' && (
        <div className="signup-school-results">
          {results.map((community) => {
            const id = String(community.community_id);
            const selected = selectedIds.includes(id);
            return (
              <button
                type="button"
                className={`signup-school-result${selected ? ' selected' : ''}`}
                key={id}
                onClick={() => {
                  if (multiSelect) onToggle?.(id, community);
                  else onSelect?.(id, community);
                }}
                aria-pressed={selected}
              >
                <span>
                  <strong>{community.name}</strong>
                  <small>{community.location || 'Location not listed'}</small>
                </span>
                <span className="signup-result-action">{selected ? 'Added' : 'Add'}</span>
              </button>
            );
          })}
          {!results.length && <p className="signup-inline-status">No matching schools found.</p>}
        </div>
      )}
    </div>
  );
});

function SignUp({ onAuthenticated, onShowLogin, onContinueAsGuest, onOnboardingChange, onLeaveOnboarding }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verificationMode = searchParams.get('verify') === '1';
  const onAuthenticatedRef = useRef(onAuthenticated);
  const errorRef = useRef(null);
  const resultsRequestRef = useRef(false);

  const [step, setStep] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const [accountForm, setAccountForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [passwordFeedback, setPasswordFeedback] = useState({ field: '', message: '', nonce: 0 });
  const [verificationCode, setVerificationCode] = useState('');
  const [audienceIntents, setAudienceIntents] = useState([]);
  const [roleIntent, setRoleIntent] = useState('prospect');
  const [selectedNeeds, setSelectedNeeds] = useState([]);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState([]);
  const [selectedCommunities, setSelectedCommunities] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [recommendedAmbassador, setRecommendedAmbassador] = useState(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const [verificationMethod, setVerificationMethod] = useState('id_photo');
  const [verificationSelfieFile, setVerificationSelfieFile] = useState(null);
  const [verificationIdFrontFile, setVerificationIdFrontFile] = useState(null);
  const [verificationDocumentFile, setVerificationDocumentFile] = useState(null);
  const [verificationInstitutionId, setVerificationInstitutionId] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingDeletedAccount, setPendingDeletedAccount] = useState(null);
  const [previousAccountPassword, setPreviousAccountPassword] = useState('');
  const [deletionActionError, setDeletionActionError] = useState('');
  const [isHandlingDeletion, setIsHandlingDeletion] = useState(false);
  const [forceDeleteConfirmation, setForceDeleteConfirmation] = useState('');

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    if (error && errorRef.current) errorRef.current.focus();
  }, [error]);

  const applyWizardState = useCallback((wizard, fallback = 0) => {
    setStep(stepFromWizard(wizard, fallback));
    if (wizard?.role_intent) setRoleIntent(wizard.role_intent);
    if (wizard) onOnboardingChange?.(wizard);
  }, [onOnboardingChange]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const response = await axios.get('/api/onboarding_wizard.php', { withCredentials: true });
        if (!mounted) return;
        if (response.data?.logged_in && response.data?.user) {
          const user = response.data.user;
          const context = response.data?.context || {};
          setSessionUser(user);
          onAuthenticatedRef.current?.(user);
          applyWizardState(response.data.wizard, 1);
          setRoleIntent(response.data?.wizard?.role_intent || roleIntentFromUser(user));
          if (Array.isArray(context.audience_intents) && context.audience_intents.length) {
            setAudienceIntents(context.audience_intents);
          } else if (response.data?.wizard?.role_intent) {
            const match = AUDIENCE_OPTIONS.find((option) => option.roleIntent === response.data.wizard.role_intent);
            if (match) setAudienceIntents([match.value]);
          }
          if (Array.isArray(context.needs)) setSelectedNeeds(context.needs);
          if (context.position) setStaffPosition(context.position);
          if (context.community_id) setVerificationInstitutionId(String(context.community_id));
          if (user.recent_university_id) {
            const id = String(user.recent_university_id);
            setSelectedCommunityIds([id]);
            setVerificationInstitutionId(id);
          }
        } else {
          setStep(0);
        }
      } catch (bootstrapError) {
        if (mounted) setStep(0);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [applyWizardState]);

  useEffect(() => {
    if (!sessionUser?.user_id) return undefined;
    let mounted = true;
    const hydrateSelections = async () => {
      try {
        const [tagsResponse, followsResponse] = await Promise.all([
          axios.get('/api/fetch_tag_interests.php', { params: { user_id: sessionUser.user_id }, withCredentials: true }),
          axios.get('/api/followed_communities.php', { params: { user_id: sessionUser.user_id }, withCredentials: true }),
        ]);
        if (!mounted) return;
        const tags = Array.isArray(tagsResponse.data?.tags) ? tagsResponse.data.tags : [];
        setSelectedNeeds((current) => current.length ? current : needsForTags(tags));
        const followed = Array.isArray(followsResponse.data) ? followsResponse.data : [];
        setSelectedCommunityIds((current) => Array.from(new Set([
          ...current,
          ...followed.map((community) => String(community.community_id)),
        ])));
        setSelectedCommunities((current) => {
          const next = { ...current };
          followed.forEach((community) => {
            next[String(community.community_id)] = community;
          });
          return next;
        });
      } catch (hydrateError) {
        // Optional personalization should never block account creation.
      }
    };
    hydrateSelections();
    return () => {
      mounted = false;
    };
  }, [sessionUser?.user_id]);

  const loadPersonalizedResults = useCallback(async () => {
    if (!sessionUser?.user_id || resultsRequestRef.current) return;
    resultsRequestRef.current = true;
    setIsLoadingResults(true);
    try {
      const primaryCommunityId = selectedCommunityIds[0] || '';
      const requests = [axios.get('/api/fetch_knowledge_base_articles.php', {
        params: { community_id: INFO_COMMUNITY_ID, user_id: sessionUser.user_id },
        withCredentials: true,
      })];
      if (primaryCommunityId) {
        requests.push(axios.get('/api/fetch_ambassador_list.php', {
          params: { community_id: primaryCommunityId },
          withCredentials: true,
        }));
      }
      const [articlesResponse, ambassadorResponse] = await Promise.all(requests);
      const articles = Array.isArray(articlesResponse.data?.articles) ? articlesResponse.data.articles : [];
      setRecommendations(rankGuideRecommendations(articles, selectedNeeds, 3));
      const ambassadors = Array.isArray(ambassadorResponse?.data?.ambassadors) ? ambassadorResponse.data.ambassadors : [];
      setRecommendedAmbassador(ambassadors[0] || null);
    } catch (resultsError) {
      setRecommendations([]);
      setRecommendedAmbassador(null);
    } finally {
      setIsLoadingResults(false);
    }
  }, [selectedCommunityIds, selectedNeeds, sessionUser?.user_id]);

  useEffect(() => {
    if (step === 9 && !verificationMode) loadPersonalizedResults();
  }, [loadPersonalizedResults, step, verificationMode]);

  const changeStep = (nextStep) => {
    setError('');
    setNotice('');
    setStep(nextStep);
  };

  const createAccount = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const { firstName, lastName, email, password, confirmPassword } = accountForm;
    if (![firstName, lastName, email, password, confirmPassword].every((value) => value.trim())) {
      if (!password) {
        setPasswordFeedback((current) => ({ field: 'password', message: 'Enter a password with at least 10 characters.', nonce: current.nonce + 1 }));
      } else if (!confirmPassword) {
        setPasswordFeedback((current) => ({ field: 'confirm', message: 'Enter the password again.', nonce: current.nonce + 1 }));
      }
      setError('Complete each field to create your account.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordFeedback((current) => ({ field: 'confirm', message: 'The passwords do not match.', nonce: current.nonce + 1 }));
      setError('The passwords do not match.');
      return;
    }
    const passwordLengthError = getPasswordLengthError(password);
    if (passwordLengthError) {
      setPasswordFeedback((current) => ({ field: 'password', message: passwordLengthError, nonce: current.nonce + 1 }));
      setError(passwordLengthError);
      return;
    }
    setPasswordFeedback({ field: '', message: '', nonce: 0 });
    setIsWorking(true);
    try {
      const response = await axios.post('/api/init_register.php', {
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password,
      }, { withCredentials: true });
      const user = response.data?.user;
      if (!user) throw new Error(response.data?.error || 'Unable to create account.');
      setSessionUser(user);
      onAuthenticatedRef.current?.(user);
      applyWizardState(response.data?.wizard, response.data?.email_verification_skipped ? 2 : 1);
      if (response.data?.email_verification_skipped) setNotice('Email confirmation is skipped in the development environment.');
      else if (response.data?.email_sent) setNotice(`We sent a six-digit code to ${user.email}.`);
      else setError('Your account was created, but email delivery is unavailable. Try resending the code shortly.');
    } catch (requestError) {
      const payload = requestError?.response?.data;
      if (payload?.code === 'account_pending_deletion') {
        setPendingDeletedAccount(payload.deletion || {});
        setPreviousAccountPassword('');
        setForceDeleteConfirmation('');
        setDeletionActionError('');
        setError('');
      } else {
        setError(payload?.error || requestError.message || 'Unable to create account right now.');
      }
    } finally {
      setIsWorking(false);
    }
  };

  const resolveDeletedAccount = async (action) => {
    if (!previousAccountPassword || isHandlingDeletion) return;
    setIsHandlingDeletion(true);
    setDeletionActionError('');
    try {
      const response = await axios.post('/api/account_lifecycle.php', {
        action,
        email: accountForm.email.trim(),
        password: previousAccountPassword,
        confirmation: action === 'force_delete' ? forceDeleteConfirmation : '',
      }, { withCredentials: true });
      setPendingDeletedAccount(null);
      setPreviousAccountPassword('');
      setForceDeleteConfirmation('');
      if (action === 'recover') {
        setNotice(response.data?.message || 'Your previous account was restored. Sign in to continue.');
      } else {
        setNotice('Previous account deleted. Creating your new account…');
        window.setTimeout(() => document.getElementById('signup-account-form')?.requestSubmit(), 0);
      }
    } catch (requestError) {
      setDeletionActionError(requestError?.response?.data?.error || 'Unable to complete the account request.');
    } finally {
      setIsHandlingDeletion(false);
    }
  };

  const verifyEmailCode = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    setIsWorking(true);
    try {
      const response = await axios.post('/api/verify_user.php', {
        user_id: sessionUser?.user_id, code: verificationCode.trim(),
      }, { withCredentials: true });
      setNotice(response.data?.message || 'Email confirmed.');
      applyWizardState(response.data?.wizard, 2);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'That code could not be verified.');
    } finally {
      setIsWorking(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      const response = await axios.post('/api/resend_verification.php', {
        user_id: sessionUser?.user_id, email: sessionUser?.email,
      }, { withCredentials: true });
      if (response.data?.email_verification_skipped) {
        setNotice(response.data?.message || 'Email verification is skipped in the development environment.');
        applyWizardState(response.data?.wizard, 2);
      } else if (response.data?.email_sent) setNotice(response.data?.message || 'A new code is on its way.');
      else setError(response.data?.message || 'Email delivery is temporarily unavailable.');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Could not resend the code.');
    } finally {
      setIsWorking(false);
    }
  };

  const skipEmailVerification = async () => {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      const response = await axios.post('/api/onboarding_wizard.php', { action: 'skip_email_verification' }, { withCredentials: true });
      applyWizardState(response.data?.wizard, 2);
      setNotice('You can confirm your email later. Unconfirmed accounts have limited posting.');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to skip email confirmation right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const toggleAudience = (value) => {
    setAudienceIntents((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const saveAudience = async () => {
    setError('');
    if (!audienceIntents.length) {
      setError('Choose at least one option that describes what brings you here.');
      return;
    }
    const nextRoleIntent = primaryRoleForAudiences(audienceIntents);
    setIsWorking(true);
    try {
      const response = await axios.post('/api/onboarding_wizard.php', {
        action: 'set_role', role_intent: nextRoleIntent, audience_intents: audienceIntents,
      }, { withCredentials: true });
      setRoleIntent(nextRoleIntent);
      applyWizardState(response.data?.wizard, 3);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to save your choices.');
    } finally {
      setIsWorking(false);
    }
  };

  const toggleNeed = (value) => {
    setSelectedNeeds((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= MAX_NEEDS) return current;
      return [...current, value];
    });
  };

  const toggleCommunity = (id, community) => {
    setSelectedCommunityIds((current) => current.includes(id) ? current.filter((communityId) => communityId !== id) : [...current, id]);
    setSelectedCommunities((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = community;
      return next;
    });
  };

  const saveNeeds = async () => {
    setError('');
    if (!selectedNeeds.length) {
      setError('Choose at least one area, including “I’m not sure where to start.”');
      return;
    }
    setIsWorking(true);
    try {
      await axios.post('/api/onboarding_wizard.php', {
        action: 'set_interests', tags: tagsForNeeds(selectedNeeds), needs: selectedNeeds,
      }, { withCredentials: true });
      if (selectedCommunityIds.length) {
        await axios.post('/api/onboarding_wizard.php', {
          action: 'set_follows', community_ids: selectedCommunityIds,
        }, { withCredentials: true });
      }
      const response = await axios.post('/api/onboarding_wizard.php', { action: 'complete_primary_onboarding' }, { withCredentials: true });
      resultsRequestRef.current = false;
      applyWizardState(response.data?.wizard, 9);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to save what you need help with.');
    } finally {
      setIsWorking(false);
    }
  };

  const finishAndNavigate = async (path) => {
    setIsWorking(true);
    try {
      await axios.post('/api/onboarding_wizard.php', { action: 'complete_wizard' }, { withCredentials: true });
    } catch (requestError) {
      // Primary onboarding is already complete, so navigation can continue.
    } finally {
      setIsWorking(false);
      onLeaveOnboarding?.();
      navigate(path);
    }
  };

  const exitSetup = async () => {
    if (!sessionUser) {
      onContinueAsGuest?.();
      return;
    }
    try {
      const response = await axios.post('/api/onboarding_wizard.php', { action: 'exit_wizard' }, { withCredentials: true });
      applyWizardState(response.data?.wizard, step);
    } catch (requestError) {
      // Exiting is intentionally non-blocking.
    }
    onLeaveOnboarding?.();
    navigate('/home');
  };

  const handleVerificationFileChange = (setter) => (event) => setter(event.target.files?.[0] || null);

  const selectVerificationInstitution = (id, community) => {
    setVerificationInstitutionId(id);
    setSelectedCommunityIds([id]);
    setSelectedCommunities({ [id]: community });
  };

  const submitVerificationRequest = async () => {
    setError('');
    if (!['student', 'staff_representative'].includes(roleIntent)) {
      setError('Student or staff verification is available after selecting that relationship in your profile.');
      return;
    }
    if (!verificationInstitutionId) {
      setError('Select the school connected with this verification request.');
      return;
    }
    if (roleIntent === 'staff_representative' && !staffPosition.trim()) {
      setError('Enter your position or title.');
      return;
    }
    if (verificationMethod === 'id_photo' && (!verificationSelfieFile || !verificationIdFrontFile)) {
      setError('Add both a selfie holding your ID and a clear photo of the front of the ID.');
      return;
    }
    if (verificationMethod === 'tuition_statement' && !verificationDocumentFile) {
      setError('Add a current class schedule or billing statement.');
      return;
    }
    setIsWorking(true);
    try {
      const uploadDocument = async (file, documentType) => {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('document_type', documentType);
        const response = await axios.post('/api/upload_verification_document.php', formData, {
          withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (!response.data?.success || !response.data?.path) throw new Error(response.data?.error || 'Unable to upload a verification document.');
        return response.data.path;
      };
      let selfiePath = null;
      let idFrontPath = null;
      let supportingDocPath = null;
      if (verificationMethod === 'id_photo') {
        selfiePath = await uploadDocument(verificationSelfieFile, 'selfie_with_id');
        idFrontPath = await uploadDocument(verificationIdFrontFile, 'id_front');
      } else {
        supportingDocPath = await uploadDocument(verificationDocumentFile, 'supporting_doc');
      }
      await axios.post('/api/onboarding_wizard.php', {
        action: 'submit_verification_request',
        verification_type: roleIntent,
        verification_method: verificationMethod,
        community_id: verificationInstitutionId,
        staff_position: staffPosition.trim(),
        selfie_path: selfiePath,
        id_front_path: idFrontPath,
        supporting_doc_path: supportingDocPath,
      }, { withCredentials: true });
      setVerificationPending(true);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Unable to submit verification right now.');
    } finally {
      setIsWorking(false);
    }
  };

  const renderProgress = () => {
    const current = visibleStepNumber(step);
    return (
      <div className="signup-progress" aria-label={`Step ${current} of 4`}>
        <div className="signup-progress-track" aria-hidden><span style={{ width: `${((current - 1) / 3) * 100}%` }} /></div>
        <div className="signup-progress-steps" aria-hidden>
          {[1, 2, 3, 4].map((number) => (
            <span key={number} className={number <= current ? 'active' : ''}>{number < current ? <FaCheck /> : number}</span>
          ))}
        </div>
        <p>Step {current} of 4</p>
      </div>
    );
  };

  const renderVerification = () => {
    const supported = ['student', 'staff_representative'].includes(roleIntent);
    return (
      <div className="signup-verification">
        <div className="signup-verification-heading">
          <span><FaShieldAlt /> Optional verification</span>
          <h2>{verificationPending ? 'Your request is being reviewed' : 'Add context people can trust'}</h2>
          <p>Verification is separate from email confirmation. It can add a student or staff badge after an authorized reviewer approves the request.</p>
        </div>
        {error && <p ref={errorRef} tabIndex="-1" className="auth-error" role="alert">{error}</p>}
        {verificationPending ? (
          <div className="signup-verification-complete">
            <FaCheckCircle aria-hidden />
            <p>We will notify you when the review is complete. You can use StudentSphere while you wait.</p>
            <button type="button" className="auth-primary" onClick={() => navigate('/home')}>Go to home</button>
          </div>
        ) : !supported ? (
          <div className="signup-verification-complete">
            <p>Verification is currently available to enrolled students and school representatives.</p>
            <button type="button" className="auth-primary" onClick={() => navigate('/settings')}>Return to settings</button>
          </div>
        ) : (
          <div className="auth-form">
            <div className="signup-privacy-note">
              <FaShieldAlt aria-hidden />
              <p>Documents are not public. Access is limited to you and authorized StudentSphere reviewers. You can contact StudentSphere to request deletion.</p>
            </div>
            <UniversitySearch
              userId={sessionUser?.user_id}
              selectedIds={verificationInstitutionId ? [verificationInstitutionId] : []}
              onSelect={selectVerificationInstitution}
              multiSelect={false}
              inputId="verification-school-search"
            />
            {roleIntent === 'staff_representative' && (
              <div className="signup-field">
                <label htmlFor="staff-position">Position or title</label>
                <input id="staff-position" value={staffPosition} onChange={(event) => setStaffPosition(event.target.value)} placeholder="For example, admissions counselor" />
              </div>
            )}
            <div className="signup-field">
              <label htmlFor="verification-method">What can you provide?</label>
              <select id="verification-method" value={verificationMethod} onChange={(event) => setVerificationMethod(event.target.value)}>
                <option value="id_photo">Selfie with ID and front of ID</option>
                {roleIntent === 'student' && <option value="tuition_statement">Recent class schedule or billing statement</option>}
              </select>
            </div>
            {verificationMethod === 'id_photo' ? (
              <div className="signup-upload-grid">
                <label><span>Selfie holding your ID</span><input type="file" accept="image/*" onChange={handleVerificationFileChange(setVerificationSelfieFile)} /><small>{verificationSelfieFile?.name || 'Choose an image'}</small></label>
                <label><span>Front of your ID</span><input type="file" accept="image/*" onChange={handleVerificationFileChange(setVerificationIdFrontFile)} /><small>{verificationIdFrontFile?.name || 'Choose an image'}</small></label>
              </div>
            ) : (
              <label className="signup-file-field"><span>Schedule or billing statement from the last 90 days</span><input type="file" accept="image/*,application/pdf" onChange={handleVerificationFileChange(setVerificationDocumentFile)} /><small>{verificationDocumentFile?.name || 'Choose an image or PDF'}</small></label>
            )}
            <div className="signup-actions">
              <button type="button" className="auth-secondary" onClick={() => navigate('/settings')} disabled={isWorking}>Do this later</button>
              <button type="button" className="auth-primary" onClick={submitVerificationRequest} disabled={isWorking}>{isWorking ? 'Submitting…' : 'Submit for review'}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isBootstrapping) {
    return <main className="auth-welcome signup-onboarding"><div className="signup-loading" role="status">Preparing your starting point…</div></main>;
  }

  if (verificationMode && sessionUser) {
    return (
      <main className="auth-welcome signup-onboarding signup-onboarding--verification">
        <div className="auth-gradient" aria-hidden />
        <div className="signup-verification-shell">{renderVerification()}</div>
      </main>
    );
  }

  return (
    <main className="auth-welcome signup-onboarding">
      <div className="auth-gradient" aria-hidden />
      <div className="auth-content signup-shell">
        <aside className="auth-hero signup-story">
          <div className="signup-brand"><FaBookOpen aria-hidden /> TheStudentSphere</div>
          <div className="signup-story-illustration" aria-hidden><FaUniversity /></div>
          <span className="auth-pill">Guidance that moves with you</span>
          <h1>Built to help close the gaps in education.</h1>
          <p>Find clear answers, trusted people, and practical next steps.</p>
          <ul className="auth-benefits signup-benefits">
            <li><FaCompass /> Clear answers</li>
            <li><FaUsers /> Trusted people</li>
            <li><FaArrowRight /> Practical next steps</li>
          </ul>
          <div className="signup-story-actions">
            {!sessionUser && <button type="button" className="auth-secondary" onClick={onShowLogin}>I already have an account</button>}
            <button type="button" className="auth-ghost" onClick={exitSetup}>{sessionUser ? 'Continue later' : 'Explore as a guest'}</button>
          </div>
        </aside>

        <section className="auth-panel signup-panel">
          {renderProgress()}
          <div className="signup-step-copy">
            <h2>
              {step === 0 && 'Create your account'}
              {step === 1 && 'Confirm your email'}
              {step === 2 && 'What brings you here?'}
              {step === 3 && 'What would you like help navigating?'}
              {step === 9 && `A starting point for you${sessionUser?.first_name ? `, ${sessionUser.first_name}` : ''}`}
            </h2>
            <p>
              {step === 0 && 'Join a community built to help you navigate education.'}
              {step === 1 && 'Email confirmation protects your account and unlocks normal participation.'}
              {step === 2 && 'Choose any that apply. You can change this later.'}
              {step === 3 && `Choose up to ${MAX_NEEDS}. You can change these later.`}
              {step === 9 && 'Start with a useful answer, a relevant community, or someone who can help.'}
            </p>
          </div>
          {error && <p ref={errorRef} tabIndex="-1" className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-success" role="status">{notice}</p>}

          {step === 0 && (
            <form id="signup-account-form" className="auth-form signup-account-form" onSubmit={createAccount} noValidate>
              <p className="signup-form-context">Your name identifies your contributions. Your email is used to secure your account and is not shown publicly by default.</p>
              <div className="auth-input-grid">
                <div className="signup-field"><label htmlFor="signup-first-name">First name</label><input id="signup-first-name" autoComplete="given-name" value={accountForm.firstName} onChange={(event) => setAccountForm((current) => ({ ...current, firstName: event.target.value }))} required /></div>
                <div className="signup-field"><label htmlFor="signup-last-name">Last name</label><input id="signup-last-name" autoComplete="family-name" value={accountForm.lastName} onChange={(event) => setAccountForm((current) => ({ ...current, lastName: event.target.value }))} required /></div>
              </div>
              <div className="signup-field"><label htmlFor="signup-email">Email address</label><input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} required /></div>
              <div className="signup-field"><label htmlFor="signup-password">Password</label><input id="signup-password" type="password" autoComplete="new-password" minLength={10} maxLength={72} value={accountForm.password} onChange={(event) => { setAccountForm((current) => ({ ...current, password: event.target.value })); if (passwordFeedback.field === 'password') setPasswordFeedback({ field: '', message: '', nonce: 0 }); }} aria-describedby="signup-password-help" aria-invalid={passwordFeedback.field === 'password'} required /><p key={passwordFeedback.field === 'password' ? passwordFeedback.nonce : 'password-help'} id="signup-password-help" className={`signup-field-help auth-requirement${passwordFeedback.field === 'password' ? ' is-invalid' : ''}`} role={passwordFeedback.field === 'password' ? 'alert' : undefined}>{passwordFeedback.field === 'password' ? passwordFeedback.message : 'Use 10–72 characters. A long passphrase works well.'}</p></div>
              <div className="signup-field"><label htmlFor="signup-confirm-password">Confirm password</label><input id="signup-confirm-password" type="password" autoComplete="new-password" minLength={10} maxLength={72} value={accountForm.confirmPassword} onChange={(event) => { setAccountForm((current) => ({ ...current, confirmPassword: event.target.value })); if (passwordFeedback.field === 'confirm') setPasswordFeedback({ field: '', message: '', nonce: 0 }); }} aria-describedby={passwordFeedback.field === 'confirm' ? 'signup-confirm-password-help' : undefined} aria-invalid={passwordFeedback.field === 'confirm'} required />{passwordFeedback.field === 'confirm' && <p key={passwordFeedback.nonce} id="signup-confirm-password-help" className="signup-field-help auth-requirement is-invalid" role="alert">{passwordFeedback.message}</p>}</div>
              <button type="submit" className="auth-primary" disabled={isWorking}>{isWorking ? 'Creating your account…' : 'Create account'}</button>
              <button type="button" className="auth-link signup-mobile-login" onClick={onShowLogin}>Already have an account? Sign in</button>
            </form>
          )}

          {step === 1 && (
            <form className="auth-form signup-code-form" onSubmit={verifyEmailCode}>
              <div className="signup-field"><label htmlFor="signup-verification-code">Six-digit confirmation code</label><input id="signup-verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" /></div>
              <button type="submit" className="auth-primary" disabled={isWorking}>{isWorking ? 'Confirming…' : 'Confirm email'}</button>
              <div className="signup-link-row"><button type="button" className="auth-link" onClick={resendCode} disabled={isWorking}>Send a new code</button><button type="button" className="auth-link subtle" onClick={skipEmailVerification} disabled={isWorking}>Confirm later</button></div>
              <button type="button" className="auth-ghost signup-continue-later" onClick={exitSetup} disabled={isWorking}>Continue later</button>
            </form>
          )}

          {step === 2 && (
            <div className="auth-form">
              <div className="signup-choice-grid signup-audience-grid">
                {AUDIENCE_OPTIONS.map((option) => {
                  const selected = audienceIntents.includes(option.value);
                  const Icon = AUDIENCE_ICONS[option.value];
                  return (
                    <button type="button" key={option.value} className={`signup-choice signup-choice--${option.tone}${selected ? ' selected' : ''}`} onClick={() => toggleAudience(option.value)} aria-pressed={selected}>
                      <span className="signup-choice-icon"><Icon aria-hidden /></span>
                      <span className="signup-choice-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                      <span className="signup-choice-check" aria-hidden>{selected && <FaCheck />}</span>
                    </button>
                  );
                })}
              </div>
              <div className="signup-actions"><button type="button" className="auth-secondary" onClick={() => changeStep(1)} disabled={isWorking}>Back</button><div className="signup-actions-main"><button type="button" className="auth-ghost" onClick={exitSetup} disabled={isWorking}>Continue later</button><button type="button" className="auth-primary" onClick={saveAudience} disabled={isWorking}>{isWorking ? 'Saving…' : 'Continue'}</button></div></div>
            </div>
          )}

          {step === 3 && (
            <div className="auth-form">
              <div className="signup-needs-grid">
                {NEED_OPTIONS.map((option) => {
                  const selected = selectedNeeds.includes(option.value);
                  return <button type="button" key={option.value} className={`signup-need${selected ? ' selected' : ''}`} onClick={() => toggleNeed(option.value)} aria-pressed={selected}><span>{option.label}</span><span className="signup-choice-check" aria-hidden>{selected && <FaCheck />}</span></button>;
                })}
              </div>
              <p className="signup-selection-count" aria-live="polite">{selectedNeeds.length} of {MAX_NEEDS} selected</p>
              <details className="signup-optional-school">
                <summary>Add a school or program (optional)</summary>
                <UniversitySearch userId={sessionUser?.user_id} selectedIds={selectedCommunityIds} onToggle={toggleCommunity} />
                {selectedCommunityIds.length > 0 && <div className="signup-selected-schools">{selectedCommunityIds.map((id) => <span key={id}>{selectedCommunities[id]?.name || 'Selected school'}</span>)}</div>}
              </details>
              <div className="signup-actions"><button type="button" className="auth-secondary" onClick={() => changeStep(2)} disabled={isWorking}>Back</button><div className="signup-actions-main"><button type="button" className="auth-ghost" onClick={exitSetup} disabled={isWorking}>Continue later</button><button type="button" className="auth-primary" onClick={saveNeeds} disabled={isWorking}>{isWorking ? 'Building your starting point…' : 'Show my starting point'}</button></div></div>
            </div>
          )}

          {step === 9 && (
            <div className="auth-form signup-results">
              {isLoadingResults ? <div className="signup-results-loading" role="status">Finding useful guides and people…</div> : (
                <>
                  <section className="signup-result-section" aria-labelledby="signup-guides-title">
                    <div className="signup-result-heading"><div><span>Clear answers</span><h3 id="signup-guides-title">Guides selected for your needs</h3></div><button type="button" className="auth-link" onClick={() => finishAndNavigate('/info')}>Browse all guides</button></div>
                    <div className="signup-guide-list">
                      {recommendations.map((article) => <button type="button" className="signup-guide-card" key={article.thread_id} onClick={() => finishAndNavigate(`/info/forum/${article.forum_id}/thread/${article.thread_id}`)}><FaBookOpen aria-hidden /><span><strong>{article.title}</strong><small>{article.excerpt || 'Read practical guidance and next steps.'}</small></span><FaArrowRight aria-hidden /></button>)}
                      {!recommendations.length && <button type="button" className="signup-guide-card" onClick={() => finishAndNavigate('/info')}><FaBookOpen aria-hidden /><span><strong>Explore Guides & Answers</strong><small>Find plain-language guidance across education topics.</small></span><FaArrowRight aria-hidden /></button>}
                    </div>
                  </section>
                  <div className="signup-next-step-grid">
                    <section className="signup-next-step-card"><FaUniversity aria-hidden /><span><small>Explore a community</small><strong>{selectedCommunities[selectedCommunityIds[0]]?.name || 'Find your school or program'}</strong><p>See questions, lived experience, events, and community resources.</p></span><button type="button" className="auth-link" onClick={() => finishAndNavigate('/communities')}>Browse communities</button></section>
                    <section className="signup-next-step-card signup-next-step-card--people"><FaUsers aria-hidden /><span><small>Trusted people</small><strong>{recommendedAmbassador ? `${recommendedAmbassador.first_name} ${recommendedAmbassador.last_name}` : 'Find someone who understands'}</strong><p>{recommendedAmbassador ? `${recommendedAmbassador.headline || 'Community ambassador'} can help you find the right next step.` : 'Connect with students, alumni, ambassadors, and professionals.'}</p></span><button type="button" className="auth-link" onClick={() => finishAndNavigate(ambassadorMessageDestination(recommendedAmbassador))}>{recommendedAmbassador ? `Message ${recommendedAmbassador.first_name}` : 'Find someone to ask'}</button></section>
                  </div>
                  <div className="signup-completion-note"><FaShieldAlt aria-hidden /><p>Profile details and student or staff verification can be completed later from Account Settings.</p></div>
                  <button type="button" className="auth-primary signup-finish" onClick={() => finishAndNavigate('/home')} disabled={isWorking}>{isWorking ? 'Opening StudentSphere…' : 'Go to my home'}</button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      {pendingDeletedAccount && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pending-account-title">
          <div className="modal-content signup-deleted-account-modal">
            <h3 id="pending-account-title">This email belongs to an account awaiting deletion</h3>
            <p><strong>{pendingDeletedAccount.days_remaining || 0} day{Number(pendingDeletedAccount.days_remaining) === 1 ? '' : 's'} remain</strong> in its recovery window. You can wait, restore the old account, or permanently delete it now and create a new one.</p>
            <p className="signup-field-help">To prove ownership, enter the password from the previous account.</p>
            <label htmlFor="previous-account-password">Previous account password</label>
            <input id="previous-account-password" type="password" autoComplete="current-password" value={previousAccountPassword} onChange={(event) => setPreviousAccountPassword(event.target.value)} disabled={isHandlingDeletion} autoFocus />
            {deletionActionError && <p className="auth-error" role="alert">{deletionActionError}</p>}
            <label htmlFor="signup-force-delete-confirmation">To permanently delete it, type <strong>DELETE NOW</strong></label>
            <input id="signup-force-delete-confirmation" type="text" autoComplete="off" value={forceDeleteConfirmation} onChange={(event) => setForceDeleteConfirmation(event.target.value)} disabled={isHandlingDeletion} />
            <div className="signup-deleted-account-actions">
              <button type="button" className="auth-link" onClick={() => { setPendingDeletedAccount(null); setPreviousAccountPassword(''); setDeletionActionError(''); setForceDeleteConfirmation(''); }} disabled={isHandlingDeletion}>Wait until deletion</button>
              <button type="button" className="auth-secondary" onClick={() => resolveDeletedAccount('recover')} disabled={!previousAccountPassword || isHandlingDeletion}>Recover old account</button>
              <button type="button" className="auth-primary signup-force-delete" onClick={() => resolveDeletedAccount('force_delete')} disabled={!previousAccountPassword || forceDeleteConfirmation !== 'DELETE NOW' || isHandlingDeletion}>{isHandlingDeletion ? 'Working…' : 'Delete now & create new'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default SignUp;
