<?php

declare(strict_types=1);

/**
 * Guided product tour shown once a new account finishes onboarding.
 *
 * State lives alongside onboarding in account_settings.extras['tour'], so no
 * new table is needed and the tour survives sign-out and device changes.
 *
 * Eligibility is derived rather than pushed: onboarding marks itself
 * 'completed' in three separate places, and deriving here means none of them
 * need to know the tour exists.
 */

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/onboarding.php';

/**
 * Bump when the tour's steps change enough that returning users should see it
 * again. A completed tour with an older version becomes eligible once more.
 */
const SRP_TOUR_VERSION = 1;

/**
 * @return array<string, mixed>
 */
function srp_default_tour_state(): array {
    return [
        'status' => 'pending',
        'current_step' => 0,
        'version' => null,
        'completed_at' => null,
        'started_at' => null,
    ];
}

/**
 * @return array<string, mixed>
 */
function srp_get_tour_state(PDO $db, string $userId): array {
    $extras = srp_get_account_settings_extras($db, $userId);
    $state = srp_default_tour_state();
    if (isset($extras['tour']) && is_array($extras['tour'])) {
        $state = array_merge($state, $extras['tour']);
    }
    $state['current_step'] = max(0, (int)$state['current_step']);
    $state['status'] = in_array($state['status'], ['pending', 'in_progress', 'completed', 'skipped'], true)
        ? $state['status']
        : 'pending';
    return $state;
}

/**
 * @param array<string, mixed> $state
 */
function srp_save_tour_state(PDO $db, string $userId, array $state): void {
    $extras = srp_get_account_settings_extras($db, $userId);
    $state['last_updated_at'] = gmdate('c');
    $extras['tour'] = $state;
    srp_save_account_settings_extras($db, $userId, $extras);
}

/**
 * Whether this user should be offered the tour right now.
 *
 * Requires a finished onboarding so the tour never competes with the signup
 * wizard, and skips anyone who already finished or dismissed this version.
 */
function srp_tour_is_eligible(PDO $db, string $userId): bool {
    $onboarding = srp_get_onboarding_state($db, $userId);
    if (($onboarding['status'] ?? '') !== 'completed') {
        return false;
    }
    $tour = srp_get_tour_state($db, $userId);
    if (in_array($tour['status'], ['completed', 'skipped'], true)) {
        // A newer tour re-qualifies a user who finished an older one.
        return (int)$tour['version'] < SRP_TOUR_VERSION;
    }
    return true;
}

/**
 * @return array<string, mixed>
 */
function srp_tour_payload(PDO $db, string $userId): array {
    $tour = srp_get_tour_state($db, $userId);
    return [
        'eligible' => srp_tour_is_eligible($db, $userId),
        'status' => $tour['status'],
        'current_step' => $tour['current_step'],
        'version' => SRP_TOUR_VERSION,
        'completed_version' => $tour['version'],
    ];
}
