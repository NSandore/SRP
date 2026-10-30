# Information Board translations

Database-driven translation is intentionally limited to the Information Board
community and its forum, thread, and post content. Events, polls, other
communities, profiles, and saved/search feeds are not sent for translation.

## Setup

1. Apply pending database migrations:

   ```bash
   php backend/scripts/run_migrations.php
   ```

2. Configure the backend environment:

   ```dotenv
   OPENAI_API_KEY=your-server-side-api-key
   ```

Optional settings:

```dotenv
INFO_TRANSLATION_MODEL=gpt-5.6-luna
INFO_TRANSLATION_TIMEOUT_SECONDS=30
INFO_TRANSLATION_MAX_FIELD_CHARS=12000
INFO_TRANSLATION_MAX_BATCH_CHARS=24000
INFO_BOARD_COMMUNITY_ID=c57b7fd6c45b9d57b
OPENAI_API_BASE_URL=https://api.openai.com/v1
```

Keep `OPENAI_API_KEY` server-side. It must never be added to the React build or
returned to the browser.

## Behavior

- English requests return the stored database content directly.
- A supported non-English request first checks `info_board_translations`.
- Missing fields are translated in bounded batches and cached by entity, field,
  language, and a SHA-256 hash of the source text.
- Editing source content changes its hash, so the next request generates a fresh
  translation automatically.
- Translation-provider failures are non-fatal and return the original content.
- API responses retain `original_<field>`, `translation_language`, and
  `is_translated` metadata so editing and moderation always use the source text.
