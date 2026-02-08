-- Allow prefixed IDs (forum/thread/post/etc.) to be stored in pinned_items.item_id.
ALTER TABLE pinned_items
    MODIFY COLUMN item_id VARCHAR(32) NOT NULL;
