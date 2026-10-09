<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

class OrganizationCodeGenerator
{
    public function next(Builder $query, string $name): string
    {
        $base = Str::upper(Str::of($name)->ascii()->replaceMatches('/[^A-Za-z0-9]+/', '')->substr(0, 45)->value());

        if ($base === '') {
            $base = 'ORG';
        }

        $code = $base;
        $suffix = 2;

        while ((clone $query)->withoutGlobalScopes()->where('code', $code)->exists()) {
            $code = $base.'-'.$suffix;
            $suffix++;
        }

        return $code;
    }
}
