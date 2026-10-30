<?php

const SRP_FORUM_TITLE_MAX_LENGTH = 100;
const SRP_THREAD_TITLE_MAX_LENGTH = 160;
const SRP_POST_MAX_LENGTH = 10000;
const SRP_POST_HTML_MAX_BYTES = 60000;

function srp_content_text_length(?string $value): int {
    return mb_strlen(trim((string)$value), 'UTF-8');
}

function srp_post_text_length(?string $html): int {
    $text = html_entity_decode(
        strip_tags((string)$html),
        ENT_QUOTES | ENT_HTML5,
        'UTF-8'
    );
    $text = str_replace("\u{00A0}", ' ', $text);
    return mb_strlen(trim($text), 'UTF-8');
}

function srp_post_exceeds_limit(?string $html): bool {
    $value = (string)$html;
    return srp_post_text_length($value) > SRP_POST_MAX_LENGTH
        || strlen($value) > SRP_POST_HTML_MAX_BYTES;
}
