<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Services\SystemBackupService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class SystemBackupController extends Controller
{
    public function __invoke(Request $request, SystemBackupService $backups): Response
    {
        abort_unless($request->user()?->hasPermission('backups.manage'), 403);

        try {
            $path = $backups->create();
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => 'The system and database backup could not be generated. Please try again or contact the system administrator.',
            ], 500);
        }

        ActivityLog::query()->create([
            'user_id' => $request->user()->id,
            'event' => 'backup.system_database_created',
            'description' => 'Generated a system and database RMS backup.',
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        $filename = 'RMS-system-database-'.now()->format('Y-m-d-His').'.zip';

        return response()
            ->download($path, $filename, ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend(true);
    }
}
