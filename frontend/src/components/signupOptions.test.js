import {
  ambassadorMessageDestination,
  recommendAmbassador,
  needsForTags,
  primaryRoleForAudiences,
  rankGuideRecommendations,
  tagsForNeeds,
} from './signupOptions';

describe('signup onboarding options', () => {
  test('keeps permission roles separate while choosing a primary audience role', () => {
    expect(primaryRoleForAudiences(['supporting_student'])).toBe('prospect');
    expect(primaryRoleForAudiences(['exploring', 'currently_enrolled'])).toBe('student');
    expect(primaryRoleForAudiences(['previously_attended', 'school_professional'])).toBe('staff_representative');
  });

  test('maps user needs to the existing tag system', () => {
    expect(tagsForNeeds(['financial_aid', 'scholarships', 'financial_aid'])).toEqual([
      'financial-aid',
      'scholarships',
    ]);
    expect(needsForTags(['financial-aid', 'housing-&-dining'])).toContain('financial_aid');
  });

  test('ranks guides by selected needs and preserves a useful fallback', () => {
    const articles = [
      { title: 'Campus traditions', excerpt: 'Find your community.' },
      { title: 'Understanding your financial aid offer', excerpt: 'Review grants and loans.' },
      { title: 'Completing an application', excerpt: 'Prepare to apply.' },
    ];
    const recommendations = rankGuideRecommendations(articles, ['financial_aid'], 2);
    expect(recommendations[0].title).toContain('financial aid');
    expect(recommendations).toHaveLength(2);
  });

  test('keeps the recommended ambassador attached to the message handoff', () => {
    expect(ambassadorMessageDestination({ user_id: 'u123abc' })).toBe('/messages?user=u123abc');
    expect(ambassadorMessageDestination(null)).toBe('/communities');
  });

  test('only recommends opted-in ambassadors whose specialties match the request', () => {
    const ambassadors = [
      { user_id: 'u-busy', ambassador_accepting_questions: false, ambassador_specialties: ['applications'] },
      { user_id: 'u-general', ambassador_accepting_questions: true, ambassador_specialties: ['peer-support'] },
      { user_id: 'u-limited', ambassador_accepting_questions: true, availability: 'limited', ambassador_specialties: ['applications'] },
      { user_id: 'u-admissions', ambassador_accepting_questions: true, ambassador_specialties: ['applications'] },
    ];
    expect(recommendAmbassador(ambassadors, ['applying'])?.user_id).toBe('u-admissions');
    expect(recommendAmbassador(ambassadors, ['wellbeing'])).toBeNull();
  });
});
