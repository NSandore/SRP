-- Add verification-related notification types
ALTER TABLE notifications
MODIFY COLUMN notification_type ENUM(
    'follow',
    'upvote',
    'downvote',
    'reply',
    'message',
    'connection',
    'announcement',
    'poll',
    'survey',
    'event',
    'verify',
    'verification_request',
    'verification_result'
) DEFAULT NULL;
