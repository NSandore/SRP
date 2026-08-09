# StudentSphere Newsroom

The Newsroom is a human-reviewed publishing workflow for super admins:

1. Sync the fixed U.S. Department of Education press-release source, or add a trusted article manually.
2. Review incoming metadata and open the original source.
3. Prepare an editable thread draft. When OpenAI is configured, the server uses the Responses API with a strict JSON schema; otherwise it creates a structured template.
4. Verify and edit the title and first post, choose a destination forum, and publish.
5. Publication atomically creates the thread and first post, then features the reviewed source in the public News rail.

Unreviewed and dismissed items are never returned by the public news endpoint.

## Access and safety

- Every admin endpoint re-reads the user's live database role and requires the exact super-admin role.
- The official sync fetches only the fixed HTTPS `ed.gov` source.
- Manual URLs are stored as metadata and are never fetched by the server.
- Imported source text is treated as untrusted input.
- Generated and edited rich text is sanitized before storage and again before thread publication.
- AI generation never publishes directly; a super admin must choose **Publish thread**.
- Publishing is transactional and idempotent, preventing duplicate threads.

## OpenAI configuration

AI drafting is optional. Add these server environment values to enable it:

```dotenv
OPENAI_API_KEY=...
NEWSROOM_AI_MODEL=gpt-5.6-sol
OPENAI_API_BASE_URL=https://api.openai.com/v1
```

`NEWSROOM_AI_MODEL` and `OPENAI_API_BASE_URL` are optional. The API key is read only by PHP and must never be exposed to the frontend.

## Source synchronization

Super admins can select **Sync Education News** from `/admin/newsroom`. For scheduled imports, run:

```bash
php backend/scripts/import_news.php
```

For example, run this command from cron every four hours. The importer hashes canonical source URLs, so repeated syncs refresh metadata instead of creating duplicates.

## Database

Apply `backend/migrations/20260803_newsroom.sql` through the normal migration runner. Runtime table initialization is retained as a compatibility fallback for existing development installs.
