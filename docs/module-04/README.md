# Module 4 — Application Shell and Dashboard

Module 4 adds the responsive ARMS authenticated shell and a database-backed
infographic dashboard. The visual design follows the approved forest-green,
gold, warm-white and serif-heading reference.

## Dashboard data

- Pending: unpublished folders.
- Documents: non-deleted document records.
- Users: non-deleted registered accounts.
- Online: distinct database sessions active during the last 15 minutes.
- Document Status: published and unpublished folder totals.
- Document Activity: uploads for the latest six calendar months and the
  cumulative document total.

The publication migration is additive. Existing folders are treated as
unpublished until a later authorized folder-management module publishes them.

## Installation

Run the following commands after extracting the overlay into the Laravel root:

```bat
composer dump-autoload
php artisan optimize:clear
php artisan migrate
php artisan test
npm install
npm run build
```

Do not run `migrate:fresh` against an existing database.
