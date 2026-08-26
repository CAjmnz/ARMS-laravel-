<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Subsidiary;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SubsidiaryService
{
    public function __construct(
        private readonly OrganizationCodeGenerator $codeGenerator,
    ) {
    }

    public function create(array $attributes, User $actor, array $context): Subsidiary
    {
        return DB::transaction(function () use ($attributes, $actor, $context): Subsidiary {
            $subsidiary = Subsidiary::query()->create([
                'code' => $this->codeGenerator->next(Subsidiary::query(), $attributes['name']),
                'name' => $attributes['name'],
                'status' => 'active',
            ]);

            $this->log($actor, 'subsidiary.created', $subsidiary, null, $subsidiary->only(['code', 'name', 'status']), $context);

            return $subsidiary;
        });
    }

    public function update(Subsidiary $subsidiary, array $attributes, User $actor, array $context): void
    {
        DB::transaction(function () use ($subsidiary, $attributes, $actor, $context): void {
            $oldValues = $subsidiary->only(['code', 'name', 'status']);
            $subsidiary->update(['name' => $attributes['name']]);

            $this->log($actor, 'subsidiary.updated', $subsidiary, $oldValues, $subsidiary->fresh()->only(['code', 'name', 'status']), $context);
        });
    }

    public function delete(Subsidiary $subsidiary, User $actor, array $context): void
    {
        $counts = $this->dependencyCounts($subsidiary);

        if (array_sum($counts) > 0) {
            $this->log($actor, 'subsidiary.delete_blocked', $subsidiary, null, $counts, $context);

            throw ValidationException::withMessages([
                'organization' => 'This subsidiary cannot be deleted because it is currently used by a department, user account, or records folder.',
            ]);
        }

        DB::transaction(function () use ($subsidiary, $actor, $context): void {
            $values = $subsidiary->only(['code', 'name', 'status']);
            $subsidiary->delete();
            $this->log($actor, 'subsidiary.deleted', $subsidiary, $values, null, $context);
        });
    }

    public function dependencyCounts(Subsidiary $subsidiary): array
    {
        return [
            'departments' => $subsidiary->departments()->count(),
            'users' => $subsidiary->users()->count(),
            'folders' => $subsidiary->folders()->count(),
        ];
    }

    private function log(User $actor, string $event, Subsidiary $subsidiary, ?array $oldValues, ?array $newValues, array $context): void
    {
        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'event' => $event,
            'auditable_type' => Subsidiary::class,
            'auditable_id' => $subsidiary->id,
            'description' => 'Organization management action for subsidiary '.$subsidiary->name.'.',
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $context['ip_address'],
            'user_agent' => $context['user_agent'],
        ]);
    }
}
