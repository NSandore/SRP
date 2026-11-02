<?php

const SRP_PERSPECTIVE_TYPES = [
    'student_experience',
    'alumni_experience',
    'professional_guidance',
    'official_institutional',
    'community_suggestion',
];

function srp_normalize_perspective_type($value): ?string
{
    $value = strtolower(trim((string)$value));
    return in_array($value, SRP_PERSPECTIVE_TYPES, true) ? $value : null;
}

function srp_derive_perspective_type(array $row): string
{
    $explicit = srp_normalize_perspective_type($row['perspective_type'] ?? null);
    if ($explicit !== null) {
        return $explicit;
    }

    $status = strtolower(trim((string)($row['education_status'] ?? '')));
    if (str_contains($status, 'alumni') || str_contains($status, 'graduate')) {
        return 'alumni_experience';
    }
    if (str_contains($status, 'staff') || str_contains($status, 'professional') || str_contains($status, 'mentor')) {
        return 'professional_guidance';
    }
    if (str_contains($status, 'student') || str_contains($status, 'prospect')) {
        return 'student_experience';
    }
    return 'community_suggestion';
}

function srp_perspective_copy(string $type): array
{
    $copy = [
        'student_experience' => [
            'label' => 'Student experience',
            'description' => 'A student is sharing what they experienced. Policies and outcomes may differ for someone else.',
        ],
        'alumni_experience' => [
            'label' => 'Alumni experience',
            'description' => 'A former student is sharing past experience. Current procedures may have changed.',
        ],
        'professional_guidance' => [
            'label' => 'Professional guidance',
            'description' => 'Guidance from someone presenting professional or staff experience. Confirm requirements with the responsible organization.',
        ],
        'official_institutional' => [
            'label' => 'Official institutional information',
            'description' => 'Information published or explicitly reviewed as applying to the named institution or program.',
        ],
        'community_suggestion' => [
            'label' => 'Community suggestion',
            'description' => 'A community member is offering a suggestion, not an official or universally applicable answer.',
        ],
    ];
    return $copy[$type] ?? $copy['community_suggestion'];
}

function srp_attach_trust_context(array $rows): array
{
    $now = time();
    foreach ($rows as &$row) {
        $type = srp_derive_perspective_type($row);
        $copy = srp_perspective_copy($type);
        $dueAt = trim((string)($row['review_due_at'] ?? ''));
        $dueTs = $dueAt !== '' ? strtotime($dueAt) : false;

        $row['perspective_type'] = $type;
        $row['perspective_label'] = $copy['label'];
        $row['perspective_description'] = $copy['description'];
        if (($row['applicable_community_name'] ?? '') === 'Information Board') {
            $row['applicable_community_name'] = 'StudentSphere Guides & Answers';
        }
        $wasReviewed = (int)($row['verified'] ?? 0) === 1 || trim((string)($row['reviewed_at'] ?? '')) !== '';
        $row['review_status'] = $dueTs !== false && $dueTs < $now ? 'stale' : ($wasReviewed ? 'reviewed' : 'unreviewed');
    }
    unset($row);
    return $rows;
}
