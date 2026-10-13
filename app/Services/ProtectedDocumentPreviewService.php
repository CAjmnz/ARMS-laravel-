<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use ZipArchive;

class ProtectedDocumentPreviewService
{
    private const MAX_TEXT_BYTES = 2_000_000;
    private const MAX_OUTPUT_CHARS = 250_000;
    private const MAX_XML_ENTRY_BYTES = 5_000_000;

    /**
     * Build a safe, read-only preview from the protected viewer copy.
     * No original-file path is accepted by this service.
     *
     * @return array<string, mixed>
     */
    public function make(string $diskName, string $path, string $extension): array
    {
        $extension = strtolower($extension);

        if (in_array($extension, ['txt', 'md', 'log', 'rtf', 'xml', 'json', 'html', 'htm', 'yaml', 'yml'], true)) {
            $text = $this->readText($diskName, $path);
            if ($extension === 'rtf') {
                $text = preg_replace('/\\\\[a-z]+-?\\d* ?|[{}]/i', '', $text) ?? $text;
            }
            return ['kind' => 'text', 'text' => mb_substr($text, 0, self::MAX_OUTPUT_CHARS), 'truncated' => mb_strlen($text) > self::MAX_OUTPUT_CHARS];
        }

        if (in_array($extension, ['csv', 'tsv'], true)) {
            $text = $this->readText($diskName, $path);
            $delimiter = $extension === 'tsv' ? "\t" : $this->detectCsvDelimiter($text);
            $rows = [];
            foreach (preg_split('/\\r\\n|\\n|\\r/', $text) ?: [] as $line) {
                if ($line === '' && $rows === []) continue;
                $rows[] = str_getcsv($line, $delimiter);
                if (count($rows) >= 500) break;
            }
            $maxColumns = 30;
            $rows = array_map(static fn (array $row) => array_slice(array_map(static fn ($cell) => mb_substr((string) $cell, 0, 4000), $row), 0, $maxColumns), $rows);
            return ['kind' => 'table', 'rows' => $rows, 'truncated' => count($rows) >= 500];
        }

        if (in_array($extension, ['docx', 'xlsx', 'pptx'], true)) {
            $absolutePath = Storage::disk($diskName)->path($path);
            $zip = new ZipArchive();
            if ($zip->open($absolutePath) !== true) {
                return $this->unsupported($extension, 'The protected file could not be opened as a valid Office document.');
            }

            try {
                return match ($extension) {
                    'docx' => $this->previewDocx($zip),
                    'xlsx' => $this->previewXlsx($zip),
                    'pptx' => $this->previewPptx($zip),
                    default => $this->unsupported($extension),
                };
            } finally {
                $zip->close();
            }
        }

        return $this->unsupported($extension);
    }

    private function readText(string $diskName, string $path): string
    {
        $disk = Storage::disk($diskName);
        $stream = $disk->readStream($path);
        if (! is_resource($stream)) return '';

        try {
            $contents = stream_get_contents($stream, self::MAX_TEXT_BYTES + 1);
        } finally {
            fclose($stream);
        }

        $contents = is_string($contents) ? $contents : '';
        $contents = mb_convert_encoding($contents, 'UTF-8', 'UTF-8');
        return str_replace("\0", '', $contents);
    }

    private function detectCsvDelimiter(string $text): string
    {
        $line = strtok($text, "\r\n") ?: '';
        $counts = [',' => substr_count($line, ','), ';' => substr_count($line, ';'), "\t" => substr_count($line, "\t")];
        arsort($counts);
        return (string) array_key_first($counts);
    }

    private function previewDocx(ZipArchive $zip): array
    {
        $xml = $this->zipText($zip, 'word/document.xml');
        if ($xml === null) return $this->unsupported('docx', 'The document body is missing.');
        $document = $this->parseXml($xml);
        if (! $document) return $this->unsupported('docx', 'The document content could not be read.');

        $texts = [];
        foreach ($document->getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't') as $node) {
            $texts[] = $node->textContent;
        }
        return ['kind' => 'text', 'text' => mb_substr(implode('', $texts), 0, self::MAX_OUTPUT_CHARS), 'truncated' => mb_strlen(implode('', $texts)) > self::MAX_OUTPUT_CHARS, 'format' => 'Word document'];
    }

    private function previewXlsx(ZipArchive $zip): array
    {
        $shared = [];
        $sharedXml = $this->zipText($zip, 'xl/sharedStrings.xml');
        if ($sharedXml !== null && ($sharedDoc = $this->parseXml($sharedXml))) {
            foreach ($sharedDoc->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'si') as $item) {
                $value = '';
                foreach ($item->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 't') as $text) $value .= $text->textContent;
                $shared[] = $value;
            }
        }

        $sheetPath = 'xl/worksheets/sheet1.xml';
        $workbookXml = $this->zipText($zip, 'xl/workbook.xml');
        $relsXml = $this->zipText($zip, 'xl/_rels/workbook.xml.rels');
        if ($workbookXml !== null && $relsXml !== null) {
            $workbook = $this->parseXml($workbookXml);
            $rels = $this->parseXml($relsXml);
            $firstSheet = $workbook?->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'sheet')->item(0);
            $relationshipId = $firstSheet?->getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            if ($relationshipId && $rels) {
                foreach ($rels->getElementsByTagNameNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship') as $relation) {
                    if ($relation->getAttribute('Id') === $relationshipId) {
                        $target = ltrim($relation->getAttribute('Target'), '/');
                        $sheetPath = str_starts_with($target, 'xl/') ? $target : 'xl/'.$target;
                        break;
                    }
                }
            }
        }

        $sheetXml = $this->zipText($zip, $sheetPath);
        $sheet = $sheetXml ? $this->parseXml($sheetXml) : null;
        if (! $sheet) return $this->unsupported('xlsx', 'The first worksheet could not be read.');

        $rows = [];
        foreach ($sheet->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'row') as $rowNode) {
            $row = [];
            foreach ($rowNode->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'c') as $cell) {
                $column = $this->columnIndex((string) $cell->getAttribute('r'));
                if ($column >= 30) continue;
                $valueNode = $cell->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'v')->item(0);
                $value = $valueNode?->textContent ?? '';
                if ($cell->getAttribute('t') === 's') $value = $shared[(int) $value] ?? '';
                if ($cell->getAttribute('t') === 'inlineStr') {
                    $value = '';
                    foreach ($cell->getElementsByTagNameNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 't') as $text) $value .= $text->textContent;
                }
                $row[$column] = mb_substr((string) $value, 0, 4000);
            }
            if ($row !== []) {
                $lastColumn = max(array_keys($row));
                $rows[] = array_map(static fn ($index) => $row[$index] ?? '', range(0, min($lastColumn, 29)));
            }
            if (count($rows) >= 500) break;
        }

        return ['kind' => 'table', 'rows' => $rows, 'truncated' => count($rows) >= 500, 'format' => 'Excel worksheet (first sheet)'];
    }

    private function previewPptx(ZipArchive $zip): array
    {
        $slides = [];
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $name = $zip->getNameIndex($index);
            if (is_string($name) && preg_match('#^ppt/slides/slide\\d+\\.xml$#', $name)) $slides[] = $name;
        }
        natsort($slides);
        $texts = [];
        foreach ($slides as $slide) {
            $xml = $this->zipText($zip, $slide);
            $document = $xml ? $this->parseXml($xml) : null;
            if (! $document) continue;
            $line = [];
            foreach ($document->getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't') as $node) $line[] = $node->textContent;
            $texts[] = 'Slide '.(count($texts) + 1)."\n".implode(' ', $line);
            if (mb_strlen(implode("\n\n", $texts)) >= self::MAX_OUTPUT_CHARS) break;
        }
        if ($texts === []) return $this->unsupported('pptx', 'No readable slide text was found.');
        $text = implode("\n\n", $texts);
        return ['kind' => 'text', 'text' => mb_substr($text, 0, self::MAX_OUTPUT_CHARS), 'truncated' => mb_strlen($text) > self::MAX_OUTPUT_CHARS, 'format' => 'PowerPoint slide text'];
    }

    private function zipText(ZipArchive $zip, string $name): ?string
    {
        $index = $zip->locateName($name);
        if ($index === false) return null;
        $stats = $zip->statIndex($index);
        if (! is_array($stats) || ($stats['size'] ?? self::MAX_XML_ENTRY_BYTES + 1) > self::MAX_XML_ENTRY_BYTES) return null;
        $contents = $zip->getFromIndex($index);
        return is_string($contents) ? $contents : null;
    }

    private function parseXml(string $xml): ?\DOMDocument
    {
        $document = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS);
            return $loaded ? $document : null;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    private function columnIndex(string $cellReference): int
    {
        preg_match('/^[A-Z]+/', strtoupper($cellReference), $match);
        $index = 0;
        foreach (str_split($match[0] ?? '') as $character) $index = $index * 26 + ord($character) - 64;
        return max(0, $index - 1);
    }

    private function unsupported(string $extension, string $message = ''): array
    {
        $label = strtoupper($extension ?: 'FILE');
        return [
            'kind' => 'unsupported',
            'message' => $message ?: "An in-browser preview is not available for .{$extension} files in this installation. Ask the administrator to upload a PDF or a modern Office file (.docx, .xlsx, .pptx) for protected preview.",
            'format' => $label,
        ];
    }
}
