-- Add 'verify' to notification_type enum
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
    'verify'
) DEFAULT NULL;
