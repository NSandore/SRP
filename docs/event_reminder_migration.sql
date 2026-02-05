ALTER TABLE event_registrations
ADD COLUMN reminder_sent_at datetime DEFAULT NULL AFTER registered_at;
