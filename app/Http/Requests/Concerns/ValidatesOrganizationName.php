<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Validator;

trait ValidatesOrganizationName
{
    protected function prepareForValidation(): void
    {
        if ($this->has('name') && is_string($this->input('name'))) {
            $this->merge([
                'name' => trim($this->input('name')),
            ]);
        }
    }

    protected function rejectInvalidStorageCharacters(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $name = $this->string('name')->toString();

            if (preg_match('/[\\x00-\\x1F\\x7F\\\\\/]/u', $name) === 1) {
                $validator->errors()->add(
                    'name',
                    'The name may not contain control characters, slashes, or backslashes.',
                );
            }
        });
    }
}
