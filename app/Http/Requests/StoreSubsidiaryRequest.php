<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesOrganizationName;
use App\Models\Subsidiary;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreSubsidiaryRequest extends FormRequest
{
    use ValidatesOrganizationName;

    public function authorize(): bool
    {
        return $this->user()?->can('create', Subsidiary::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $this->rejectInvalidStorageCharacters($validator);

        $validator->after(function (Validator $validator): void {
            if (Subsidiary::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($this->string('name')->toString())])
                ->exists()) {
                $validator->errors()->add('name', 'A subsidiary with this name already exists.');
            }
        });
    }
}
