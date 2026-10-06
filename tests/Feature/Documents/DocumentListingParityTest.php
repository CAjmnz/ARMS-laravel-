<?php

namespace Tests\Feature\Documents;

use App\Models\Department;
use App\Models\Document;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentListingParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_document_listing_accepts_200_entries_and_preserves_search_and_order_filters(): void
    {
        [$admin, $root] = $this->root();

        foreach (range(1, 405) as $index) {
            Folder::query()->create([
                'parent_id' => $root->id,
                'subsidiary_id' => $root->subsidiary_id,
                'department_id' => $root->department_id,
                'name' => sprintf('Folder %03d', $index),
                'slug' => 'folder-'.$index,
                'depth' => 1,
                'is_published' => false,
                'created_by' => $admin->id,
            ]);
        }

        $response = $this->actingAs($admin)->get(route('documents.manage', array_merge([
            'per_page' => 200,
            'sort' => 'name',
            'order' => 'asc',
            'search' => 'Folder',
        ], ['folder' => $root])));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('filters.per_page', 200)
            ->where('filters.sort', 'name')
            ->where('filters.order', 'asc')
            ->where('filters.search', 'Folder')
            ->where('folders.per_page', 200)
            ->where('folders.current_page', 1)
            ->where('folders.data.0.name', 'Folder 001')
            ->where('folders.data.199.name', 'Folder 200')
            ->has('folders.data', 200)
        );
    }

    public function test_document_listing_paginates_to_the_requested_page(): void
    {
        [$admin, $root] = $this->root();

        foreach (range(1, 25) as $index) {
            Folder::query()->create([
                'parent_id' => $root->id,
                'subsidiary_id' => $root->subsidiary_id,
                'department_id' => $root->department_id,
                'name' => sprintf('Page Folder %03d', $index),
                'slug' => 'page-folder-'.$index,
                'depth' => 1,
                'is_published' => false,
                'created_by' => $admin->id,
            ]);
        }

        $this->actingAs($admin)->get(route('documents.manage', array_merge([
            'per_page' => 10,
            'page' => 2,
            'sort' => 'name',
            'order' => 'asc',
            'search' => 'Page Folder',
        ], ['folder' => $root])))->assertOk()->assertInertia(fn ($page) => $page
            ->where('folders.current_page', 2)
            ->where('folders.per_page', 10)
            ->has('folders.data', 10)
        );
    }

    public function test_documents_are_server_paginated_to_200_and_follow_header_sorting(): void
    {
        [$admin, $root] = $this->root();

        foreach (range(1, 205) as $index) {
            Document::query()->create([
                'folder_id' => $root->id,
                'title' => sprintf('Document %03d', $index),
                'status' => 'ready',
                'created_by' => $admin->id,
            ]);
        }

        $this->actingAs($admin)->get(route('documents.manage', [
            'folder' => $root,
            'per_page' => 200,
            'sort' => 'name',
            'order' => 'asc',
        ]))->assertOk()->assertInertia(fn ($page) => $page
            ->where('filters.per_page', 200)
            ->where('documents.current_page', 1)
            ->where('documents.last_page', 2)
            ->where('documents.total', 205)
            ->where('documents.data.0.name', 'Document 001')
            ->where('documents.data.199.name', 'Document 200')
            ->has('documents.data', 200)
        );

        $this->actingAs($admin)->get(route('documents.manage', [
            'folder' => $root,
            'per_page' => 200,
            'document_page' => 2,
            'sort' => 'name',
            'order' => 'desc',
        ]))->assertOk()->assertInertia(fn ($page) => $page
            ->where('documents.current_page', 2)
            ->where('documents.data.0.name', 'Document 005')
            ->where('documents.data.4.name', 'Document 001')
            ->has('documents.data', 5)
        );
    }

    public function test_document_listing_rejects_unsupported_page_lengths(): void
    {
        [$admin, $root] = $this->root();

        Folder::query()->create([
            'parent_id' => $root->id,
            'subsidiary_id' => $root->subsidiary_id,
            'department_id' => $root->department_id,
            'name' => 'Only Child',
            'slug' => 'only-child',
            'depth' => 1,
            'is_published' => false,
            'created_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin)->get(route('documents.manage', ['folder' => $root, 'per_page' => 201]));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('filters.per_page', 10)
            ->where('folders.per_page', 10)
        );
    }

    /** @return array{User,Folder} */
    private function root(): array
    {
        $subsidiary = Subsidiary::query()->create([
            'code' => 'HO',
            'name' => 'Head Office',
            'status' => 'active',
        ]);
        $department = Department::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'code' => 'RMS',
            'name' => 'Records',
            'status' => 'active',
        ]);
        $admin = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $admin->roles()->attach($role->id);
        $admin->load('roles');

        $root = Folder::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'department_id' => $department->id,
            'name' => 'Reports',
            'slug' => 'reports',
            'depth' => 0,
            'is_published' => false,
            'created_by' => $admin->id,
        ]);

        return [$admin, $root];
    }
}
