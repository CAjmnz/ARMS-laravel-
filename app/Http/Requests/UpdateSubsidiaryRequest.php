<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesOrganizationName;
use App\Models\Subsidiary;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateSubsidiaryRequest extends FormRequest
{
    use ValidatesOrganizationName;

    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('subsidiary')) ?? false;
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
            $subsidiary = $this->route('subsidiary');

            if (Subsidiary::query()
                ->whereKeyNot($subsidiary)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($this->string('name')->toString())])
                ->exists()) {
                $validator->errors()->add('name', 'A subsidiary with this name already exists.');
            }
        });
    }
}
