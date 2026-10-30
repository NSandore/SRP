<?php

declare(strict_types=1);

/**
 * Run with: php backend/tests/institution_foundation_test.php
 */

require_once __DIR__ . '/institution_test_helpers.php';
require_once __DIR__ . '/../includes/institution_data/bootstrap.php';

$test = new SrpInstitutionTestHarness();

// Scalar and matching normalization.
$test->same(
    'name normalization handles The, ampersands, punctuation, and abbreviations',
    'a and m university',
    SrpInstitutionNormalizer::name('The A&M Univ.')
);
$test->same(
    'official domains drop protocol, www, path, and case',
    'example.edu',
    SrpInstitutionNormalizer::domain('HTTPS://WWW.Example.EDU/admissions/')
);
$test->same(
    'bare official website receives HTTPS',
    'https://example.edu',
    SrpInstitutionNormalizer::field('website', 'example.edu/')
);
$test->same('UNITID is left padded', '000123', SrpInstitutionNormalizer::unitId('123'));
$test->same('OPE6 becomes an OPE8 main-campus code', '00142600', SrpInstitutionNormalizer::opeId('001426'));
$test->same('full state name normalizes', 'CT', SrpInstitutionNormalizer::state('Connecticut'));
$test->same('unknown boolean code stays unknown', null, SrpInstitutionNormalizer::boolean('2'));
$test->same('invalid credentialed URL is rejected', null, SrpInstitutionNormalizer::url('https://user:pass@example.edu'));

// A legacy row may hold an entire delimited alias blob as one list entry. That
// value is longer than any real name and must not discard the institution.
$legacyAliasBlob = str_repeat('Alias Name Number Seven/', 20) . 'Final Alias';
$repairedAliases = SrpInstitutionNormalizer::field('aliases', [$legacyAliasBlob]);
$test->same(
    'an over-long legacy alias entry is split instead of failing the record',
    true,
    is_array($repairedAliases) && count($repairedAliases) >= 2
);
$test->same(
    'a split legacy alias keeps a usable individual name',
    true,
    is_array($repairedAliases) && in_array('Final Alias', $repairedAliases, true)
);
$test->same(
    'a repaired alias list stays bounded',
    true,
    is_array($repairedAliases) && count($repairedAliases) <= 50
);
$test->same(
    'a normal alias list is unchanged',
    ['Regis', 'Regis College'],
    SrpInstitutionNormalizer::field('aliases', ['Regis', 'Regis College'])
);

// Color formats and the explicit Pantone non-conversion rule.
$test->same('three-digit hex expands', '#336699', SrpInstitutionColor::normalize('#369'));
$test->same('RGB normalizes', '#003366', SrpInstitutionColor::normalize('rgb(0, 51, 102)'));
$test->same('RGBA normalizes the underlying channels', '#003366', SrpInstitutionColor::normalize('rgba(0, 51, 102, .8)'));
$test->same('HSL normalizes', '#003366', SrpInstitutionColor::normalize('hsl(210, 100%, 20%)'));
$test->same('CSS named color normalizes', '#000080', SrpInstitutionColor::normalize('navy'));
$test->same('Pantone is never guessed', null, SrpInstitutionColor::normalize('PANTONE 186 C'));
$pantone = SrpInstitutionColor::parse('PMS 186 C');
$test->same('Pantone result explains why it was rejected', 'pantone_conversion_requires_a_cited_source', $pantone['reason']);

// JSON validation, deterministic encoding, and bounded candidate deduplication.
$test->same(
    'empty metadata encodes as a JSON object',
    '{}',
    SrpInstitutionJson::encodeColumn('data_sources_json', [])
);
$test->throws(
    'malformed JSON is rejected',
    static fn () => SrpInstitutionJson::decodeColumn('data_sources_json', '{"bad"'),
    InvalidArgumentException::class,
    'malformed JSON'
);
$test->throws(
    'out-of-range confidence is rejected',
    static fn () => SrpInstitutionJson::validateColumn(
        'data_confidence_json',
        ['website' => 1.1]
    ),
    InvalidArgumentException::class,
    'between 0 and 1'
);

$candidates = [];
$candidate = [
    'value' => '#003366',
    'source_type' => 'official_brand_guide',
    'source_url' => 'https://example.edu/brand',
    'source_record_id' => 'brand-2026',
    'retrieved_at' => '2026-08-06T00:00:00Z',
    'confidence' => 1.0,
];
$candidates = SrpInstitutionJson::addCandidate(
    $candidates,
    'primary_color',
    $candidate,
    3
);
$candidate['retrieved_at'] = '2026-08-07T00:00:00Z';
$candidates = SrpInstitutionJson::addCandidate(
    $candidates,
    'primary_color',
    $candidate,
    3
);
$test->same(
    'same value and source is deduplicated across refreshes',
    1,
    count($candidates['primary_color'])
);
$test->same(
    'deduplicated candidate keeps refreshed metadata',
    '2026-08-07T00:00:00Z',
    $candidates['primary_color'][0]['retrieved_at']
);
foreach (['#112233', '#223344', '#334455', '#445566'] as $index => $value) {
    $candidates = SrpInstitutionJson::addCandidate(
        $candidates,
        'primary_color',
        [
            'value' => $value,
            'source_type' => 'third_party_dataset',
            'source_record_id' => 'third-' . $index,
            'confidence' => 0.5,
        ],
        3
    );
}
$test->same('candidate retention is bounded', 3, count($candidates['primary_color']));

// Deterministic source priority and manual-override behavior.
$test->check(
    'source priority is deterministic',
    SrpInstitutionFieldPolicy::sourcePriority('manual_verified')
        > SrpInstitutionFieldPolicy::sourcePriority('ipeds')
    && SrpInstitutionFieldPolicy::sourcePriority('ipeds')
        > SrpInstitutionFieldPolicy::sourcePriority('college_scorecard')
    && SrpInstitutionFieldPolicy::sourcePriority('college_scorecard')
        > SrpInstitutionFieldPolicy::sourcePriority('third_party_dataset')
);

$manualMetadata = [
    'manual_overrides_json' => [
        'website' => [
            'value' => 'https://admin.example.edu',
            'notes' => 'Verified by the institution.',
            'verified_by' => 'u-admin',
            'verified_at' => '2026-08-06T00:00:00Z',
            'expires_at' => null,
        ],
    ],
];
$manual = SrpInstitutionResolver::resolveField(
    'website',
    'https://legacy.example.edu',
    [
        'value' => 'https://directory.example.edu',
        'source_type' => 'ipeds',
        'confidence' => 0.95,
    ],
    $manualMetadata
);
$test->same('manual override always wins', 'https://admin.example.edu', $manual['value']);
$test->same('manual override confidence is one', 1.0, $manual['confidence']);
$test->same('automated candidate was not selected over override', false, $manual['selected']);

$higherQuality = SrpInstitutionResolver::resolveField(
    'primary_color',
    '#990000',
    [
        'value' => '#9E1B32',
        'source_type' => 'official_brand_guide',
        'source_url' => 'https://example.edu/brand',
        'confidence' => 1.0,
    ],
    [
        'data_sources_json' => [
            'primary_color' => ['source_type' => 'third_party_dataset'],
        ],
        'data_confidence_json' => ['primary_color' => 0.5],
    ]
);
$test->same('higher-priority source replaces lower-priority value', '#9E1B32', $higherQuality['value']);
$test->same('higher-priority replacement is marked changed', true, $higherQuality['changed']);

$nullCandidate = SrpInstitutionResolver::resolveField(
    'official_name',
    'Existing Official Name',
    ['value' => null, 'source_type' => 'ipeds']
);
$test->same('null source value never clears existing data', 'Existing Official Name', $nullCandidate['value']);
$test->same('null source value is not selected', false, $nullCandidate['selected']);

// Matcher accepts the common source envelope and follows the documented order.
$rows = [
    [
        'id' => 'c-unitid',
        'community_type' => 'university',
        'name' => 'Unit ID University',
        'ipeds_unitid' => '100751',
        'website' => 'https://unitid.edu',
        'city' => 'Tuscaloosa',
        'state' => 'AL',
    ],
    [
        'id' => 'c-domain',
        'community_type' => 'university',
        'name' => 'Domain College',
        'website' => 'https://www.domain.edu/',
        'city' => 'Hartford',
        'state' => 'CT',
    ],
    [
        'id' => 'c-geography',
        'community_type' => 'university',
        'name' => 'Geography Institute',
        'city' => 'New Haven',
        'state' => 'CT',
    ],
    [
        'id' => 'c-legacy-location',
        'community_type' => 'university',
        'name' => 'Legacy Location College',
        'location' => '100 College Street, New Haven, CT, 06510',
    ],
];
$matcher = SrpInstitutionMatcher::buildIndex($rows);
$exact = $matcher->match([
    'source' => 'ipeds',
    'source_record_id' => '100751',
    'retrieved_at' => '2026-08-06T00:00:00Z',
    'match' => [
        'ipeds_unitid' => '100751',
        'ope_id' => null,
        'normalized_domain' => null,
        'name' => 'Unit ID University',
        'city' => 'Tuscaloosa',
        'state' => 'AL',
    ],
    'fields' => [],
    'raw_metadata' => [],
]);
$test->same('envelope exact UNITID match selects row', 'c-unitid', $exact['row']['id'] ?? null);
$test->same('envelope exact match reports UNITID method', 'unitid', $exact['method']);

$domain = $matcher->match([
    'match' => [
        'normalized_domain' => 'www.domain.edu',
        'name' => 'Domain College',
        'city' => 'Hartford',
        'state' => 'CT',
    ],
]);
$test->same('exact domain match selects row', 'c-domain', $domain['row']['id'] ?? null);
$test->same('exact domain match reports method', 'domain', $domain['method']);

$nameGeography = $matcher->match([
    'match' => [
        'name' => 'The Geography Institute',
        'city' => 'New Haven',
        'state' => 'Connecticut',
    ],
]);
$test->same(
    'normalized name, city, and state match selects row',
    'c-geography',
    $nameGeography['row']['id'] ?? null
);
$test->same('name geography reports method', 'name_city_state', $nameGeography['method']);

$legacyLocation = $matcher->match([
    'source' => 'ipeds',
    'source_record_id' => '199999',
    'retrieved_at' => '2026-08-06T00:00:00Z',
    'match' => [
        'ipeds_unitid' => '199999',
        'ope_id' => null,
        'normalized_domain' => null,
        'name' => 'Legacy Location College',
        'city' => 'New Haven',
        'state' => 'CT',
    ],
    'fields' => [],
    'raw_metadata' => [],
]);
$test->same(
    'legacy trailing location geography supports exact envelope match',
    'c-legacy-location',
    $legacyLocation['row']['id'] ?? null
);
$test->same(
    'legacy location match reports name-city-state method',
    'name_city_state',
    $legacyLocation['method']
);

$weakFuzzy = $matcher->match([
    'match' => [
        'name' => 'Completely Unrelated Academy',
        'city' => 'New Haven',
        'state' => 'CT',
    ],
]);
$test->same('weak fuzzy name is rejected', null, $weakFuzzy['row']);

// Multi-campus systems publish one domain for every campus. A shared domain
// must not abandon the record; it falls through to exact name, city, and state.
$campusRows = [
    [
        'id' => 'c-campus-montgomery',
        'community_type' => 'university',
        'name' => 'South University-Montgomery',
        'website' => 'https://www.southuniversity.edu/',
        'location' => '5355 Vaughn Rd, Montgomery, AL, 36116',
    ],
    [
        'id' => 'c-campus-savannah',
        'community_type' => 'university',
        'name' => 'South University-Savannah',
        'website' => 'https://www.southuniversity.edu/',
        'location' => '709 Mall Blvd, Savannah, GA, 31406',
    ],
    [
        'id' => 'c-campus-twin-a',
        'community_type' => 'university',
        'name' => 'Twin Campus A',
        'website' => 'https://www.twin.edu/',
        'location' => '1 Twin Way, Springfield, IL, 62701',
    ],
    [
        'id' => 'c-campus-twin-b',
        'community_type' => 'university',
        'name' => 'Twin Campus A',
        'website' => 'https://www.twin.edu/',
        'location' => '2 Twin Way, Springfield, IL, 62701',
    ],
];
$campusMatcher = SrpInstitutionMatcher::buildIndex($campusRows);

$sharedDomain = $campusMatcher->match([
    'source' => 'ipeds',
    'source_record_id' => '101116',
    'retrieved_at' => '2026-08-06T00:00:00Z',
    'match' => [
        'ipeds_unitid' => '101116',
        'ope_id' => null,
        'normalized_domain' => 'www.southuniversity.edu',
        'name' => 'South University-Montgomery',
        'city' => 'Montgomery',
        'state' => 'AL',
    ],
    'fields' => [],
    'raw_metadata' => [],
]);
$test->same(
    'shared campus domain resolves by exact name, city, and state',
    'c-campus-montgomery',
    $sharedDomain['row']['id'] ?? null
);
$test->same(
    'narrowed campus match reports the combined method',
    'domain_name_city_state',
    $sharedDomain['method']
);
$test->same(
    'narrowed campus match needs no review',
    false,
    (bool)($sharedDomain['review'] ?? true)
);

$sharedDomainUnknownCampus = $campusMatcher->match([
    'source' => 'ipeds',
    'source_record_id' => '101117',
    'retrieved_at' => '2026-08-06T00:00:00Z',
    'match' => [
        'ipeds_unitid' => '101117',
        'ope_id' => null,
        'normalized_domain' => 'www.southuniversity.edu',
        'name' => 'South University-Richmond',
        'city' => 'Richmond',
        'state' => 'VA',
    ],
    'fields' => [],
    'raw_metadata' => [],
]);
$test->same(
    'shared domain without a geographic twin selects no row',
    null,
    $sharedDomainUnknownCampus['row']
);
$test->same(
    'unresolved shared domain is still reported as ambiguous',
    'domain_ambiguous',
    $sharedDomainUnknownCampus['method']
);
$test->same(
    'unresolved shared domain requires review',
    true,
    (bool)($sharedDomainUnknownCampus['review'] ?? false)
);

$sharedDomainTwins = $campusMatcher->match([
    'source' => 'ipeds',
    'source_record_id' => '101118',
    'retrieved_at' => '2026-08-06T00:00:00Z',
    'match' => [
        'ipeds_unitid' => '101118',
        'ope_id' => null,
        'normalized_domain' => 'www.twin.edu',
        'name' => 'Twin Campus A',
        'city' => 'Springfield',
        'state' => 'IL',
    ],
    'fields' => [],
    'raw_metadata' => [],
]);
$test->same(
    'identical name and geography on two rows never auto-selects one',
    null,
    $sharedDomainTwins['row']
);
$test->same(
    'identical name and geography requires review',
    true,
    (bool)($sharedDomainTwins['review'] ?? false)
);

// Formatting differences are not source conflicts. Treating them as conflicts
// queues effectively every institution for review, which hides the real ones.
$test->same(
    'a punctuated phone equals the same digits',
    true,
    SrpInstitutionFieldPolicy::valuesEqual('phone', '(256) 372-5000', '2563725000')
);
$test->same(
    'a US country code does not change the number',
    true,
    SrpInstitutionFieldPolicy::valuesEqual('phone', '+1 256-372-5000', '2563725000')
);
$test->same(
    'a genuinely different phone still differs',
    false,
    SrpInstitutionFieldPolicy::valuesEqual('phone', '(256) 372-5000', '2563725001')
);
$test->same(
    'an address differing only in punctuation is equal',
    true,
    SrpInstitutionFieldPolicy::valuesEqual(
        'location',
        '4900 Meridian Street, Normal, AL, 35762',
        '4900 Meridian Street, Normal, AL 35762'
    )
);
$test->same(
    'a different street number still differs',
    false,
    SrpInstitutionFieldPolicy::valuesEqual(
        'location',
        '100 Main St, Denver, CO 80221',
        '200 Main St, Denver, CO 80221'
    )
);
$test->same(
    'a ZIP+4 against the same bare ZIP is not a disagreement',
    true,
    SrpInstitutionFieldPolicy::valuesEqual(
        'location',
        'Admin Bldg, Birmingham, AL 35294',
        'Admin Bldg, Birmingham, AL 35294-0110'
    )
);
$test->same(
    'two different ZIP+4 extensions still differ',
    false,
    SrpInstitutionFieldPolicy::valuesEqual(
        'location',
        '100 Main St, Denver, CO 80221-1234',
        '100 Main St, Denver, CO 80221-9999'
    )
);
$test->same(
    'a different five-digit ZIP still differs',
    false,
    SrpInstitutionFieldPolicy::valuesEqual(
        'location',
        '100 Main St, Denver, CO 80221',
        '100 Main St, Denver, CO 80222'
    )
);

// Rejecting a weaker source is the expected outcome, not a review item. Only a
// materially different value should reach an administrator.
$resolverReflection = new ReflectionClass(SrpInstitutionResolver::class);
$materiallyDifferent = $resolverReflection->getMethod('materiallyDifferent');
$materiallyDifferent->setAccessible(true);
$test->same(
    'the same site with another scheme and www is not a conflict',
    false,
    $materiallyDifferent->invoke(null, 'website', 'https://www.alasu.edu/', 'http://alasu.edu')
);
$test->same(
    'a genuinely different domain is a conflict',
    true,
    $materiallyDifferent->invoke(null, 'website', 'https://www.alasu.edu/', 'https://different.edu')
);
$test->same(
    'coordinates agreeing within campus distance are not a conflict',
    false,
    $materiallyDifferent->invoke(null, 'latitude', '32.529', '32.5296')
);
$test->same(
    'a coordinate in another state is a conflict',
    true,
    $materiallyDifferent->invoke(null, 'latitude', '32.529', '42.529')
);
$test->same(
    'a different motto is always a conflict',
    true,
    $materiallyDifferent->invoke(null, 'motto', 'Learn', 'Different motto')
);

// A false flag is a real value. Casting it to a string makes it look identical
// to a NULL current value, which would silently drop every false update.
require_once __DIR__ . '/../includes/institution_data/Repository.php';
$repositoryReflection = new ReflectionClass(SrpInstitutionRepository::class);
$repository = $repositoryReflection->newInstanceWithoutConstructor();
$removeUnchanged = $repositoryReflection->getMethod('removeUnchangedValues');
$removeUnchanged->setAccessible(true);
$databaseValue = $repositoryReflection->getMethod('databaseValue');
$databaseValue->setAccessible(true);

$test->same(
    'a false flag against a NULL column is a real change',
    ['is_hbcu' => false],
    $removeUnchanged->invoke($repository, ['is_hbcu' => null], ['is_hbcu' => false])
);
$test->same(
    'a closed institution flag against a NULL column is a real change',
    ['pipeline_active' => false],
    $removeUnchanged->invoke($repository, ['pipeline_active' => null], ['pipeline_active' => false])
);
$test->same(
    'a false flag matching a stored 0 is not rewritten',
    [],
    $removeUnchanged->invoke($repository, ['is_hbcu' => '0'], ['is_hbcu' => false])
);
$test->same(
    'a true flag matching a stored 1 is not rewritten',
    [],
    $removeUnchanged->invoke($repository, ['is_hbcu' => '1'], ['is_hbcu' => true])
);
$test->same(
    'a true flag against a stored 0 is a real change',
    ['is_hbcu' => true],
    $removeUnchanged->invoke($repository, ['is_hbcu' => '0'], ['is_hbcu' => true])
);
// A conflict that no longer occurs must not keep a row queued for review, but
// reasons this run does not re-evaluate have to survive.
$staleReasons = $repositoryReflection->getMethod('staleReasonsRemoved');
$staleReasons->setAccessible(true);
$test->same(
    'reasons the run recomputes are cleared and the rest survive',
    ['primary_color:field_conflict', 'source_error:ipeds_apply', 'missing_from_current_ipeds_release'],
    $staleReasons->invoke(
        $repository,
        [
            'location:similarly_reliable_sources_disagree',
            'primary_color:field_conflict',
            'match:official_domain_is_shared_by_multiple_rows',
            'institution_match_requires_review',
            'source_error:ipeds_apply',
            'missing_from_current_ipeds_release',
        ],
        ['fields' => ['location' => [], 'phone' => []]]
    )
);

$test->same(
    'false binds as the integer the TINYINT column expects',
    0,
    $databaseValue->invoke($repository, 'is_hbcu', false)
);
$test->same(
    'true binds as an integer',
    1,
    $databaseValue->invoke($repository, 'is_hbcu', true)
);

// Logo licensing remains conservative.
$cc = SrpInstitutionLicense::evaluate('CC BY-SA 4.0');
$test->same('recognized free license allows redistribution', true, $cc['redistribution_allowed']);
$test->same('CC BY-SA requires attribution', true, $cc['attribution_required']);
$test->same(
    'missing license does not allow redistribution',
    false,
    SrpInstitutionLicense::evaluate(null)['redistribution_allowed']
);
$test->same(
    'fair-use logo is blocked',
    'blocked',
    SrpInstitutionLicense::evaluate('Fair use')['status']
);
$athletics = SrpInstitutionLicense::logoCandidate([
    'source_type' => 'wikimedia_commons',
    'license' => 'CC BY 4.0',
    'logo_type' => 'athletics_logo',
    'logo_attribution' => 'Example author',
]);
$test->same('athletics logo requires explicit approval', 'review', $athletics['status']);

$test->finish('Institution foundation tests');
