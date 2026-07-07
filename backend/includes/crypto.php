<?php
/**
 * Application-level encryption for secrets at rest (e.g. Zoom OAuth tokens
 * stored in account_settings.extras).
 *
 * Uses libsodium's authenticated secretbox. The key comes from the
 * APP_ENCRYPTION_KEY environment variable (base64-encoded 32 bytes). Generate
 * one with:  php -r "echo base64_encode(random_bytes(32));"
 *
 * Ciphertext is stored with an "enc:v1:" prefix so srp_decrypt() can
 * transparently pass through legacy plaintext values written before encryption
 * was enabled.
 */

const SRP_ENC_PREFIX = 'enc:v1:';

function srp_encryption_key(): ?string {
    $raw = getenv('APP_ENCRYPTION_KEY');
    if ($raw === false || $raw === '') {
        return null;
    }
    $key = base64_decode($raw, true);
    if ($key === false || strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
        error_log('[SRP] APP_ENCRYPTION_KEY is invalid; expected base64 of 32 bytes.');
        return null;
    }
    return $key;
}

/**
 * Encrypt a string for storage. If no key is configured, returns the value
 * unchanged so the platform keeps working (with a logged warning).
 */
function srp_encrypt(?string $plaintext): ?string {
    if ($plaintext === null || $plaintext === '') {
        return $plaintext;
    }
    if (!function_exists('sodium_crypto_secretbox')) {
        return $plaintext;
    }
    $key = srp_encryption_key();
    if ($key === null) {
        error_log('[SRP] APP_ENCRYPTION_KEY not set; storing secret without encryption.');
        return $plaintext;
    }
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = sodium_crypto_secretbox($plaintext, $nonce, $key);
    return SRP_ENC_PREFIX . base64_encode($nonce . $cipher);
}

/**
 * Decrypt a value produced by srp_encrypt(). Values without the enc prefix are
 * treated as legacy plaintext and returned as-is.
 */
function srp_decrypt(?string $stored): ?string {
    if ($stored === null || $stored === '') {
        return $stored;
    }
    if (strncmp($stored, SRP_ENC_PREFIX, strlen(SRP_ENC_PREFIX)) !== 0) {
        return $stored; // legacy plaintext
    }
    $key = srp_encryption_key();
    if ($key === null || !function_exists('sodium_crypto_secretbox_open')) {
        return null;
    }
    $decoded = base64_decode(substr($stored, strlen(SRP_ENC_PREFIX)), true);
    if ($decoded === false || strlen($decoded) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
        return null;
    }
    $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain = sodium_crypto_secretbox_open($cipher, $nonce, $key);
    return $plain === false ? null : $plain;
}
