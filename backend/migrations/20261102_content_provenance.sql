ALTER TABLE posts
    ADD COLUMN perspective_type ENUM('student_experience','alumni_experience','professional_guidance','official_institutional','community_suggestion') NULL AFTER verified_at,
    ADD COLUMN source_name VARCHAR(255) NULL AFTER perspective_type,
    ADD COLUMN source_url VARCHAR(2048) NULL AFTER source_name,
    ADD COLUMN applicable_community_id VARCHAR(32) NULL AFTER source_url,
    ADD COLUMN reviewed_at DATETIME NULL AFTER applicable_community_id,
    ADD COLUMN review_due_at DATETIME NULL AFTER reviewed_at,
    ADD COLUMN review_note VARCHAR(500) NULL AFTER review_due_at;

UPDATE posts p
JOIN threads t ON t.thread_id = p.thread_id
JOIN forums f ON f.forum_id = t.forum_id
SET p.perspective_type = 'professional_guidance',
    p.applicable_community_id = f.community_id,
    p.reviewed_at = COALESCE(p.updated_at, p.created_at),
    p.review_due_at = DATE_ADD(COALESCE(p.updated_at, p.created_at), INTERVAL 365 DAY)
WHERE f.is_system_container = 1
  AND t.content_kind IN ('article', 'guide')
  AND p.perspective_type IS NULL;

UPDATE posts
SET reviewed_at = COALESCE(reviewed_at, verified_at),
    review_due_at = COALESCE(review_due_at, DATE_ADD(verified_at, INTERVAL 180 DAY))
WHERE verified = 1
  AND verified_at IS NOT NULL;
