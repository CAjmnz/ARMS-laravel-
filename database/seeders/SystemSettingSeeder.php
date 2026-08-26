<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['app.name', 'ARMS-Laravel', 'string', 'general', true],
            ['uploads.maximum_size_kb', '102400', 'integer', 'documents', false],
            ['uploads.duplicate_detection', 'sha256', 'string', 'documents', false],
            ['uploads.antivirus_required', 'false', 'boolean', 'security', false],
            ['documents.watermark_enabled', 'true', 'boolean', 'documents', false],
        ];

        foreach ($settings as [$key, $value, $type, $group, $isPublic]) {
            SystemSetting::query()->updateOrCreate(
                ['key' => $key],
                compact('value', 'type', 'group') + ['is_public' => $isPublic],
            );
        }
    }
}
