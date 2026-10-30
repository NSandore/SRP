<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use MailerSend\Helpers\Builder\EmailParams;
use MailerSend\Helpers\Builder\Recipient;
use MailerSend\MailerSend;

/**
 * Send transactional email through the single configured provider.
 * Throws on configuration or delivery errors so callers cannot claim success.
 */
function srp_send_email(string $toEmail, string $toName, string $subject, string $text, string $html): void
{
    $apiKey = (string)(getenv('MAILERSEND_API_KEY') ?: '');
    $fromEmail = (string)(getenv('MAILERSEND_FROM_EMAIL') ?: '');
    $fromName = (string)(getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere');
    if ($apiKey === '' || $fromEmail === '') {
        throw new RuntimeException('Transactional email is not configured.');
    }

    $mailer = new MailerSend(['api_key' => $apiKey]);
    $params = (new EmailParams())
        ->setFrom($fromEmail)
        ->setFromName($fromName)
        ->setRecipients([new Recipient($toEmail, $toName !== '' ? $toName : $toEmail)])
        ->setSubject($subject)
        ->setText($text)
        ->setHtml($html);
    $mailer->email->send($params);
}
