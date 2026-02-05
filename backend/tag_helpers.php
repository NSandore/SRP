<?php
require_once __DIR__ . '/db_connection.php';

const SRP_TAG_SELECTION_LIMIT = 8;

function srp_tag_options(): array {
    return [
        ['name' => 'Admissions'],
        ['name' => 'Financial Aid'],
        ['name' => 'Scholarships'],
        ['name' => 'Essays & Writing'],
        ['name' => 'Applications'],
        ['name' => 'Transfer Students'],
        ['name' => 'International Students'],
        ['name' => 'Campus Life'],
        ['name' => 'Academics'],
        ['name' => 'Housing & Dining'],
        ['name' => 'Test Prep'],
        ['name' => 'Interviews'],
        ['name' => 'Letters of Recommendation'],
        ['name' => 'Waitlist & Deferral'],
        ['name' => 'Graduate School'],
        ['name' => 'Gap Year'],
        ['name' => 'Mental Health & Wellness'],
        ['name' => 'Diversity & Inclusion'],
        ['name' => 'Research Opportunities'],
        ['name' => 'Study Abroad'],
        ['name' => 'Career Services'],
        ['name' => 'Athletics'],
    ];
}

function srp_normalize_tag_slug(string $value): string {
    $value = strtolower(trim($value));
    $value = str_replace('&', ' and ', $value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    $value = preg_replace('/-+/', '-', $value);
    $value = trim($value, '-');
    return $value;
}

function srp_tag_options_normalized(): array {
    $options = srp_tag_options();
    $seen = [];
    $normalized = [];
    foreach ($options as $opt) {
        $name = trim($opt['name'] ?? '');
        if ($name === '') {
            continue;
        }
        $slug = srp_normalize_tag_slug($opt['slug'] ?? $name);
        if ($slug === '' || isset($seen[$slug])) {
            continue;
        }
        $seen[$slug] = true;
        $normalized[] = ['name' => $name, 'slug' => $slug];
    }
    return $normalized;
}

function srp_table_exists(PDO $db, string $tableName): bool {
    $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t");
    $stmt->execute([':t' => $tableName]);
    return (bool)$stmt->fetchColumn();
}

function srp_table_has_column(PDO $db, string $tableName, string $columnName): bool {
    $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c");
    $stmt->execute([':t' => $tableName, ':c' => $columnName]);
    return (bool)$stmt->fetchColumn();
}

function srp_column_is_generated(PDO $db, string $tableName, string $columnName): bool {
    $stmt = $db->prepare("
        SELECT EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :t
          AND COLUMN_NAME = :c
        LIMIT 1
    ");
    $stmt->execute([':t' => $tableName, ':c' => $columnName]);
    $extra = (string)$stmt->fetchColumn();
    return stripos($extra, 'GENERATED') !== false;
}

function srp_ensure_tag_tables(PDO $db): void {
    $db->exec("
        CREATE TABLE IF NOT EXISTS tags (
            tag_id VARCHAR(32) PRIMARY KEY,
            name VARCHAR(80) NOT NULL,
            slug VARCHAR(80) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS thread_tags (
            id VARCHAR(32) PRIMARY KEY,
            thread_id VARCHAR(32) NOT NULL,
            tag_id VARCHAR(32) NOT NULL,
            UNIQUE KEY unique_thread_tag (thread_id, tag_id),
            KEY idx_thread_tags_thread (thread_id),
            KEY idx_thread_tags_tag (tag_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS forum_tags (
            id VARCHAR(32) PRIMARY KEY,
            forum_id VARCHAR(32) NOT NULL,
            tag_id VARCHAR(32) NOT NULL,
            UNIQUE KEY unique_forum_tag (forum_id, tag_id),
            KEY idx_forum_tags_forum (forum_id),
            KEY idx_forum_tags_tag (tag_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS user_interests (
            id VARCHAR(32) PRIMARY KEY,
            user_id VARCHAR(32) NOT NULL,
            tag_id VARCHAR(32) NOT NULL,
            UNIQUE KEY unique_user_tag (user_id, tag_id),
            KEY idx_user_interests_user (user_id),
            KEY idx_user_interests_tag (tag_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function srp_seed_tags(PDO $db): array {
    srp_ensure_tag_tables($db);
    $options = srp_tag_options_normalized();
    if (empty($options)) {
        return [];
    }

    $existing = [];
    $existingByName = [];
    $stmt = $db->query("SELECT tag_id, name, slug FROM tags");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $slugKey = $row['slug'] ?: srp_normalize_tag_slug($row['name'] ?? '');
        if ($slugKey !== '') {
            $existing[$slugKey] = $row;
        }
        if (!empty($row['name'])) {
            $existingByName[$row['name']] = $row;
        }
    }

    $slugGenerated = srp_column_is_generated($db, 'tags', 'slug');
    $insertStmt = $slugGenerated
        ? $db->prepare("INSERT INTO tags (tag_id, name) VALUES (:id, :name)")
        : $db->prepare("INSERT INTO tags (tag_id, name, slug) VALUES (:id, :name, :slug)");
    foreach ($options as $opt) {
        if (isset($existing[$opt['slug']])) {
            continue;
        }
        if (isset($existingByName[$opt['name']])) {
            // Ensure we can resolve this option by its normalized slug.
            $existing[$opt['slug']] = $existingByName[$opt['name']];
            continue;
        }
        $tagId = generateUniqueId($db, 'tags');
        if ($slugGenerated) {
            $insertStmt->execute([
                ':id' => $tagId,
                ':name' => $opt['name'],
            ]);
        } else {
            $insertStmt->execute([
                ':id' => $tagId,
                ':name' => $opt['name'],
                ':slug' => $opt['slug'],
            ]);
        }
        $existing[$opt['slug']] = [
            'tag_id' => $tagId,
            'name' => $opt['name'],
            'slug' => $opt['slug'],
        ];
        $existingByName[$opt['name']] = $existing[$opt['slug']];
    }

    return $existing;
}

function srp_resolve_tag_ids(PDO $db, array $tags, int $limit = SRP_TAG_SELECTION_LIMIT): array {
    if (empty($tags)) {
        return [];
    }
    $allowed = [];
    foreach (srp_tag_options_normalized() as $opt) {
        $allowed[$opt['slug']] = $opt['name'];
    }
    if (empty($allowed)) {
        return [];
    }

    $requested = [];
    foreach ($tags as $tag) {
        $slug = srp_normalize_tag_slug((string)$tag);
        if ($slug !== '' && isset($allowed[$slug])) {
            $requested[$slug] = true;
        }
    }
    if (empty($requested)) {
        return [];
    }
    $requestedSlugs = array_slice(array_keys($requested), 0, $limit);

    $tagMap = srp_seed_tags($db);
    $tagIds = [];
    foreach ($requestedSlugs as $slug) {
        if (isset($tagMap[$slug])) {
            $tagIds[] = $tagMap[$slug]['tag_id'];
        }
    }
    if (empty($tagIds)) {
        return [];
    }
    return array_values(array_unique($tagIds));
}

function srp_sync_tag_mappings(PDO $db, string $table, string $itemColumn, string $itemId, array $tagIds): void {
    if ($itemId === '') {
        return;
    }
    srp_ensure_tag_tables($db);
    if (!srp_table_exists($db, $table)) {
        return;
    }
    $deleteStmt = $db->prepare("DELETE FROM {$table} WHERE {$itemColumn} = :item_id");
    $deleteStmt->execute([':item_id' => $itemId]);

    if (empty($tagIds)) {
        return;
    }

    $hasId = srp_table_has_column($db, $table, 'id');
    if ($hasId) {
        $insertStmt = $db->prepare("INSERT INTO {$table} (id, {$itemColumn}, tag_id) VALUES (:id, :item_id, :tag_id)");
        foreach ($tagIds as $tagId) {
            $insertStmt->execute([
                ':id' => generateUniqueId($db, $table),
                ':item_id' => $itemId,
                ':tag_id' => $tagId,
            ]);
        }
    } else {
        $insertStmt = $db->prepare("INSERT INTO {$table} ({$itemColumn}, tag_id) VALUES (:item_id, :tag_id)");
        foreach ($tagIds as $tagId) {
            $insertStmt->execute([
                ':item_id' => $itemId,
                ':tag_id' => $tagId,
            ]);
        }
    }
}

function srp_attach_tags_to_threads(PDO $db, array $threads): array {
    if (empty($threads)) {
        return $threads;
    }
    if (!srp_table_exists($db, 'thread_tags') || !srp_table_exists($db, 'tags')) {
        foreach ($threads as &$thread) {
            $thread['tags'] = [];
        }
        return $threads;
    }
    $threadIds = [];
    foreach ($threads as $thread) {
        if (!empty($thread['thread_id'])) {
            $threadIds[] = $thread['thread_id'];
        }
    }
    $threadIds = array_values(array_unique($threadIds));
    if (empty($threadIds)) {
        return $threads;
    }

    $placeholders = [];
    $params = [];
    foreach ($threadIds as $idx => $id) {
        $ph = ":t{$idx}";
        $placeholders[] = $ph;
        $params[$ph] = $id;
    }
    $inClause = implode(',', $placeholders);
    $stmt = $db->prepare("
        SELECT tt.thread_id, tg.name
        FROM thread_tags tt
        INNER JOIN tags tg ON tg.tag_id = tt.tag_id
        WHERE tt.thread_id IN ({$inClause})
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $tagMap = [];
    foreach ($rows as $row) {
        $tid = $row['thread_id'];
        if (!isset($tagMap[$tid])) {
            $tagMap[$tid] = [];
        }
        $tagMap[$tid][] = $row['name'];
    }
    foreach ($threads as &$thread) {
        $tid = $thread['thread_id'] ?? '';
        $thread['tags'] = $tagMap[$tid] ?? [];
    }
    return $threads;
}

function srp_attach_tags_to_forums(PDO $db, array $forums): array {
    if (empty($forums)) {
        return $forums;
    }
    if (!srp_table_exists($db, 'forum_tags') || !srp_table_exists($db, 'tags')) {
        foreach ($forums as &$forum) {
            $forum['tags'] = [];
        }
        return $forums;
    }
    $forumIds = [];
    foreach ($forums as $forum) {
        if (!empty($forum['forum_id'])) {
            $forumIds[] = $forum['forum_id'];
        }
    }
    $forumIds = array_values(array_unique($forumIds));
    if (empty($forumIds)) {
        return $forums;
    }

    $placeholders = [];
    $params = [];
    foreach ($forumIds as $idx => $id) {
        $ph = ":f{$idx}";
        $placeholders[] = $ph;
        $params[$ph] = $id;
    }
    $inClause = implode(',', $placeholders);
    $stmt = $db->prepare("
        SELECT ft.forum_id, tg.name
        FROM forum_tags ft
        INNER JOIN tags tg ON tg.tag_id = ft.tag_id
        WHERE ft.forum_id IN ({$inClause})
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $tagMap = [];
    foreach ($rows as $row) {
        $fid = $row['forum_id'];
        if (!isset($tagMap[$fid])) {
            $tagMap[$fid] = [];
        }
        $tagMap[$fid][] = $row['name'];
    }
    foreach ($forums as &$forum) {
        $fid = $forum['forum_id'] ?? '';
        $forum['tags'] = $tagMap[$fid] ?? [];
    }
    return $forums;
}
?>
