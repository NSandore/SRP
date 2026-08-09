<?php

declare(strict_types=1);

final class SrpInstitutionExporter
{
    /** @var list<string> */
    private const COLUMNS = [
        'id',
        'ipeds_unitid',
        'ope_id',
        'wikidata_id',
        'name',
        'official_name',
        'aliases',
        'former_names',
        'address',
        'city',
        'state',
        'zip',
        'county',
        'location',
        'website',
        'normalized_domain',
        'phone',
        'latitude',
        'longitude',
        'institution_sector',
        'institution_level',
        'institution_control',
        'accreditor',
        'degree_granting',
        'operating_status',
        'is_hbcu',
        'is_tribal_college',
        'source_reporting_year',
        'primary_color',
        'secondary_color',
        'motto',
        'slogan',
        'tagline',
        'nickname',
        'logo_path',
        'logo_url',
        'logo_thumbnail_url',
        'logo_type',
        'logo_mime_type',
        'logo_license_name',
        'logo_license_url',
        'logo_attribution',
        'logo_width',
        'logo_height',
        'pipeline_active',
        'pipeline_review_required',
        'pipeline_data_confidence',
        'first_seen_at',
        'last_seen_at',
        'last_directory_refresh_at',
        'last_branding_refresh_at',
        'last_logo_check_at',
        'created_at',
        'updated_at',
    ];

    public static function export(
        PDO $db,
        string $format,
        string $destinationDirectory,
        ?string $requestedPath = null,
        bool $includeInactive = true
    ): string {
        SrpInstitutionSchema::assertReady($db);
        $format = strtolower($format);
        if (!in_array($format, ['csv', 'json'], true)) {
            throw new InvalidArgumentException('Institution export format must be csv or json.');
        }

        if (!is_dir($destinationDirectory)
            && !mkdir($destinationDirectory, 0770, true)
            && !is_dir($destinationDirectory)
        ) {
            throw new RuntimeException('Unable to create the institution export directory.');
        }

        if ($requestedPath !== null) {
            $path = $requestedPath;
            if (!self::isAbsolutePath($path)) {
                $path = rtrim($destinationDirectory, DIRECTORY_SEPARATOR)
                    . DIRECTORY_SEPARATOR . $path;
            }
        } else {
            $path = rtrim($destinationDirectory, DIRECTORY_SEPARATOR)
                . DIRECTORY_SEPARATOR
                . 'institutions-' . gmdate('Ymd\THis\Z') . '.' . $format;
        }
        if (strtolower((string)pathinfo($path, PATHINFO_EXTENSION)) !== $format) {
            throw new InvalidArgumentException("Institution export path must end in .{$format}.");
        }
        if (str_contains($path, "\0")) {
            throw new InvalidArgumentException('Institution export path is invalid.');
        }
        $parent = dirname($path);
        if (!is_dir($parent) && !mkdir($parent, 0770, true) && !is_dir($parent)) {
            throw new RuntimeException('Unable to create the institution export parent directory.');
        }

        $where = "community_type = 'university'";
        if (!$includeInactive) {
            $where .= ' AND COALESCE(pipeline_active, 1) = 1';
        }
        $query = sprintf(
            'SELECT %s FROM communities WHERE %s ORDER BY name, id',
            implode(', ', array_map(static fn(string $column): string => "`{$column}`", self::COLUMNS)),
            $where
        );
        $statement = $db->query($query);
        $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
        $handle = fopen($temporary, 'xb');
        if ($handle === false) {
            throw new RuntimeException('Unable to create the institution export.');
        }
        @chmod($temporary, 0660);

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock the institution export.');
            }
            if ($format === 'csv') {
                fputcsv($handle, self::COLUMNS);
                while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
                    $values = [];
                    foreach (self::COLUMNS as $column) {
                        $values[] = $row[$column] ?? null;
                    }
                    fputcsv($handle, $values);
                }
            } else {
                fwrite($handle, "[\n");
                $first = true;
                while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
                    foreach (['aliases', 'former_names'] as $jsonColumn) {
                        if (isset($row[$jsonColumn]) && is_string($row[$jsonColumn])) {
                            $decoded = json_decode($row[$jsonColumn], true);
                            if (is_array($decoded)) {
                                $row[$jsonColumn] = $decoded;
                            }
                        }
                    }
                    $encoded = json_encode(
                        $row,
                        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
                    );
                    fwrite($handle, ($first ? '' : ",\n") . '  ' . $encoded);
                    $first = false;
                }
                fwrite($handle, "\n]\n");
            }
            fflush($handle);
            flock($handle, LOCK_UN);
            fclose($handle);
            $handle = null;
            if (!rename($temporary, $path)) {
                throw new RuntimeException('Unable to publish the institution export.');
            }
        } catch (Throwable $error) {
            if (is_resource($handle)) {
                flock($handle, LOCK_UN);
                fclose($handle);
            }
            @unlink($temporary);
            throw $error;
        }

        return $path;
    }

    private static function isAbsolutePath(string $path): bool
    {
        return str_starts_with($path, DIRECTORY_SEPARATOR)
            || preg_match('/^[A-Za-z]:[\\\\\\/]/', $path) === 1;
    }
}
