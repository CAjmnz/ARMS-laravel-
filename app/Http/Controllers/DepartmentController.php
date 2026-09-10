<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDepartmentRequest;
use App\Http\Requests\UpdateDepartmentRequest;
use App\Models\Department;
use App\Models\Subsidiary;
use App\Services\DepartmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function index(Request $request, DepartmentService $service): Response
    {
        $this->authorize('viewAny', Department::class);

        $filters = $this->filters($request);
        $departments = Department::query()
            ->with('subsidiary:id,name')
            ->withCount(['users', 'folders'])
            ->when($filters['subsidiary_id'], fn ($query, $subsidiaryId) => $query->where('subsidiary_id', $subsidiaryId))
            ->when($filters['search'], function ($query, $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhereHas('subsidiary', fn ($query) => $query->where('name', 'like', '%'.$search.'%'));
                });
            })
            ->when($filters['sort'] === 'subsidiary', fn ($query) => $query->orderBy(
                Subsidiary::query()->select('name')->whereColumn('subsidiaries.id', 'departments.subsidiary_id'),
                $filters['order'],
            ), fn ($query) => $query->orderBy($filters['sort'], $filters['order']))
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (Department $department) => [
                'id' => $department->id,
                'route_key' => $department->getRouteKey(),
                'name' => $department->name,
                'status' => $department->status,
                'subsidiary_id' => $department->subsidiary_id,
                'subsidiary_name' => $department->subsidiary->name,
                'dependency_counts' => $service->dependencyCounts($department),
            ]);

        return Inertia::render('Administration/Departments', [
            'departments' => $departments,
            'filters' => $filters,
            'subsidiaries' => Subsidiary::query()->orderBy('name')->get(['id', 'name']),
            'selected_subsidiary' => $filters['subsidiary_id']
                ? Subsidiary::query()->find($filters['subsidiary_id'], ['id', 'name'])
                : null,
        ]);
    }

    public function store(StoreDepartmentRequest $request, DepartmentService $service): RedirectResponse
    {
        $service->create($request->validated(), $request->user(), $this->context($request));

        return to_route('administration.departments.index')->with('success', 'The department was added successfully.');
    }

    public function update(UpdateDepartmentRequest $request, Department $department, DepartmentService $service): RedirectResponse
    {
        $service->update($department, $request->validated(), $request->user(), $this->context($request));

        return back()->with('success', 'The department was updated successfully.');
    }

    public function destroy(Request $request, Department $department, DepartmentService $service): RedirectResponse
    {
        $this->authorize('delete', $department);
        $service->delete($department, $request->user(), $this->context($request));

        return back()->with('success', 'The department was deleted successfully.');
    }

    private function filters(Request $request): array
    {
        return [
            'search' => trim((string) $request->input('search', '')),
            'sort' => in_array($request->input('sort'), ['id', 'name', 'subsidiary'], true) ? $request->input('sort') : 'name',
            'order' => in_array($request->input('order'), ['asc', 'desc'], true) ? $request->input('order') : 'asc',
            'per_page' => in_array((int) $request->input('per_page'), [10, 25, 50, 100], true) ? (int) $request->input('per_page') : 10,
            'subsidiary_id' => $request->filled('subsidiary_id') ? (int) $request->input('subsidiary_id') : null,
        ];
    }

    private function context(Request $request): array
    {
        return ['ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()];
    }
}
