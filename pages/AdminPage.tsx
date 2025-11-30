import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, BarChart3, Users, TrendingUp, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { pollService } from '../services/pollService';
import { adminService } from '../services/adminService';
import { Poll } from '../types';

export const AdminPage: React.FC = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [selectedPollIds, setSelectedPollIds] = useState<Set<string>>(new Set());

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

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/');
        } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to log out');
        }
    };

    const handleDelete = async (pollId: string) => {
        if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
            return;
        }

        try {
            await pollService.deletePoll(pollId);
            setPolls(polls.filter(p => p.id !== pollId));
            setSelectedPollIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(pollId);
                return newSet;
            });
            alert('Poll deleted successfully!');
        } catch (error) {
            console.error('Delete error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert('Failed to delete poll: ' + errorMessage);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedPollIds.size === 0) {
            alert('Please select at least one poll to delete');
            return;
        }

        const count = selectedPollIds.size;
        if (!confirm(`Are you sure you want to delete ${count} poll(s)? This action cannot be undone.`)) {
            return;
        }

        try {
            await Promise.all(
                Array.from(selectedPollIds).map(pollId => pollService.deletePoll(pollId))
            );
            setPolls(polls.filter(p => !selectedPollIds.has(p.id)));
            setSelectedPollIds(new Set());
            alert(`Successfully deleted ${count} poll(s)!`);
        } catch (error) {
            console.error('Bulk delete error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert('Failed to delete some polls: ' + errorMessage);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedPollIds(new Set(polls.map(p => p.id)));
        } else {
            setSelectedPollIds(new Set());
        }
    };

    const handleSelectPoll = (pollId: string, checked: boolean) => {
        setSelectedPollIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(pollId);
            } else {
                newSet.delete(pollId);
            }
            return newSet;
        });
    };

    const totalVotes = polls.reduce((acc, poll) => acc + poll.totalVotes, 0);
    const totalPolls = polls.length;
    const avgVotesPerPoll = totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0;
    const allSelected = polls.length > 0 && selectedPollIds.size === polls.length;
    const someSelected = selectedPollIds.size > 0 && selectedPollIds.size < polls.length;

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
                <div className="flex items-center gap-3">
                    {selectedPollIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={18} />
                            Delete Selected ({selectedPollIds.size})
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="px-6 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                    >
                        <LogOut size={18} />
                        Log Out
                    </button>
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
                                <th className="px-6 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={input => {
                                            if (input) input.indeterminate = someSelected;
                                        }}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-black dark:text-white focus:ring-black dark:focus:ring-white cursor-pointer"
                                    />
                                </th>
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
                                        <input
                                            type="checkbox"
                                            checked={selectedPollIds.has(poll.id)}
                                            onChange={(e) => handleSelectPoll(poll.id, e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-black dark:text-white focus:ring-black dark:focus:ring-white cursor-pointer"
                                        />
                                    </td>
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
