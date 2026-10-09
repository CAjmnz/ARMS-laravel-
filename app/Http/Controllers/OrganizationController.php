<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\GroupConsolidatedFs;
use App\Models\OrganizationDivision;
use App\Models\OrganizationLocation;
use App\Models\OrganizationSubdivision;
use App\Models\Subsidiary;
use App\Services\OrganizationCodeGenerator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    public function __construct(
        private readonly OrganizationCodeGenerator $codeGenerator,
    ) {
    }

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Subsidiary::class);

        $subsidiaries = Subsidiary::query()
            ->orderBy('name')
            ->with([
                'organizationDivisions' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions' => fn ($q) => $q->whereNull('parent_id')->orderBy('name'),
                'organizationDivisions.subdivisions.departments' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.departments.locations' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.locations' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.groups' => fn ($q) => $q->orderBy('name')->with('locations:id,name'),
                'organizationDivisions.subdivisions.children' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.children.departments' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.children.departments.locations' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.children.locations' => fn ($q) => $q->orderBy('name'),
                'organizationDivisions.subdivisions.children.groups' => fn ($q) => $q->orderBy('name')->with('locations:id,name'),
            ])
            ->get();

        return Inertia::render('Administration/Organization', [
            'subsidiaries' => $subsidiaries->map(fn (Subsidiary $subsidiary) => [
                'id' => $subsidiary->id,
                'route_key' => $subsidiary->getRouteKey(),
                'name' => $subsidiary->name,
                'status' => $subsidiary->status,
                'divisions' => $subsidiary->organizationDivisions->map(fn ($division) => [
                    'id' => $division->id,
                    'code' => $division->code,
                    'name' => $division->name,
                    'subdivisions' => $division->subdivisions->map(fn (OrganizationSubdivision $subdivision) => $this->mapSubdivision($subdivision))->values(),
                ])->values(),
            ])->values(),
        ]);
    }

    public function storeDivision(Request $request): RedirectResponse
    {
        $this->authorize('create', Subsidiary::class);

        $data = $request->validate([
            'subsidiary_id' => ['required', 'integer', 'exists:subsidiaries,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
        ]);

        OrganizationDivision::create([
            'subsidiary_id' => $data['subsidiary_id'],
            'name' => trim($data['name']),
            'code' => filled($data['code'] ?? null) ? trim($data['code']) : null,
            'status' => 'active',
        ]);

        return back()->with('success', 'Division added successfully.');
    }

    public function updateDivision(Request $request, OrganizationDivision $division): RedirectResponse
    {
        $this->authorize('update', $division->subsidiary);
        $data = $request->validate(['name' => ['required', 'string', 'max:150'], 'code' => ['nullable', 'string', 'max:50']]);
        $division->update(['name' => trim($data['name']), 'code' => filled($data['code'] ?? null) ? trim($data['code']) : null]);
        return back()->with('success', 'Division updated successfully.');
    }

    public function destroyDivision(OrganizationDivision $division): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        abort_if($division->subdivisions()->exists(), 422, 'Delete its sub-divisions first.');
        $division->delete();
        return back()->with('success', 'Division deleted successfully.');
    }

    public function updateSubdivision(Request $request, OrganizationSubdivision $subdivision): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:150'], 'code' => ['nullable', 'string', 'max:50']]);
        $subdivision->update(['name' => trim($data['name']), 'code' => filled($data['code'] ?? null) ? trim($data['code']) : null]);
        return back()->with('success', 'Sub-division updated successfully.');
    }

    public function destroySubdivision(OrganizationSubdivision $subdivision): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        abort_if($subdivision->children()->exists() || $subdivision->departments()->exists() || $subdivision->locations()->exists() || $subdivision->groups()->exists(), 422, 'Delete its child sub-divisions, departments, locations, and groups first.');
        $subdivision->delete();
        return back()->with('success', 'Sub-division deleted successfully.');
    }

    public function storeDepartment(Request $request): RedirectResponse
    {
        $this->authorize('create', Subsidiary::class);
        $data = $request->validate([
            'subdivision_id' => ['required', 'integer', 'exists:organization_subdivisions,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
        ]);
        $subdivision = OrganizationSubdivision::query()->findOrFail($data['subdivision_id']);
        $name = trim($data['name']);
        $subsidiaryId = $subdivision->division->subsidiary_id;
        $code = filled($data['code'] ?? null)
            ? trim($data['code'])
            : $this->codeGenerator->next(
                Department::query()->where('subsidiary_id', $subsidiaryId),
                $name,
            );

        $department = Department::query()->create([
            'subsidiary_id' => $subsidiaryId,
            'subdivision_id' => $subdivision->id,
            'name' => $name,
            'code' => $code,
            'status' => 'active',
        ]);
        return back()->with('success', 'Department added successfully.');
    }

    public function updateDepartment(Request $request, Department $department): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:150'], 'code' => ['nullable', 'string', 'max:50']]);
        $name = trim($data['name']);
        $code = filled($data['code'] ?? null)
            ? trim($data['code'])
            : $this->codeGenerator->next(
                Department::query()->where('subsidiary_id', $department->subsidiary_id)->where('id', '!=', $department->id),
                $name,
            );
        $department->update(['name' => $name, 'code' => $code]);
        return back()->with('success', 'Department updated successfully.');
    }

    public function destroyDepartment(Department $department): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        abort_if($department->users()->exists() || $department->folders()->exists() || $department->locations()->exists(), 422, 'Delete its users, folders, and locations first.');
        $department->delete();
        return back()->with('success', 'Department deleted successfully.');
    }

    public function updateLocation(Request $request, OrganizationLocation $location): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
        ]);
        if (!empty($data['department_id'])) {
            abort_unless(Department::query()->whereKey($data['department_id'])->where('subdivision_id', $location->subdivision_id)->exists(), 422, 'The department must belong to the location sub-division.');
        }
        $location->update(['name' => trim($data['name']), 'code' => filled($data['code'] ?? null) ? trim($data['code']) : null, 'department_id' => $data['department_id'] ?? null]);
        return back()->with('success', 'Location updated successfully.');
    }

    public function destroyLocation(OrganizationLocation $location): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        abort_if($location->groups()->exists(), 422, 'Remove this location from its Group Consolidated FS first.');
        $location->delete();
        return back()->with('success', 'Location deleted successfully.');
    }

    public function updateGroup(Request $request, GroupConsolidatedFs $group): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:150'], 'code' => ['nullable', 'string', 'max:50'], 'location_ids' => ['required', 'array', 'min:1'], 'location_ids.*' => ['integer', 'exists:organization_locations,id']]);
        $locationIds = OrganizationLocation::query()->where('subdivision_id', $group->subdivision_id)->whereIn('id', $data['location_ids'])->pluck('id')->all();
        abort_unless(count($locationIds) === count(array_unique(array_map('intval', $data['location_ids']))), 422, 'Every selected location must belong to the group sub-division.');
        DB::transaction(function () use ($group, $data, $locationIds): void {
            $group->update(['name' => trim($data['name']), 'code' => filled($data['code'] ?? null) ? trim($data['code']) : null]);
            $group->locations()->sync($locationIds);
        });
        return back()->with('success', 'Group Consolidated FS updated successfully.');
    }

    public function destroyGroup(GroupConsolidatedFs $group): RedirectResponse
    {
        abort_unless(auth()->user()->isSuperUser(), 403);
        DB::transaction(function () use ($group): void {
            $group->locations()->detach();
            $group->delete();
        });
        return back()->with('success', 'Group Consolidated FS deleted successfully.');
    }

    public function storeSubdivision(Request $request): RedirectResponse
    {
        $this->authorize('create', Subsidiary::class);

        $data = $request->validate([
            'division_id' => ['required', 'integer', 'exists:organization_divisions,id'],
            'parent_id' => ['nullable', 'integer', 'exists:organization_subdivisions,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
        ]);

        if (!empty($data['parent_id'])) {
            $parent = OrganizationSubdivision::query()->findOrFail($data['parent_id']);
            abort_unless($parent->division_id === (int) $data['division_id'], 422, 'The parent sub-division must belong to the selected division.');
        }

        OrganizationSubdivision::create([
            'division_id' => $data['division_id'],
            'parent_id' => $data['parent_id'] ?? null,
            'name' => trim($data['name']),
            'code' => filled($data['code'] ?? null) ? trim($data['code']) : null,
            'status' => 'active',
        ]);

        return back()->with('success', 'Sub-division added successfully.');
    }

    public function storeLocation(Request $request): RedirectResponse
    {
        $this->authorize('create', Subsidiary::class);

        $data = $request->validate([
            'subdivision_id' => ['required', 'integer', 'exists:organization_subdivisions,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
        ]);

        $department = Department::query()->findOrFail($data['department_id']);
        abort_unless($department->subdivision_id === (int) $data['subdivision_id'], 422, 'The department must belong to the selected sub-division.');

        OrganizationLocation::create([
            'subdivision_id' => $data['subdivision_id'],
            'department_id' => $data['department_id'],
            'name' => trim($data['name']),
            'code' => filled($data['code'] ?? null) ? trim($data['code']) : null,
            'status' => 'active',
        ]);

        return back()->with('success', 'Location added successfully.');
    }

    public function storeGroup(Request $request): RedirectResponse
    {
        $this->authorize('create', Subsidiary::class);

        $data = $request->validate([
            'subdivision_id' => ['required', 'integer', 'exists:organization_subdivisions,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'location_ids' => ['required', 'array', 'min:1'],
            'location_ids.*' => ['integer', 'exists:organization_locations,id'],
        ]);

        $locationIds = OrganizationLocation::query()
            ->where('subdivision_id', $data['subdivision_id'])
            ->whereIn('id', $data['location_ids'])
            ->pluck('id')
            ->all();

        abort_unless(count($locationIds) === count(array_unique(array_map('intval', $data['location_ids']))), 422, 'Every selected location must belong to the selected sub-division.');

        DB::transaction(function () use ($data, $locationIds): void {
            $group = GroupConsolidatedFs::create([
                'subdivision_id' => $data['subdivision_id'],
                'name' => trim($data['name']),
                'code' => filled($data['code'] ?? null) ? trim($data['code']) : null,
                'status' => 'active',
            ]);

            $group->locations()->sync($locationIds);
        });

        return back()->with('success', 'Group Consolidated FS added successfully.');
    }

    private function mapSubdivision(OrganizationSubdivision $subdivision): array
    {
        return [
            'id' => $subdivision->id,
            'code' => $subdivision->code,
            'name' => $subdivision->name,
            'departments' => $subdivision->departments->map(fn (Department $department) => [
                'id' => $department->id,
                'code' => $department->code,
                'name' => $department->name,
                'locations' => $department->locations->map(fn ($location) => [
                    'id' => $location->id,
                    'code' => $location->code,
                    'name' => $location->name,
                ])->values(),
            ])->values(),
            'locations' => $subdivision->locations->whereNull('department_id')->map(fn ($location) => [
                'id' => $location->id,
                'code' => $location->code,
                'name' => $location->name,
            ])->values(),
            'groups' => $subdivision->groups->map(fn ($group) => [
                'id' => $group->id,
                'code' => $group->code,
                'name' => $group->name,
                'locations' => $group->locations->map(fn ($location) => [
                    'id' => $location->id,
                    'name' => $location->name,
                ])->values(),
            ])->values(),
            'children' => $subdivision->children->map(fn (OrganizationSubdivision $child) => $this->mapSubdivision($child))->values(),
        ];
    }
}
