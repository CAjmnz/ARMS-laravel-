<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesOrganizationName;
use App\Models\Department;
use App\Models\Subsidiary;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateDepartmentRequest extends FormRequest
{
    use ValidatesOrganizationName;

    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('department')) ?? false;
    }

    public function rules(): array
    {
        return [
            'subsidiary_id' => ['required', 'integer', 'exists:subsidiaries,id'],
            'name' => ['required', 'string', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $this->rejectInvalidStorageCharacters($validator);

        $validator->after(function (Validator $validator): void {
            $department = $this->route('department');
            $subsidiaryId = $this->integer('subsidiary_id');

            if ($subsidiaryId && ! Subsidiary::query()->whereKey($subsidiaryId)->exists()) {
                $validator->errors()->add('subsidiary_id', 'The selected subsidiary no longer exists.');
            }

            if ($subsidiaryId && Department::query()
                ->whereKeyNot($department)
                ->where('subsidiary_id', $subsidiaryId)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($this->string('name')->toString())])
                ->exists()) {
                $validator->errors()->add('name', 'A department with this name already exists in the selected subsidiary.');
            }
        });
    }
}
