<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\FolderManagementController;
use App\Http\Controllers\SubsidiaryController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoleReferenceController;
use App\Http\Controllers\UserRoleController;
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
    Route::post('/documents/manage/{folder}/folders', [FolderManagementController::class, 'store'])
        ->name('documents.folders.store');
    Route::patch('/documents/manage/{folder}/publish', [FolderManagementController::class, 'publish'])
        ->name('documents.folders.publish');
    Route::patch('/documents/manage/{folder}/unpublish', [FolderManagementController::class, 'unpublish'])
        ->name('documents.folders.unpublish');

    Route::resource('/administration/subsidiaries', SubsidiaryController::class)
        ->except(['create', 'edit', 'show'])
        ->names('administration.subsidiaries');
    Route::resource('/administration/departments', DepartmentController::class)
        ->except(['create', 'edit', 'show'])
        ->names('administration.departments');

    Route::get('/administration/roles-permissions', [RoleReferenceController::class, 'index'])
        ->middleware('permission:users.manage')
        ->name('roles.index');
    Route::patch('/administration/users/{user}/role', [UserRoleController::class, 'update'])
        ->middleware('permission:users.manage')
        ->name('users.role.update');
});

require __DIR__.'/auth.php';
