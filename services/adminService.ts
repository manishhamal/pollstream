import { supabase } from './supabase';

/**
 * Admin status comes from app_metadata.is_admin, which only the service role
 * (dashboard / SQL) can set. The database enforces it via public.is_admin();
 * this check only decides what the UI shows.
 */
export const adminService = {
    async isAdmin(): Promise<boolean> {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.app_metadata?.is_admin === true;
    },

    async checkAdminAccess(): Promise<void> {
        const isAdmin = await this.isAdmin();
        if (!isAdmin) {
            throw new Error('Access denied. Admin privileges required.');
        }
    }
};
