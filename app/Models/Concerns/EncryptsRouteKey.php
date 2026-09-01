<?php

namespace App\Models\Concerns;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

trait EncryptsRouteKey
{
    public function getRouteKey(): mixed
    {
        return static::encryptRouteKey($this->getKey());
    }

    public static function encryptRouteKey(int|string $key): string
    {
        $encrypted = Crypt::encryptString((string) $key);

        return rtrim(strtr(base64_encode($encrypted), '+/', '-_'), '=');
    }

    public function resolveRouteBinding($value, $field = null)
    {
        if ($field !== null) {
            return parent::resolveRouteBinding($value, $field);
        }

        $decoded = strtr((string) $value, '-_', '+/');
        $padding = strlen($decoded) % 4;
        if ($padding !== 0) {
            $decoded .= str_repeat('=', 4 - $padding);
        }

        try {
            $encrypted = base64_decode($decoded, true);
            if ($encrypted === false) {
                return null;
            }

            $key = Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return null;
        }

        if (! ctype_digit((string) $key)) {
            return null;
        }

        return $this->newQuery()->where($this->getRouteKeyName(), (int) $key)->first();
    }
}
