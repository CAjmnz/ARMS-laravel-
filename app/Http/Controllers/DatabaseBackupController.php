<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Services\DatabaseBackupService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DatabaseBackupController extends Controller
{
    public function __invoke(Request $request, DatabaseBackupService $backups): Response
    {
        abort_unless($request->user()?->hasPermission('backups.manage'), 403);

        try {
            $path = $backups->create();
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => 'The database backup could not be generated. Please try again or contact the system administrator.',
            ], 500);
        }

        ActivityLog::query()->create([
            'user_id' => $request->user()->id,
            'event' => 'backup.database_created',
            'description' => 'Generated a database-only RMS backup.',
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        $filename = 'RMS-database-'.now()->format('Y-m-d-His').'.sql';

        return response()
            ->download($path, $filename, ['Content-Type' => 'application/sql; charset=UTF-8'])
            ->deleteFileAfterSend(true);
    }
}
