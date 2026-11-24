import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart2, Menu, X, Moon, Sun, LayoutGrid, PlusCircle, Compass, Shield, LogIn, LogOut, ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UserAvatar: React.FC<{ url?: string; name: string }> = ({ url, name }) => {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center">
      <UserIcon size={16} />
    </div>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Close the account menu on outside click, Escape, or navigation
  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [location.pathname]);
  const navigate = useNavigate();
  const { user, isSignedIn, isAdmin, signInWithGoogle, signOut } = useAuth();

  const displayName: string =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account';
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      await signInWithGoogle(); // redirects to Google
    } catch (e) {
      console.error('Sign-in failed:', e);
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut();
      setIsMobileMenuOpen(false);
      if (location.pathname === '/admin' || location.pathname === '/create') navigate('/');
    } catch (e) {
      console.error('Sign-out failed:', e);
    } finally {
      setAuthBusy(false);
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: <LayoutGrid size={20} /> },
    { label: 'Explore', path: '/explore', icon: <Compass size={20} /> },
    { label: 'Create Poll', path: '/create', icon: <PlusCircle size={20} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Modern Glass Navbar */}
      <nav className="sticky top-0 z-50 glass-panel border-b-0 rounded-none border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg">
                  <BarChart2 size={24} strokeWidth={2.5} />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-gray-900 dark:text-white">
                  PollStream
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${isActive(item.path)
                    ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div className="pl-4 border-l border-gray-200 dark:border-gray-700 ml-4 flex items-center space-x-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {isSignedIn ? (
                  <div className="relative" ref={accountMenuRef}>
                    <button
                      onClick={() => setIsAccountMenuOpen(o => !o)}
                      aria-haspopup="menu"
                      aria-expanded={isAccountMenuOpen}
                      aria-label="Account menu"
                      className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <UserAvatar url={avatarUrl} name={displayName} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[8rem] truncate">
                        {displayName}
                      </span>
                      <ChevronDown size={16} className={`text-gray-500 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isAccountMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-2 animate-fade-in"
                      >
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                          {user?.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                        </div>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            role="menuitem"
                            onClick={() => setIsAccountMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <Shield size={16} /> Admin dashboard
                          </Link>
                        )}
                        <button
                          role="menuitem"
                          onClick={handleSignOut}
                          disabled={authBusy}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                        >
                          <LogOut size={16} /> Sign out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleSignIn}
                    disabled={authBusy}
                    className="glass-button inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    <LogIn size={16} />
                    Sign in
                  </button>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden glass-panel border-t border-gray-200 dark:border-gray-800 animate-fade-in">
            <div className="pt-2 pb-3 space-y-1 px-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-3 rounded-md text-base font-medium ${isActive(item.path)
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-3">
                {isSignedIn ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 px-3 py-2 min-w-0">
                      <UserAvatar url={avatarUrl} name={displayName} />
                      <div className="min-w-0">
                        <p className="text-base font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                        {user?.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center px-3 py-3 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Shield size={20} className="mr-3" /> Admin dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      disabled={authBusy}
                      className="w-full flex items-center px-3 py-3 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      <LogOut size={20} className="mr-3" /> Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSignIn}
                    disabled={authBusy}
                    className="glass-button w-full flex items-center justify-center gap-2 px-3 py-3 rounded-md text-base font-bold disabled:opacity-50"
                  >
                    <LogIn size={18} /> Sign in with Google
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>

      <footer className="glass-panel mt-auto py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <BarChart2 size={20} className="text-gray-900 dark:text-white mr-2" />
            <span className="font-bold text-gray-900 dark:text-white">PollStream</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; 2025 PollStream
          </p>
        </div>
      </footer>
    </div>
  );
};