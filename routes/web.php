<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DatabaseBackupController;
use App\Http\Controllers\DocumentAccessManagementController;
use App\Http\Controllers\DocumentController;
use App\Models\Department;
use App\Models\Document;
use App\Models\Folder;
use App\Models\User;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\FolderManagementController;
use App\Http\Controllers\SubsidiaryController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoleReferenceController;
use App\Http\Controllers\UserRoleController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\UserPinController;
use App\Http\Controllers\SystemSettingsController;
use App\Http\Controllers\UserPortalController;
use App\Http\Controllers\ReceivingController;
use App\Http\Controllers\ScanningKeepsafeController;
use App\Http\Controllers\SystemBackupController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $now = now();

    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => false,
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
        'landingStats' => [
            'documents' => Document::query()->count(),
            'folders' => Folder::query()->count(),
            'users' => User::query()->count(),
            'departments' => Department::query()->count(),
            'online' => DB::table('sessions')
                ->whereNotNull('user_id')
                ->where('last_activity', '>=', $now->copy()->subMinutes(15)->timestamp)
                ->distinct()
                ->count('user_id'),
        ],
    ]);
});

Route::get('/dashboard', DashboardController::class)
    ->middleware(['auth', 'active', 'password.changed', 'session.timeout'])
    ->name('dashboard');

Route::middleware(['auth', 'active', 'password.changed', 'session.timeout'])->prefix('portal')->name('portal.')->group(function () {
    Route::get('/dashboard', [UserPortalController::class, 'dashboard'])->name('dashboard');
    Route::get('/documents/{folder?}', [UserPortalController::class, 'documents'])->name('documents');
});

Route::middleware(['auth', 'active', 'password.changed', 'session.timeout'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/receiving', [ReceivingController::class, 'index'])->middleware('permission:receiving.manage')->name('receiving.index');
    Route::post('/receiving', [ReceivingController::class, 'store'])->middleware('permission:receiving.manage')->name('receiving.store');
    Route::get('/receiving/{receivingRecord}', [ReceivingController::class, 'show'])->middleware('permission:receiving.manage')->name('receiving.show');
    Route::patch('/receiving/{receivingRecord}/status', [ReceivingController::class, 'updateStatus'])->middleware('permission:receiving.manage')->name('receiving.status');

    Route::get('/scanning-keepsafe', [ScanningKeepsafeController::class, 'index'])->middleware('permission:scanning-keepsafe.manage')->name('scanning-keepsafe.index');
    Route::post('/scanning-keepsafe', [ScanningKeepsafeController::class, 'store'])->middleware('permission:scanning-keepsafe.manage')->name('scanning-keepsafe.store');
    Route::get('/scanning-keepsafe/{scanningKeepsafeRequest}', [ScanningKeepsafeController::class, 'show'])->middleware('permission:scanning-keepsafe.manage')->name('scanning-keepsafe.show');
    Route::patch('/scanning-keepsafe/{scanningKeepsafeRequest}', [ScanningKeepsafeController::class, 'update'])->middleware('permission:scanning-keepsafe.manage')->name('scanning-keepsafe.update');

    Route::get('/documents/manage/{folder?}', [FolderManagementController::class, 'index'])
        ->name('documents.manage');
    Route::post('/documents/manage/filenames', [FolderManagementController::class, 'storeRoot'])
        ->name('documents.filenames.store');
    Route::post('/documents/manage/{folder}/folders', [FolderManagementController::class, 'store'])
        ->name('documents.folders.store');
    Route::post('/documents/manage/{folder}/folders/bulk', [FolderManagementController::class, 'bulkStore'])
        ->name('documents.folders.bulk-store');
    Route::patch('/documents/manage/{folder}/publish', [FolderManagementController::class, 'publish'])
        ->name('documents.folders.publish');
    Route::patch('/documents/manage/{folder}/unpublish', [FolderManagementController::class, 'unpublish'])
        ->name('documents.folders.unpublish');
    Route::patch('/documents/bulk-publish', [FolderManagementController::class, 'bulkPublish'])
        ->name('documents.bulk-publish');
    Route::patch('/documents/bulk-unpublish', [FolderManagementController::class, 'bulkUnpublish'])
        ->name('documents.bulk-unpublish');
    Route::patch('/documents/manage/{folder}', [FolderManagementController::class, 'rename'])
        ->name('documents.folders.rename');
    Route::delete('/documents/manage/{folder}', [FolderManagementController::class, 'destroy'])
        ->name('documents.folders.destroy');
    Route::get('/documents/folders/{folder}/hierarchy-preview', [FolderManagementController::class, 'hierarchyPreview'])
        ->name('documents.folders.hierarchy-preview');
    Route::delete('/documents/folders/{folder}/hierarchy', [FolderManagementController::class, 'destroyHierarchy'])
        ->name('documents.folders.hierarchy-destroy');
    Route::post('/documents/bulk-download', [DocumentController::class, 'bulkDownload'])->name('documents.bulk-download');
    Route::patch('/documents/bulk-transfer', [DocumentController::class, 'bulkMove'])->name('documents.bulk-move');
    Route::delete('/documents/bulk-delete', [FolderManagementController::class, 'bulkDelete'])->name('documents.bulk-delete');
    Route::post('/documents/folders/{folder}/upload', [DocumentController::class, 'upload'])->name('documents.upload');
    Route::post('/documents/folders/{folder}/upload-folder', [DocumentController::class, 'uploadFolder'])->name('documents.upload-folder');
    Route::post('/documents/upload-folder', [DocumentController::class, 'uploadFolderFromRoot'])->name('documents.upload-folder-root');
    Route::get('/documents/manage/{folder}/files', [DocumentController::class, 'files'])->name('documents.files.index');
    Route::get('/documents/folders/{folder}/information', [FolderManagementController::class, 'information'])->name('documents.folders.information');
    Route::get('/documents/{document}/information', [DocumentController::class, 'information'])->name('documents.information');
    Route::get('/documents/access/users', [DocumentAccessManagementController::class, 'users'])->name('documents.access.users');
    Route::post('/documents/folders/{folder}/access', [DocumentAccessManagementController::class, 'grantFolder'])->name('documents.folders.access.grant');
    Route::delete('/documents/folders/{folder}/access/{user}', [DocumentAccessManagementController::class, 'removeFolder'])->name('documents.folders.access.remove');
    Route::post('/documents/{document}/access', [DocumentAccessManagementController::class, 'grantDocument'])->name('documents.access.grant');
    Route::delete('/documents/{document}/access/{user}', [DocumentAccessManagementController::class, 'removeDocument'])->name('documents.access.remove');
    Route::get('/documents/pins', [UserPinController::class, 'index'])->name('documents.pins.index');
    Route::patch('/documents/folders/{folder}/pin', [UserPinController::class, 'folder'])->name('documents.folders.pin');
    Route::patch('/documents/{document}/pin', [UserPinController::class, 'document'])->name('documents.pin');
    Route::get('/documents/{document}', [DocumentController::class, 'show'])->name('documents.show');
    Route::get('/documents/{document}/edit', [DocumentController::class, 'edit'])->name('documents.edit');
    Route::patch('/documents/{document}', [DocumentController::class, 'update'])->name('documents.update');
    Route::patch('/documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
    Route::get('/documents/{document}/viewer', [DocumentController::class, 'viewer'])->name('documents.viewer');
    Route::get('/documents/{document}/download', [DocumentController::class, 'downloadViewer'])->name('documents.download');
    Route::get('/documents/{document}/original', [DocumentController::class, 'downloadOriginal'])->name('documents.original');

    Route::get('/administration/organization', [OrganizationController::class, 'index'])
        ->name('administration.organization.index');
    Route::post('/administration/organization/divisions', [OrganizationController::class, 'storeDivision'])
        ->name('administration.organization.divisions.store');
    Route::patch('/administration/organization/divisions/{division}', [OrganizationController::class, 'updateDivision'])
        ->name('administration.organization.divisions.update');
    Route::delete('/administration/organization/divisions/{division}', [OrganizationController::class, 'destroyDivision'])
        ->name('administration.organization.divisions.destroy');
    Route::post('/administration/organization/subdivisions', [OrganizationController::class, 'storeSubdivision'])
        ->name('administration.organization.subdivisions.store');
    Route::patch('/administration/organization/subdivisions/{subdivision}', [OrganizationController::class, 'updateSubdivision'])
        ->name('administration.organization.subdivisions.update');
    Route::delete('/administration/organization/subdivisions/{subdivision}', [OrganizationController::class, 'destroySubdivision'])
        ->name('administration.organization.subdivisions.destroy');
    Route::post('/administration/organization/departments', [OrganizationController::class, 'storeDepartment'])
        ->name('administration.organization.departments.store');
    Route::patch('/administration/organization/departments/{department}', [OrganizationController::class, 'updateDepartment'])
        ->name('administration.organization.departments.update');
    Route::delete('/administration/organization/departments/{department}', [OrganizationController::class, 'destroyDepartment'])
        ->name('administration.organization.departments.destroy');
    Route::post('/administration/organization/locations', [OrganizationController::class, 'storeLocation'])
        ->name('administration.organization.locations.store');
    Route::patch('/administration/organization/locations/{location}', [OrganizationController::class, 'updateLocation'])
        ->name('administration.organization.locations.update');
    Route::delete('/administration/organization/locations/{location}', [OrganizationController::class, 'destroyLocation'])
        ->name('administration.organization.locations.destroy');
    Route::post('/administration/organization/groups', [OrganizationController::class, 'storeGroup'])
        ->name('administration.organization.groups.store');
    Route::patch('/administration/organization/groups/{group}', [OrganizationController::class, 'updateGroup'])
        ->name('administration.organization.groups.update');
    Route::delete('/administration/organization/groups/{group}', [OrganizationController::class, 'destroyGroup'])
        ->name('administration.organization.groups.destroy');

    Route::resource('/administration/subsidiaries', SubsidiaryController::class)
        ->except(['create', 'edit', 'show'])
        ->names('administration.subsidiaries');
    Route::resource('/administration/departments', DepartmentController::class)
        ->except(['create', 'edit', 'show'])
        ->names('administration.departments');

    Route::get('/administration/users', [UserManagementController::class, 'index'])->middleware('permission:users.manage')->name('users.index');
    Route::post('/administration/users', [UserManagementController::class, 'store'])->middleware('permission:users.manage')->name('users.store');
    Route::patch('/administration/users/{user}', [UserManagementController::class, 'update'])->middleware('permission:users.manage')->name('users.update');
    Route::post('/administration/users/{user}/force-logout', [UserManagementController::class, 'forceLogout'])->middleware('permission:users.manage')->name('users.force-logout');
    Route::patch('/administration/users/{user}/block', [UserManagementController::class, 'toggleBlock'])->middleware('permission:users.manage')->name('users.block');
    Route::patch('/administration/users/{user}/viewer', [UserManagementController::class, 'viewer'])->middleware('permission:users.manage')->name('users.viewer');
    Route::patch('/administration/users/{user}/uploader', [UserManagementController::class, 'uploader'])->middleware('permission:users.manage')->name('users.uploader');
    Route::get('/administration/users/{user}/access', [UserManagementController::class, 'accessData'])->middleware('permission:users.manage')->name('users.access.data');
    Route::patch('/administration/users/{user}/access', [UserManagementController::class, 'updateAccess'])->middleware('permission:users.manage')->name('users.access.update');
    Route::get('/administration/users/{user}/export', [UserManagementController::class, 'export'])->middleware('permission:users.manage')->name('users.export');
    Route::delete('/administration/users/{user}', [UserManagementController::class, 'destroy'])->middleware('permission:users.manage')->name('users.destroy');

    Route::get('/administration/roles-permissions', [RoleReferenceController::class, 'index'])
        ->middleware('permission:users.manage')
        ->name('roles.index');
    Route::patch('/administration/users/{user}/role', [UserRoleController::class, 'update'])
        ->middleware('permission:users.manage')
        ->name('users.role.update');

    Route::get('/administration/system', [SystemSettingsController::class, 'index'])->middleware('permission:system-settings.manage')->name('system.index');
    Route::patch('/administration/system/settings', [SystemSettingsController::class, 'updateSettings'])->middleware('permission:system-settings.manage')->name('system.settings.update');
    Route::post('/administration/system/file-types', [SystemSettingsController::class, 'storeFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.store');
    Route::patch('/administration/system/file-types/bulk-toggle', [SystemSettingsController::class, 'bulkToggleFileTypes'])->middleware('permission:system-settings.manage')->name('system.file-types.bulk-toggle');
    Route::delete('/administration/system/file-types/bulk-delete', [SystemSettingsController::class, 'bulkDestroyFileTypes'])->middleware('permission:system-settings.manage')->name('system.file-types.bulk-delete');
    Route::patch('/administration/system/file-types/{fileType}', [SystemSettingsController::class, 'updateFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.update');
    Route::patch('/administration/system/file-types/{fileType}/toggle', [SystemSettingsController::class, 'toggleFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.toggle');
    Route::delete('/administration/system/file-types/{fileType}', [SystemSettingsController::class, 'destroyFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.destroy');
    Route::delete('/administration/system/logs', [SystemSettingsController::class, 'clearLogs'])->middleware('permission:system-settings.manage')->name('system.logs.clear');
    Route::post('/administration/system/backup/system-database', SystemBackupController::class)->middleware('permission:backups.manage')->name('system.backup.system-database');
    Route::post('/administration/system/backup/database', DatabaseBackupController::class)->middleware('permission:backups.manage')->name('system.backup.database');
});

require __DIR__.'/auth.php';
