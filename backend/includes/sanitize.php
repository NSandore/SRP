<?php
/**
 * Centralized HTML sanitization for all user-authored rich text.
 *
 * Every write path that stores HTML (posts, replies, threads, forum
 * descriptions, announcements) MUST pass content through srp_sanitize_html()
 * so the platform never persists attacker-controlled markup. Do not rely on
 * client-side DOMPurify alone — mobile and email render paths do not use it.
 */

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Sanitize rich text to a safe allow-listed subset of HTML.
 */
function srp_sanitize_html(?string $html): string {
    $html = (string)$html;
    if (trim($html) === '') {
        return '';
    }

    static $purifier = null;
    if ($purifier === null) {
        $config = HTMLPurifier_Config::createDefault();

        $cacheDir = __DIR__ . '/../htmlpurifier-cache';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }
        if (is_dir($cacheDir) && is_writable($cacheDir)) {
            $config->set('Cache.SerializerPath', $cacheDir);
        } else {
            // Fall back to no on-disk cache rather than fatal-erroring.
            $config->set('Cache.DefinitionImpl', null);
        }

        $config->set('HTML.Allowed',
            'p,br,hr,b,strong,i,em,u,s,ul,ol,li,'
            . 'a[href|title|target|rel],'
            . 'h1,h2,h3,h4,h5,h6,blockquote,code,pre,span,'
            . 'img[src|alt|title|width|height]');
        $config->set('HTML.TargetBlank', true);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true]);

        $purifier = new HTMLPurifier($config);
    }

    return $purifier->purify($html);
}

/**
 * Sanitize a value that must be plain text (strips all tags).
 */
function srp_sanitize_plain(?string $text, int $maxLength = 0): string {
    $clean = trim(strip_tags((string)$text));
    if ($maxLength > 0 && mb_strlen($clean) > $maxLength) {
        $clean = mb_substr($clean, 0, $maxLength);
    }
    return $clean;
}
