# Module 3 — Four Fixed Roles and Permissions

Module 3 preserves the CI3 four-level authorization model:

1. Level 4 — Super User
2. Level 3 — Administrator
3. Level 2 — View and Download
4. Level 1 — View Only

There is no role CRUD and no editable permission matrix. Level 4 remains protected and can only be created through the secure Artisan command. Only Level 4 has `documents.delete`.

## After installing the overlay

Run:

```bash
composer dump-autoload
php artisan optimize:clear
php artisan db:seed --class=RolePermissionSeeder
php artisan test
npm run build
```

The seeder is idempotent and updates the existing four Module 1 roles and permission assignments. One additive migration stores the legacy-compatible `allowed_upload` user setting independently from roles.

## Routes

- `GET /administration/roles-permissions` — read-only fixed-role reference for Levels 4 and 3.
- `PATCH /administration/users/{user}/role` — protected lower-role assignment endpoint for the future User Management screen.

Normal User Management cannot assign Level 4. Level 3 cannot manage itself, peer Administrators, or Super Users.
