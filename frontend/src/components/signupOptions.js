export const AUDIENCE_OPTIONS = [
  {
    value: 'exploring',
    roleIntent: 'prospect',
    label: "I'm exploring schools or programs",
    description: 'Compare pathways, requirements, and what to expect.',
    tone: 'blue',
  },
  {
    value: 'currently_enrolled',
    roleIntent: 'student',
    label: "I'm currently enrolled",
    description: 'Find guidance for classes, campus life, and support.',
    tone: 'violet',
  },
  {
    value: 'previously_attended',
    roleIntent: 'alumni',
    label: 'I previously attended or graduated',
    description: 'Share experience and stay connected to a community.',
    tone: 'green',
  },
  {
    value: 'supporting_student',
    roleIntent: 'prospect',
    label: "I'm supporting a student or family member",
    description: 'Understand the process and help someone move forward.',
    tone: 'violet',
  },
  {
    value: 'school_professional',
    roleIntent: 'staff_representative',
    label: 'I work for a school or educational organization',
    description: 'Clarify information and connect people with resources.',
    tone: 'blue',
  },
  {
    value: 'mentor_resource',
    roleIntent: 'prospect',
    label: "I'm a mentor, professional, or community resource",
    description: 'Offer practical guidance and support to learners.',
    tone: 'green',
  },
];

export const NEED_OPTIONS = [
  { value: 'applying', label: 'Applying to a school or program', tag: 'applications', keywords: ['apply', 'application', 'admission'] },
  { value: 'financial_aid', label: 'Understanding financial aid', tag: 'financial-aid', keywords: ['financial aid', 'fafsa', 'loan', 'grant'] },
  { value: 'scholarships', label: 'Finding scholarships', tag: 'scholarships', keywords: ['scholarship', 'award', 'funding'] },
  { value: 'paying', label: 'Paying for school', tag: 'paying-for-school', keywords: ['cost', 'tuition', 'pay', 'billing', 'afford'] },
  { value: 'program_major', label: 'Choosing a program or major', tag: 'academics', keywords: ['major', 'program', 'degree', 'course'] },
  { value: 'basic_needs', label: 'Housing, food, or transportation', tag: 'housing-and-dining', keywords: ['housing', 'food', 'dining', 'transportation', 'commut'] },
  { value: 'academic_support', label: 'Academic support', tag: 'academic-support', keywords: ['tutor', 'academic support', 'study', 'advisor'] },
  { value: 'accessibility', label: 'Disability and accessibility services', tag: 'disability-and-accessibility', keywords: ['disability', 'accessibility', 'accommodation'] },
  { value: 'wellbeing', label: 'Mental health and wellbeing', tag: 'mental-health-and-wellness', keywords: ['mental health', 'wellness', 'counsel'] },
  { value: 'student_rights', label: 'Student rights or institutional policies', tag: 'student-rights-and-policies', keywords: ['student rights', 'policy', 'appeal', 'complaint', 'title ix'] },
  { value: 'careers', label: 'Internships and careers', tag: 'career-services', keywords: ['career', 'internship', 'job', 'resume'] },
  { value: 'shared_experience', label: 'Finding people who understand my experience', tag: 'peer-support', keywords: ['community', 'belong', 'first-generation', 'experience'] },
  { value: 'not_sure', label: "I'm not sure where to start", tag: 'getting-started', keywords: ['start', 'college', 'education', 'school'] },
];

export const AMBASSADOR_SPECIALTY_OPTIONS = NEED_OPTIONS.map(({ tag, label }) => ({
  value: tag,
  label: label
    .replace('Applying to a school or program', 'Admissions & applications')
    .replace('Understanding financial aid', 'Financial aid')
    .replace('Finding scholarships', 'Scholarships')
    .replace('Paying for school', 'Tuition & billing')
    .replace('Choosing a program or major', 'Programs & majors')
    .replace('Housing, food, or transportation', 'Housing & basic needs')
    .replace('Disability and accessibility services', 'Accessibility services')
    .replace('Mental health and wellbeing', 'Wellbeing resources')
    .replace('Student rights or institutional policies', 'Student rights & policies')
    .replace('Internships and careers', 'Careers & internships')
    .replace('Finding people who understand my experience', 'Peer support')
    .replace("I'm not sure where to start", 'Getting started'),
}));

export const getAmbassadorSpecialtyLabel = (value) =>
  AMBASSADOR_SPECIALTY_OPTIONS.find((option) => option.value === value)?.label || value;

export const recommendAmbassador = (ambassadors = [], needValues = []) => {
  const desiredSpecialties = new Set(tagsForNeeds(needValues));
  if (!desiredSpecialties.size) return null;

  const ranked = ambassadors
    .filter((ambassador) =>
      ambassador?.ambassador_accepting_questions !== false && ambassador?.availability !== 'limited'
    )
    .map((ambassador, index) => {
      const specialties = Array.isArray(ambassador?.ambassador_specialties)
        ? ambassador.ambassador_specialties
        : [];
      const matchCount = specialties.filter((specialty) => desiredSpecialties.has(specialty)).length;
      return { ambassador, matchCount, index };
    })
    .filter(({ matchCount }) => matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || a.index - b.index);

  return ranked[0]?.ambassador || null;
};

const ROLE_PRIORITY = ['student', 'staff_representative', 'alumni', 'prospect'];

export const primaryRoleForAudiences = (audienceValues = []) => {
  const roles = audienceValues
    .map((value) => AUDIENCE_OPTIONS.find((option) => option.value === value)?.roleIntent)
    .filter(Boolean);
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || 'prospect';
};

export const tagsForNeeds = (needValues = []) => Array.from(new Set(
  needValues
    .map((value) => NEED_OPTIONS.find((option) => option.value === value)?.tag)
    .filter(Boolean)
));

export const needsForTags = (tagValues = []) => {
  const normalized = new Set(tagValues.map((value) => String(value).toLowerCase().replace(/&/g, 'and')));
  return NEED_OPTIONS
    .filter((option) => normalized.has(option.tag))
    .map((option) => option.value);
};

export const ambassadorMessageDestination = (ambassador) => {
  const userId = String(ambassador?.user_id || '').trim();
  return userId ? `/messages?user=${encodeURIComponent(userId)}` : '/communities';
};

export const rankGuideRecommendations = (articles = [], needValues = [], limit = 3) => {
  const keywords = NEED_OPTIONS
    .filter((option) => needValues.includes(option.value))
    .flatMap((option) => option.keywords);

  const scored = articles.map((article, index) => {
    const title = String(article?.title || '').toLowerCase();
    const excerpt = String(article?.excerpt || '').toLowerCase();
    const score = keywords.reduce((total, keyword) => {
      const normalized = keyword.toLowerCase();
      return total + (title.includes(normalized) ? 4 : 0) + (excerpt.includes(normalized) ? 1 : 0);
    }, 0);
    return { article, score, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map(({ article }) => article);
};
