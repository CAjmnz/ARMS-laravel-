<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\FolderManagementController;
use App\Http\Controllers\SubsidiaryController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoleReferenceController;
use App\Http\Controllers\UserRoleController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\SystemSettingsController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => false,
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', DashboardController::class)
    ->middleware(['auth', 'active', 'password.changed', 'session.timeout'])
    ->name('dashboard');

Route::middleware(['auth', 'active', 'password.changed', 'session.timeout'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/documents/manage/{folder?}', [FolderManagementController::class, 'index'])
        ->name('documents.manage');
    Route::post('/documents/manage/filenames', [FolderManagementController::class, 'storeRoot'])
        ->name('documents.filenames.store');
    Route::post('/documents/manage/{folder}/folders', [FolderManagementController::class, 'store'])
        ->name('documents.folders.store');
    Route::patch('/documents/manage/{folder}', [FolderManagementController::class, 'rename'])
        ->name('documents.folders.rename');
    Route::delete('/documents/manage/{folder}', [FolderManagementController::class, 'destroy'])
        ->name('documents.folders.destroy');
    Route::patch('/documents/bulk-transfer', [DocumentController::class, 'bulkMove'])->name('documents.bulk-move');
    Route::delete('/documents/bulk-delete', [FolderManagementController::class, 'bulkDelete'])->name('documents.bulk-delete');
    Route::post('/documents/folders/{folder}/upload', [DocumentController::class, 'upload'])->name('documents.upload');
    Route::get('/documents/manage/{folder}/files', [DocumentController::class, 'files'])->name('documents.files.index');
    Route::get('/documents/{document}', [DocumentController::class, 'show'])->name('documents.show');
    Route::get('/documents/{document}/edit', [DocumentController::class, 'edit'])->name('documents.edit');
    Route::patch('/documents/{document}', [DocumentController::class, 'update'])->name('documents.update');
    Route::patch('/documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
    Route::get('/documents/{document}/viewer', [DocumentController::class, 'viewer'])->name('documents.viewer');
    Route::get('/documents/{document}/download', [DocumentController::class, 'downloadViewer'])->name('documents.download');
    Route::get('/documents/{document}/original', [DocumentController::class, 'downloadOriginal'])->name('documents.original');

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
    Route::patch('/administration/system/file-types/{fileType}', [SystemSettingsController::class, 'updateFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.update');
    Route::patch('/administration/system/file-types/{fileType}/toggle', [SystemSettingsController::class, 'toggleFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.toggle');
    Route::delete('/administration/system/file-types/{fileType}', [SystemSettingsController::class, 'destroyFileType'])->middleware('permission:system-settings.manage')->name('system.file-types.destroy');
    Route::delete('/administration/system/logs', [SystemSettingsController::class, 'clearLogs'])->middleware('permission:system-settings.manage')->name('system.logs.clear');
});

require __DIR__.'/auth.php';
