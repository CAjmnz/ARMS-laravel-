<?php

namespace Database\Seeders;

use App\Models\FileType;
use Illuminate\Database\Seeder;

class FileTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['pdf', ['application/pdf'], true],
            ['doc', ['application/msword'], false],
            ['docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], false],
            ['xls', ['application/vnd.ms-excel'], false],
            ['xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], false],
            ['ppt', ['application/vnd.ms-powerpoint'], false],
            ['pptx', ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], false],
            ['csv', ['text/csv', 'text/plain'], false],
            ['txt', ['text/plain'], true],
            ['png', ['image/png'], true],
            ['jpg', ['image/jpeg'], true],
            ['jpeg', ['image/jpeg'], true],
            ['tif', ['image/tiff'], true],
            ['tiff', ['image/tiff'], true],
        ];

        foreach ($types as [$extension, $mimeTypes, $previewable]) {
            FileType::query()->updateOrCreate(
                ['extension' => $extension],
                [
                    'mime_types' => $mimeTypes,
                    'maximum_size_kb' => 102400,
                    'is_previewable' => $previewable,
                    'is_active' => true,
                ],
            );
        }
    }
}
