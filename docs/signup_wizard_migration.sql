-- Signup / setup wizard support tables
-- Run in srp_db

CREATE TABLE IF NOT EXISTS user_verification_requests (
  request_id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  community_id VARCHAR(32) DEFAULT NULL,
  verification_type ENUM('student', 'staff_representative') NOT NULL,
  verification_method ENUM('school_email', 'id_photo', 'tuition_statement', 'manual_review', 'staff_attestation') NOT NULL,
  school_email VARCHAR(100) DEFAULT NULL,
  staff_position VARCHAR(150) DEFAULT NULL,
  attestation_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(32) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_verification_user_status (user_id, status),
  KEY idx_verification_community_status (community_id, status),
  CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_verification_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_verification_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ambassador_applications (
  application_id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  community_id VARCHAR(32) NOT NULL,
  motivation_message TEXT NOT NULL,
  connection_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  routed_to ENUM('community_admins', 'super_admins') NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(32) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_amb_application_user_status (user_id, status),
  KEY idx_amb_application_community_status (community_id, status),
  UNIQUE KEY uq_amb_pending (user_id, community_id, status),
  CONSTRAINT fk_amb_application_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_amb_application_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_amb_application_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
