import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ResolutionFeedback.css';

const choices = {
  helpful: [['yes','Yes'],['no','Not really']],
  resolved: [['yes','Yes'],['partly','Partly'],['no','No']],
  knows_next_step: [['yes','Yes'],['unsure','Not sure'],['no','No']],
};

export default function ResolutionFeedback({ postId, isLoggedIn, onRequireAuth }) {
  const [form, setForm] = useState({ helpful:'', resolved:'', knows_next_step:'', missing_reason:'', missing_note:'' });
  const [status, setStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(Boolean(isLoggedIn));
  useEffect(() => {
    if (!postId || !isLoggedIn) return;
    setLoading(true);
    axios.get('/api/fetch_content_feedback.php', { params:{ post_id:postId }, withCredentials:true })
      .then(({data}) => { if (data.feedback) setSubmitted(true); }).catch(() => {}).finally(() => setLoading(false));
  }, [postId, isLoggedIn]);
  const choose = (field, value) => setForm((prev) => ({...prev, [field]:value}));
  const submit = async () => {
    if (!isLoggedIn) { onRequireAuth?.(); return; }
    if (!form.helpful || !form.resolved || !form.knows_next_step) { setStatus('Please answer the three quick questions.'); return; }
    setStatus('Saving…');
    try {
      const {data} = await axios.post('/api/submit_content_feedback.php', { post_id:postId, ...form }, {withCredentials:true});
      setStatus(data.message || 'Thanks for your feedback.');
      setSubmitted(true);
    } catch (error) { setStatus(error.response?.data?.error || 'Unable to save feedback.'); }
  };
  const unresolved = form.resolved !== 'yes' || form.knows_next_step !== 'yes';
  if (loading) return null;
  if (submitted) return <section className="resolution-feedback resolution-feedback--complete" role="status"><strong>Thanks — your private article feedback was recorded.</strong></section>;
  return <section className="resolution-feedback" aria-labelledby={`feedback-${postId}`}>
    <div className="resolution-feedback__heading"><p className="resolution-feedback__kicker">Article feedback</p><h3 id={`feedback-${postId}`}>Did this article help?</h3><span>Private</span></div>
    <div className="resolution-feedback__questions">{[
      ['helpful','Helpful?'],
      ['resolved','Answered?'],
      ['knows_next_step','Next step clear?'],
    ].map(([field,label]) => <fieldset key={field}><legend>{label}</legend><div className="resolution-feedback__choices">{choices[field].map(([value,text]) => <button type="button" key={value} className={form[field]===value?'selected':''} onClick={() => choose(field,value)} aria-pressed={form[field]===value}>{text}</button>)}</div></fieldset>)}</div>
    {unresolved && (form.resolved || form.knows_next_step) ? <div className="resolution-feedback__followup"><label htmlFor={`missing-${postId}`}>What is still missing? <span>Optional</span></label><select id={`missing-${postId}`} value={form.missing_reason} onChange={(e)=>choose('missing_reason',e.target.value)}><option value="">Choose one</option><option value="more_detail">More detail</option><option value="clearer_steps">Clearer next steps</option><option value="institution_specific">Information for my institution</option><option value="source_or_contact">A source or person to contact</option><option value="personal_help">Help with my situation</option><option value="other">Something else</option></select><textarea value={form.missing_note || ''} onChange={(e)=>choose('missing_note',e.target.value)} maxLength={500} rows={2} placeholder="Tell us what would make this more useful." /></div> : null}
    <div className="resolution-feedback__footer"><button type="button" onClick={submit}>{isLoggedIn ? 'Send feedback' : 'Log in to respond'}</button><span role="status">{status}</span></div>
  </section>;
}
