import { supabase } from './supabase';

// List of admin emails - add your email here
const ADMIN_EMAILS = [
    'manishml.dev@gmail.com', // Replace with your actual email
];

export const adminService = {
    async isAdmin(): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return false;

        // Check if user email is in admin list
        return ADMIN_EMAILS.includes(user.email || '');
    },

    async checkAdminAccess(): Promise<void> {
        const isAdmin = await this.isAdmin();
        if (!isAdmin) {
            throw new Error('Access denied. Admin privileges required.');
        }
    }
};
