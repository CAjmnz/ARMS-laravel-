export interface User {
    id: number;
    name: string;
    email: string;
    employee_id: string;
    position?: string | null;
    account_status: string;
    allowed_upload: boolean;
    last_login_at?: string | null;
    email_verified_at?: string;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
        roles: string[];
        permissions: string[];
    };
    flash: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
    };
};
