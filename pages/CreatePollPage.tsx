import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ArrowLeft, Settings } from 'lucide-react';
import { pollService } from '../services/pollService';

export const CreatePollPage: React.FC = () => {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [category, setCategory] = useState('General');
  const [duration, setDuration] = useState(24);
  const [error, setError] = useState('');
  
  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least 2 valid options');
      return;
    }

    const pollId = pollService.createPoll({
      question,
      options: validOptions,
      category,
      durationHours: duration
    });

    navigate(`/poll/${pollId}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center text-gray-500 hover:text-black dark:hover:text-white transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Back
      </button>

      <div className="glass-panel rounded-2xl p-8 animate-slide-up">
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Create a Poll</h1>
            <p className="text-gray-500 mt-2">Ask the community and get real-time feedback.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to ask?"
              className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all resize-none h-32 text-lg"
              maxLength={200}
            />
          </div>

          {/* Options */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Options
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-3 items-center animate-fade-in">
                 <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-sm shrink-0">
                    {index + 1}
                 </div>
                <div className="relative flex-grow">
                    <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className="w-full p-3 pl-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all"
                        placeholder={`Option ${index + 1}`}
                    />
                </div>
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            ))}
            
            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors ml-11 mt-2"
              >
                <Plus size={16} className="mr-1" /> Add Option
              </button>
            )}
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
             <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                    <Settings size={14} className="mr-2" /> Category
                </label>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-black dark:focus:border-white"
                >
                    <option value="General">General</option>
                    <option value="Tech">Tech</option>
                    <option value="Sports">Sports</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Politics">Politics</option>
                </select>
             </div>
             <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                    Duration
                </label>
                <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-black dark:focus:border-white"
                >
                    <option value={1}>1 Hour</option>
                    <option value={6}>6 Hours</option>
                    <option value={24}>24 Hours</option>
                    <option value={72}>3 Days</option>
                    <option value={168}>7 Days</option>
                </select>
             </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="glass-button w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
            >
              Launch Poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};