<?php

namespace Tests\Feature\Documents;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use App\Models\UserPin;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserPinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_folder_pin_is_persisted_per_user_and_is_visible_on_a_later_request(): void
    {
        [$folder] = $this->records();
        $user = $this->superUser();

        $this->actingAs($user)
            ->patch(route('documents.folders.pin', $folder))
            ->assertRedirect();

        $this->assertDatabaseHas('user_pins', [
            'user_id' => $user->id,
            'folder_id' => $folder->id,
            'document_id' => null,
        ]);

        $this->actingAs($user)
            ->get(route('documents.manage'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Manage')
                ->where('documentStats.pins', 1)
                ->where('folders.data.0.id', $folder->id)
                ->where('folders.data.0.is_pinned', true));
    }

    public function test_document_pin_is_persisted_and_isolated_to_the_same_account(): void
    {
        [$folder, $document] = $this->records();
        $first = $this->superUser();
        $second = $this->superUser();

        $this->actingAs($first)
            ->patch(route('documents.pin', $document))
            ->assertRedirect();

        $this->assertDatabaseHas('user_pins', [
            'user_id' => $first->id,
            'folder_id' => null,
            'document_id' => $document->id,
        ]);
        $this->assertDatabaseMissing('user_pins', [
            'user_id' => $second->id,
            'document_id' => $document->id,
        ]);

        $this->actingAs($first)
            ->get(route('documents.manage', $folder))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Manage')
                ->where('documents.data.0.id', $document->id)
                ->where('documents.data.0.is_pinned', true));

        $this->actingAs($second)
            ->get(route('documents.manage', $folder))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Manage')
                ->where('documentStats.pins', 0)
                ->where('documents.data.0.id', $document->id)
                ->where('documents.data.0.is_pinned', false));
    }

    public function test_dashboard_returns_only_the_authenticated_users_pins(): void
    {
        [$folder, $document] = $this->records();
        $user = $this->superUser();
        $other = $this->superUser();
        UserPin::query()->create(['user_id' => $user->id, 'folder_id' => $folder->id]);
        UserPin::query()->create(['user_id' => $other->id, 'document_id' => $document->id]);

        $this->actingAs($user)->get(route('dashboard'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('pinnedItems.0.name', $folder->name)
            ->has('pinnedItems', 1));
    }

    public function test_pin_search_finds_filename_deep_subfolder_and_document_from_root(): void
    {
        [$root, $document] = $this->records();
        $user = $this->superUser();
        $parent = $root;
        for ($depth = 1; $depth <= 12; $depth++) {
            $parent = Folder::query()->create([
                'parent_id' => $parent->id,
                'subsidiary_id' => $root->subsidiary_id,
                'department_id' => $root->department_id,
                'name' => 'Subfolder '.$depth,
                'slug' => 'subfolder-'.$depth,
                'depth' => $depth,
                'is_published' => true,
                'created_by' => $user->id,
            ]);
        }
        $deepDocument = Document::query()->create(['folder_id' => $parent->id, 'title' => 'Audit Summary.pdf', 'created_by' => $user->id]);
        $unpinned = Document::query()->create(['folder_id' => $parent->id, 'title' => 'Audit Unpinned.pdf', 'created_by' => $user->id]);
        UserPin::query()->create(['user_id' => $user->id, 'folder_id' => $root->id]);
        UserPin::query()->create(['user_id' => $user->id, 'folder_id' => $parent->id]);
        UserPin::query()->create(['user_id' => $user->id, 'document_id' => $deepDocument->id]);

        $this->actingAs($user)->get(route('documents.manage', ['search' => 'pin']))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('pinnedSearchMode', true)
            ->where('pinnedSearch.total', 3)
            ->where('pinnedSearch.data.0.is_pinned', true)
            ->where('pinnedSearch.data.1.is_pinned', true)
            ->where('pinnedSearch.data.2.is_pinned', true));

        $this->actingAs($user)->getJson(route('documents.pins.index', ['search' => 'Subfolder 12', 'type' => 'subfolders']))
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.type', 'Subfolder12')
            ->assertJsonPath('items.0.name', 'Subfolder 12');

        $this->actingAs($user)->get(route('documents.manage', ['search' => 'pin audit']))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('pinnedSearchMode', true)
            ->where('pinnedSearchKeyword', 'audit')
            ->where('pinnedSearch.total', 1)
            ->where('pinnedSearch.data.0.id', $deepDocument->id)
            ->where('pinnedSearch.data.0.name', 'Audit Summary.pdf'));

        $this->assertDatabaseMissing('user_pins', ['user_id' => $user->id, 'document_id' => $unpinned->id]);
    }

    public function test_stale_pin_does_not_bypass_level_two_access_rules(): void
    {
        [$folder, $document] = $this->records();
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', Role::LEVEL_2)->firstOrFail()->id);
        UserPin::query()->create(['user_id' => $user->id, 'document_id' => $document->id]);

        $this->actingAs($user)->get(route('documents.manage', ['search' => 'pin']))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('pinnedSearchMode', true)
            ->where('pinnedSearch.total', 0));
    }

    public function test_pinned_document_opens_its_folder_with_the_document_selected_for_the_view_modal(): void
    {
        [$folder, $document] = $this->records();
        $user = $this->superUser();
        UserPin::query()->create(['user_id' => $user->id, 'document_id' => $document->id]);

        $fallbackResponse = $this->actingAs($user)->getJson(route('documents.pins.index', ['type' => 'documents']))
            ->assertOk()
            ->assertJsonPath('items.0.opens_viewer', false);
        $fallbackHref = (string) $fallbackResponse->json('items.0.href');
        $this->assertStringContainsString('/documents/manage/', $fallbackHref);
        $this->assertStringContainsString('open_document=', $fallbackHref);

        DocumentVersion::query()->create([
            'document_id' => $document->id,
            'version_number' => 1,
            'original_filename' => 'Pinned Document.pdf',
            'storage_disk' => 'documents',
            'storage_path' => 'tests/pinned-document.pdf',
            'watermark_path' => 'tests/pinned-document-watermarked.pdf',
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => 128,
            'sha256' => str_repeat('a', 64),
            'scan_status' => 'ready',
            'uploaded_by' => $user->id,
        ]);

        $viewerResponse = $this->actingAs($user)->getJson(route('documents.pins.index', ['type' => 'documents']))
            ->assertOk()
            ->assertJsonPath('items.0.opens_viewer', false);
        $viewerHref = (string) $viewerResponse->json('items.0.href');
        $this->assertStringContainsString('/documents/manage/', $viewerHref);
        $this->assertStringContainsString('open_document=', $viewerHref);
        $this->assertFalse(str_ends_with($viewerHref, '/viewer'));
    }

    public function test_pinned_dropdown_endpoint_is_scoped_and_searchable(): void
    {
        [$folder, $document] = $this->records();
        $user = $this->superUser();
        $other = $this->superUser();
        UserPin::query()->create(['user_id' => $user->id, 'document_id' => $document->id]);
        UserPin::query()->create(['user_id' => $other->id, 'folder_id' => $folder->id]);

        $this->actingAs($user)->getJson(route('documents.pins.index', ['search' => 'Pinned Document', 'type' => 'documents']))
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.name', 'Pinned Document')
            ->assertJsonPath('items.0.kind', 'document');
    }

    public function test_pinned_folders_are_sorted_before_unpinned_folders(): void
    {
        [$folder] = $this->records();
        $user = $this->superUser();
        $other = Folder::query()->create([
            'subsidiary_id' => $folder->subsidiary_id,
            'department_id' => $folder->department_id,
            'name' => 'AAA First Alphabetically',
            'slug' => 'aaa-first-alphabetically',
            'depth' => 0,
            'is_published' => true,
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)->patch(route('documents.folders.pin', $folder));

        $this->actingAs($user)
            ->get(route('documents.manage'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('folders.data.0.id', $folder->id)
                ->where('folders.data.0.is_pinned', true)
                ->where('folders.data.1.id', $other->id));
    }

    private function superUser(): User
    {
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $user->roles()->attach($role->id);

        return $user;
    }

    /** @return array{Folder, Document} */
    private function records(): array
    {
        $subsidiary = Subsidiary::query()->create(['code' => 'HO', 'name' => 'Head Office', 'status' => 'active']);
        $department = Department::query()->create(['subsidiary_id' => $subsidiary->id, 'code' => 'RMS', 'name' => 'Records', 'status' => 'active']);
        $creator = $this->superUser();
        $folder = Folder::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'department_id' => $department->id,
            'name' => 'Pinned Records',
            'slug' => 'pinned-records',
            'depth' => 0,
            'is_published' => true,
            'created_by' => $creator->id,
        ]);
        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => 'Pinned Document',
            'created_by' => $creator->id,
        ]);

        return [$folder, $document];
    }
}
