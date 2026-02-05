<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../vendor/autoload.php';

use MailerSend\MailerSend;
use MailerSend\Helpers\Builder\Recipient;
use MailerSend\Helpers\Builder\EmailParams;

$apiKey = getenv('MAILERSEND_API_KEY');
$fromEmail = getenv('MAILERSEND_FROM_EMAIL');
$fromName = getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere';
$windowMinutes = getenv('EVENT_REMINDER_WINDOW_MINUTES');
$windowMinutes = is_numeric($windowMinutes) ? (int)$windowMinutes : 5;

if (!$apiKey || !$fromEmail) {
    fwrite(STDERR, "Missing MAILERSEND_API_KEY or MAILERSEND_FROM_EMAIL\n");
    exit(1);
}

$mailersend = new MailerSend(['api_key' => $apiKey]);

try {
    $db = getDB();

    $stmt = $db->prepare("
        SELECT
            e.event_id,
            e.title,
            e.description,
            e.start_at,
            e.timezone,
            e.meeting_link,
            e.location,
            u.user_id,
            u.first_name,
            u.last_name,
            u.email
        FROM event_registrations r
        INNER JOIN events e ON e.event_id = r.event_id
        INNER JOIN users u ON u.user_id = r.user_id
        WHERE r.status = 'registered'
          AND r.reminder_sent_at IS NULL
          AND e.start_at BETWEEN
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL (15 - :window) MINUTE)
            AND DATE_ADD(UTC_TIMESTAMP(), INTERVAL (15 + :window) MINUTE)
    ");
    $stmt->execute([':window' => $windowMinutes]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) {
        echo "No reminders to send.\n";
        exit(0);
    }

    $sent = 0;
    foreach ($rows as $row) {
        $email = $row['email'] ?? '';
        if ($email === '') {
            continue;
        }

        $tzName = $row['timezone'] ?: 'UTC';
        try {
            $tz = new DateTimeZone($tzName);
        } catch (Throwable $e) {
            $tz = new DateTimeZone('UTC');
            $tzName = 'UTC';
        }
        $startUtc = new DateTime($row['start_at'], new DateTimeZone('UTC'));
        $startLocal = clone $startUtc;
        $startLocal->setTimezone($tz);
        $startText = $startLocal->format('M j, Y g:i A') . ' ' . $tzName;

        $title = $row['title'] ?: 'Your upcoming event';
        $location = $row['location'] ?: '';
        $meetingLink = $row['meeting_link'] ?: '';

        $toName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ($toName === '') {
            $toName = $email;
        }

        $linkLine = $meetingLink !== '' ? "Join link: {$meetingLink}" : '';
        $locationLine = $location !== '' ? "Location: {$location}" : '';
        $textParts = array_filter([
            "Reminder: {$title} starts in 15 minutes.",
            "Start time: {$startText}.",
            $locationLine,
            $linkLine,
        ]);
        $textBody = implode("\n", $textParts);

        $htmlParts = array_filter([
            "<p><strong>Reminder:</strong> {$title} starts in 15 minutes.</p>",
            "<p><strong>Start time:</strong> {$startText}</p>",
            $location !== '' ? "<p><strong>Location:</strong> {$location}</p>" : '',
            $meetingLink !== '' ? "<p><a href=\"{$meetingLink}\">Join the event</a></p>" : '',
        ]);
        $htmlBody = implode("\n", $htmlParts);

        $recipients = [new Recipient($email, $toName)];
        $emailParams = (new EmailParams())
            ->setFrom($fromEmail)
            ->setFromName($fromName)
            ->setRecipients($recipients)
            ->setSubject("Reminder: {$title} starts in 15 minutes")
            ->setText($textBody)
            ->setHtml($htmlBody);

        try {
            $mailersend->email->send($emailParams);
        } catch (Throwable $e) {
            error_log('Reminder email failed: ' . $e->getMessage());
            continue;
        }

        $update = $db->prepare("
            UPDATE event_registrations
            SET reminder_sent_at = UTC_TIMESTAMP()
            WHERE event_id = :eid AND user_id = :uid
        ");
        $update->execute([
            ':eid' => $row['event_id'],
            ':uid' => $row['user_id'],
        ]);

        $sent++;
    }

    echo "Sent {$sent} reminder(s).\n";
} catch (Throwable $e) {
    fwrite(STDERR, "Error sending reminders: " . $e->getMessage() . "\n");
    exit(1);
}
