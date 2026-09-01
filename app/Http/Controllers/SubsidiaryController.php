<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSubsidiaryRequest;
use App\Http\Requests\UpdateSubsidiaryRequest;
use App\Models\Subsidiary;
use App\Services\SubsidiaryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SubsidiaryController extends Controller
{
    public function index(Request $request, SubsidiaryService $service): Response
    {
        $this->authorize('viewAny', Subsidiary::class);

        $filters = $this->filters($request);
        $subsidiaries = Subsidiary::query()
            ->withCount(['departments', 'users', 'folders'])
            ->when($filters['search'], fn ($query, $search) => $query->where('name', 'like', '%'.$search.'%'))
            ->orderBy($filters['sort'], $filters['order'])
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (Subsidiary $subsidiary) => [
                'id' => $subsidiary->id,
                'route_key' => $subsidiary->getRouteKey(),
                'name' => $subsidiary->name,
                'status' => $subsidiary->status,
                'dependency_counts' => $service->dependencyCounts($subsidiary),
            ]);

        return Inertia::render('Administration/Subsidiaries', [
            'subsidiaries' => $subsidiaries,
            'filters' => $filters,
        ]);
    }

    public function store(StoreSubsidiaryRequest $request, SubsidiaryService $service): RedirectResponse
    {
        $service->create($request->validated(), $request->user(), $this->context($request));

        return to_route('administration.subsidiaries.index')->with('success', 'The subsidiary was added successfully.');
    }

    public function update(UpdateSubsidiaryRequest $request, Subsidiary $subsidiary, SubsidiaryService $service): RedirectResponse
    {
        $service->update($subsidiary, $request->validated(), $request->user(), $this->context($request));

        return back()->with('success', 'The subsidiary was updated successfully.');
    }

    public function destroy(Request $request, Subsidiary $subsidiary, SubsidiaryService $service): RedirectResponse
    {
        $this->authorize('delete', $subsidiary);
        $service->delete($subsidiary, $request->user(), $this->context($request));

        return back()->with('success', 'The subsidiary was deleted successfully.');
    }

    private function filters(Request $request): array
    {
        return [
            'search' => trim((string) $request->input('search', '')),
            'sort' => in_array($request->input('sort'), ['id', 'name'], true) ? $request->input('sort') : 'name',
            'order' => in_array($request->input('order'), ['asc', 'desc'], true) ? $request->input('order') : 'asc',
            'per_page' => in_array((int) $request->input('per_page'), [10, 25, 50, 100], true) ? (int) $request->input('per_page') : 10,
        ];
    }

    private function context(Request $request): array
    {
        return ['ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()];
    }
}
