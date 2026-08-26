<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DepartmentService
{
    public function __construct(
        private readonly OrganizationCodeGenerator $codeGenerator,
    ) {
    }

    public function create(array $attributes, User $actor, array $context): Department
    {
        return DB::transaction(function () use ($attributes, $actor, $context): Department {
            $department = Department::query()->create([
                'subsidiary_id' => $attributes['subsidiary_id'],
                'code' => $this->codeGenerator->next(
                    Department::query()->where('subsidiary_id', $attributes['subsidiary_id']),
                    $attributes['name'],
                ),
                'name' => $attributes['name'],
                'status' => 'active',
            ]);

            $this->log($actor, 'department.created', $department, null, $department->only(['subsidiary_id', 'code', 'name', 'status']), $context);

            return $department;
        });
    }

    public function update(Department $department, array $attributes, User $actor, array $context): void
    {
        DB::transaction(function () use ($department, $attributes, $actor, $context): void {
            $oldValues = $department->only(['subsidiary_id', 'code', 'name', 'status']);
            $department->update([
                'subsidiary_id' => $attributes['subsidiary_id'],
                'name' => $attributes['name'],
            ]);

            $this->log($actor, 'department.updated', $department, $oldValues, $department->fresh()->only(['subsidiary_id', 'code', 'name', 'status']), $context);
        });
    }

    public function delete(Department $department, User $actor, array $context): void
    {
        $counts = $this->dependencyCounts($department);

        if (array_sum($counts) > 0) {
            $this->log($actor, 'department.delete_blocked', $department, null, $counts, $context);

            throw ValidationException::withMessages([
                'organization' => 'This department cannot be deleted because it is currently used by a user account or records folder.',
            ]);
        }

        DB::transaction(function () use ($department, $actor, $context): void {
            $values = $department->only(['subsidiary_id', 'code', 'name', 'status']);
            $department->delete();
            $this->log($actor, 'department.deleted', $department, $values, null, $context);
        });
    }

    public function dependencyCounts(Department $department): array
    {
        return [
            'users' => $department->users()->count(),
            'folders' => $department->folders()->count(),
        ];
    }

    private function log(User $actor, string $event, Department $department, ?array $oldValues, ?array $newValues, array $context): void
    {
        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'event' => $event,
            'auditable_type' => Department::class,
            'auditable_id' => $department->id,
            'description' => 'Organization management action for department '.$department->name.'.',
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $context['ip_address'],
            'user_agent' => $context['user_agent'],
        ]);
    }
}
