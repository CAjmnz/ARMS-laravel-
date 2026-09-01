<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\FileType;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = in_array($request->string('tab')->toString(), ['general','file-types','logs','backup'], true)
            ? $request->string('tab')->toString()
            : 'general';

        $settings = SystemSetting::query()->orderBy('id')->get()->map(fn ($item) => [
            'id' => $item->id,
            'key' => $item->key,
            'value' => $item->value,
            'type' => $item->type,
            'group' => $item->group,
        ]);

        $fileSearch = trim($request->string('file_search')->toString());
        $fileTypes = FileType::query()
            ->when($fileSearch !== '', fn ($q) => $q->where('extension', 'like', '%'.$fileSearch.'%'))
            ->orderBy('extension')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'route_key' => $item->getRouteKey(),
                'extension' => $item->extension,
                'mime_types' => $item->mime_types ?? [],
                'maximum_size_kb' => $item->maximum_size_kb,
                'is_previewable' => (bool) $item->is_previewable,
                'is_active' => (bool) $item->is_active,
            ]);

        $logSearch = trim($request->string('log_search')->toString());
        $perPage = in_array((int) $request->integer('per_page'), [10,25,50,100], true) ? (int) $request->integer('per_page') : 10;
        $logs = ActivityLog::query()
            ->leftJoin('users', 'users.id', '=', 'activity_logs.user_id')
            ->when($logSearch !== '', function ($q) use ($logSearch) {
                $like = '%'.$logSearch.'%';
                $q->where(fn ($nested) => $nested->where('users.employee_id', 'like', $like)
                    ->orWhere('users.name', 'like', $like)
                    ->orWhere('activity_logs.event', 'like', $like)
                    ->orWhere('activity_logs.description', 'like', $like)
                    ->orWhere('activity_logs.ip_address', 'like', $like));
            })
            ->select('activity_logs.*', 'users.employee_id', 'users.name as user_name')
            ->latest('activity_logs.created_at')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn ($log) => [
                'id' => $log->id,
                'username' => $log->employee_id ?: ($log->user_name ?: $log->ip_address ?: 'System'),
                'date' => optional($log->created_at)->format('Y-m-d H:i:s'),
                'activity' => $log->description ?: $log->event,
                'source' => str_starts_with((string) $log->event, 'auth.') ? 'Administrator' : 'Records',
            ]);

        return Inertia::render('Administration/System/Index', [
            'activeTab' => $tab,
            'settings' => $settings,
            'fileTypes' => $fileTypes,
            'logs' => $logs,
            'filters' => ['file_search' => $fileSearch, 'log_search' => $logSearch, 'per_page' => $perPage],
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate(['settings' => ['required','array'], 'settings.*' => ['nullable','string','max:2000']]);
        foreach ($validated['settings'] as $id => $value) {
            SystemSetting::query()->whereKey($id)->update(['value' => $value ?? '', 'updated_by' => $request->user()->id]);
        }
        return back()->with('success', 'System settings were updated successfully.');
    }

    public function storeFileType(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'extension' => ['required','string','max:20','regex:/^[A-Za-z0-9]+$/',Rule::unique('file_types','extension')],
            'mime_types_text' => ['nullable','string','max:1000'],
            'maximum_size_kb' => ['required','integer','min:1','max:1048576'],
            'is_previewable' => ['required','boolean'],
        ]);
        FileType::query()->create([
            'extension' => strtolower($validated['extension']),
            'mime_types' => $this->mimeList($validated['mime_types_text'] ?? ''),
            'maximum_size_kb' => $validated['maximum_size_kb'],
            'is_previewable' => $validated['is_previewable'],
            'is_active' => true,
        ]);
        return back()->with('success', 'File type added successfully.');
    }

    public function updateFileType(Request $request, FileType $fileType): RedirectResponse
    {
        $validated = $request->validate([
            'extension' => ['required','string','max:20','regex:/^[A-Za-z0-9]+$/',Rule::unique('file_types','extension')->ignore($fileType->id)],
            'mime_types_text' => ['nullable','string','max:1000'],
            'maximum_size_kb' => ['required','integer','min:1','max:1048576'],
            'is_previewable' => ['required','boolean'],
        ]);
        $fileType->update([
            'extension' => strtolower($validated['extension']),
            'mime_types' => $this->mimeList($validated['mime_types_text'] ?? ''),
            'maximum_size_kb' => $validated['maximum_size_kb'],
            'is_previewable' => $validated['is_previewable'],
        ]);
        return back()->with('success', 'File type updated successfully.');
    }

    public function toggleFileType(FileType $fileType): RedirectResponse
    {
        $fileType->update(['is_active' => ! $fileType->is_active]);
        return back()->with('success', $fileType->is_active ? 'File type enabled.' : 'File type disabled.');
    }

    public function destroyFileType(FileType $fileType): RedirectResponse
    {
        $fileType->delete();
        return back()->with('success', 'File type deleted successfully.');
    }

    public function clearLogs(): RedirectResponse
    {
        ActivityLog::query()->delete();
        return back()->with('success', 'Access logs deleted successfully.');
    }

    private function mimeList(string $value): array
    {
        return collect(preg_split('/[,\r\n]+/', $value) ?: [])->map(fn ($v) => trim($v))->filter()->unique()->values()->all();
    }
}
