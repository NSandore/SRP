import {
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
});
