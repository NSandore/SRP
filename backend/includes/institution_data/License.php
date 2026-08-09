<?php

declare(strict_types=1);

require_once __DIR__ . '/Normalizer.php';

/**
 * Conservative logo-license decisions. This records machine-readable license
 * facts; it is not a substitute for trademark review.
 */
final class SrpInstitutionLicense
{
    /**
     * @param array<string, mixed>|string|null $license
     * @return array{
     *   normalized_name: ?string,
     *   url: ?string,
     *   status: string,
     *   redistribution_allowed: bool,
     *   attribution_required: bool,
     *   share_alike: bool,
     *   reason: string
     * }
     */
    public static function evaluate(array|string|null $license, ?string $url = null): array
    {
        if (is_array($license)) {
            $url = isset($license['url'])
                ? (string)$license['url']
                : (isset($license['license_url']) ? (string)$license['license_url'] : $url);
            $name = $license['name']
                ?? $license['license_name']
                ?? $license['short_name']
                ?? null;
        } else {
            $name = $license;
        }

        $name = SrpInstitutionNormalizer::text($name, 255);
        $normalizedUrl = $url !== null ? SrpInstitutionNormalizer::url($url) : null;
        $haystack = strtolower(trim(($name ?? '') . ' ' . ($normalizedUrl ?? '')));
        $result = [
            'normalized_name' => $name,
            'url' => $normalizedUrl,
            'status' => 'review',
            'redistribution_allowed' => false,
            'attribution_required' => false,
            'share_alike' => false,
            'reason' => 'license_missing_or_unrecognized',
        ];
        if ($haystack === '') {
            return $result;
        }

        if (
            preg_match(
                '/(?:all rights reserved|fair[ -]?use|non[ -]?free|copyrighted|no known license|unknown license)/',
                $haystack
            ) === 1
        ) {
            $result['status'] = 'blocked';
            $result['reason'] = 'license_does_not_authorize_redistribution';
            return $result;
        }

        if (
            str_contains($haystack, 'creativecommons.org/publicdomain/zero')
            || preg_match('/\bcc\s*0(?:\s*1\.0)?\b/i', $haystack) === 1
        ) {
            $result['normalized_name'] = 'CC0 1.0';
            $result['status'] = 'allowed';
            $result['redistribution_allowed'] = true;
            $result['reason'] = 'cc0';
            return $result;
        }

        if (
            str_contains($haystack, 'public domain')
            || str_contains($haystack, 'publicdomain/mark')
            || preg_match('/\bpdm(?:\s*1\.0)?\b/i', $haystack) === 1
        ) {
            $result['normalized_name'] = 'Public domain';
            $result['status'] = 'allowed';
            $result['redistribution_allowed'] = true;
            $result['reason'] = 'public_domain';
            return $result;
        }

        $isCreativeCommons = str_contains($haystack, 'creative commons')
            || str_contains($haystack, 'creativecommons.org/licenses/')
            || preg_match('/\bcc[\s_-]*by\b/i', $haystack) === 1;
        if ($isCreativeCommons) {
            $nonCommercial = preg_match('/(?:\bby[\s_-]*nc\b|noncommercial|non-commercial)/i', $haystack) === 1;
            $noDerivatives = preg_match('/(?:\bby[\s_-]*nd\b|noderivatives|no-derivatives)/i', $haystack) === 1;
            $shareAlike = preg_match('/(?:\bby[\s_-]*sa\b|sharealike|share-alike)/i', $haystack) === 1;
            $result['attribution_required'] = true;
            $result['share_alike'] = $shareAlike;
            if ($nonCommercial || $noDerivatives) {
                $result['status'] = 'review';
                $result['reason'] = $nonCommercial
                    ? 'creative_commons_noncommercial_requires_review'
                    : 'creative_commons_no_derivatives_requires_review';
                return $result;
            }
            $result['normalized_name'] = $shareAlike ? 'CC BY-SA' : 'CC BY';
            $result['status'] = 'allowed';
            $result['redistribution_allowed'] = true;
            $result['reason'] = $shareAlike ? 'cc_by_sa' : 'cc_by';
            return $result;
        }

        if (
            preg_match('/\b(?:gfdl|gnu free documentation license)\b/i', $haystack) === 1
        ) {
            $result['normalized_name'] = 'GNU Free Documentation License';
            $result['status'] = 'allowed';
            $result['redistribution_allowed'] = true;
            $result['attribution_required'] = true;
            $result['share_alike'] = true;
            $result['reason'] = 'gfdl';
            return $result;
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $candidate
     * @return array<string, mixed>
     */
    public static function logoCandidate(array $candidate): array
    {
        $sourceType = strtolower((string)($candidate['source_type'] ?? ''));
        if ($sourceType === 'manual_verified') {
            return [
                'normalized_name' => $candidate['logo_license_name'] ?? null,
                'url' => isset($candidate['logo_license_url'])
                    ? SrpInstitutionNormalizer::url($candidate['logo_license_url'])
                    : null,
                'status' => 'allowed',
                'redistribution_allowed' => true,
                'attribution_required' => false,
                'share_alike' => false,
                'reason' => 'manual_verified_selection',
            ];
        }

        $license = $candidate['license'] ?? [
            'name' => $candidate['logo_license_name']
                ?? $candidate['license_name']
                ?? null,
            'url' => $candidate['logo_license_url']
                ?? $candidate['license_url']
                ?? null,
        ];
        $decision = self::evaluate(
            is_array($license) || is_string($license) ? $license : null
        );
        $logoType = strtolower((string)($candidate['logo_type'] ?? ''));
        if (
            in_array($logoType, ['athletics_logo', 'athletic', 'sports'], true)
            && ($candidate['allow_athletics_logo'] ?? false) !== true
        ) {
            $decision['status'] = 'review';
            $decision['redistribution_allowed'] = false;
            $decision['reason'] = 'athletics_logo_requires_explicit_approval';
        }
        $attribution = trim((string)(
            $candidate['logo_attribution']
            ?? $candidate['attribution']
            ?? ''
        ));
        if (
            $decision['status'] === 'allowed'
            && $decision['attribution_required']
            && $attribution === ''
        ) {
            $decision['status'] = 'review';
            $decision['redistribution_allowed'] = false;
            $decision['reason'] = 'required_attribution_missing';
        }
        return $decision;
    }

    /**
     * @param array<string, mixed>|string|null $license
     */
    public static function permitsRedistribution(array|string|null $license): bool
    {
        return self::evaluate($license)['redistribution_allowed'];
    }
}

/**
 * @param array<string, mixed>|string|null $license
 * @return array<string, mixed>
 */
function srp_institution_license_decision(array|string|null $license): array
{
    return SrpInstitutionLicense::evaluate($license);
}
