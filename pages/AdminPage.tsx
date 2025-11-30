import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, BarChart3, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { pollService } from '../services/pollService';
import { adminService } from '../services/adminService';
import { Poll } from '../types';

export const AdminPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            if (!user) {
                navigate('/');
                return;
            }

            try {
                const adminStatus = await adminService.isAdmin();
                setIsAdmin(adminStatus);

                if (!adminStatus) {
                    setAccessDenied(true);
                    setLoading(false);
                    return;
                }

                await fetchPolls();
            } catch (error) {
                console.error('Access check error:', error);
                setAccessDenied(true);
                setLoading(false);
            }
        };

        checkAccess();
    }, [user, navigate]);

    const fetchPolls = async () => {
        try {
            const allPolls = await pollService.getPolls();
            setPolls(allPolls);
        } catch (error) {
            console.error('Error fetching polls:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (pollId: string) => {
        if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
            return;
        }

        try {
            await pollService.deletePoll(pollId);
            setPolls(polls.filter(p => p.id !== pollId));
            alert('Poll deleted successfully!');
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete poll: ' + (error as Error).message);
        }
    };

    const totalVotes = polls.reduce((acc, poll) => acc + poll.totalVotes, 0);
    const totalPolls = polls.length;
    const avgVotesPerPoll = totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0;

    if (loading) {
        return <div className="text-center py-20">Loading admin panel...</div>;
    }

    if (accessDenied) {
        return (
            <div className="max-w-md mx-auto mt-20 text-center">
                <div className="glass-panel p-8 rounded-2xl">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        You don't have permission to access the admin panel.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="glass-button px-8 py-3 rounded-xl font-bold"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
                    <p className="text-gray-500 mt-1">Manage all polls and view statistics</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 uppercase tracking-wide">Total Polls</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalPolls}</p>
                        </div>
                        <BarChart3 className="text-gray-400" size={40} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 uppercase tracking-wide">Total Votes</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalVotes}</p>
                        </div>
                        <Users className="text-gray-400" size={40} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 uppercase tracking-wide">Avg Votes/Poll</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{avgVotesPerPoll}</p>
                        </div>
                        <TrendingUp className="text-gray-400" size={40} />
                    </div>
                </div>
            </div>

            {/* Polls Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Polls</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Question</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Creator</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Votes</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {polls.map(poll => (
                                <tr key={poll.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => navigate(`/poll/${poll.id}`)}
                                            className="text-sm font-medium text-gray-900 dark:text-white hover:underline text-left"
                                        >
                                            {poll.question}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{poll.createdBy}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{poll.totalVotes}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(poll.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleDelete(poll.id)}
                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                            title="Delete poll"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {polls.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No polls found
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
