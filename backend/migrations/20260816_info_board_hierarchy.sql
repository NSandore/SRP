ALTER TABLE threads
    MODIFY COLUMN content_kind ENUM('discussion', 'article', 'megathread', 'guide', 'section') NOT NULL DEFAULT 'discussion',
    ADD COLUMN parent_thread_id VARCHAR(32) DEFAULT NULL AFTER forum_id,
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER content_kind,
    ADD KEY idx_threads_parent_sort (parent_thread_id, sort_order, thread_id),
    ADD CONSTRAINT fk_threads_parent FOREIGN KEY (parent_thread_id) REFERENCES threads (thread_id) ON DELETE SET NULL ON UPDATE CASCADE;
