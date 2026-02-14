import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import FileBrowser from './FileBrowser';
import Jobs from './Jobs';
import RemoteConfig from './RemoteConfig';
import { api } from './api';
import { ToastProvider, useToast } from './Toast';
import { AuthProvider, useAuth } from './Auth';
import './index.css';

function CallbackHandler() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const returnUrl = sessionStorage.getItem('rdrive_return_url') || '/';
      sessionStorage.removeItem('rdrive_return_url');
      navigate(returnUrl, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Already authenticated (e.g. page refresh) — redirect immediately
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Not authenticated after loading — go to login
  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Signing in...</div>
    </div>
  );
}

function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">RDrive</h1>
        <h2 className="text-xl text-gray-600 dark:text-gray-400 mb-8">Sign in to continue</h2>
        <button
          onClick={login}
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
        >
          Sign in with SSO
        </button>
      </div>
    </div>
  );
}

function PrivateLayout() {
  const { isAuthenticated, isLoading, accessDenied, userName, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">&#x26D4;</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your account does not have the required <strong>rdrive-user</strong> role.
            Contact your administrator to request access.
          </p>
          <button
            onClick={logout}
            className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} />;

  const displayName = userName || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const linkClass = (path: string) =>
    `block px-4 py-2 rounded-lg transition ${
      isActive(path)
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow p-4 flex justify-between items-center z-10 relative">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">RDrive</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-300">{displayName}</span>
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">{initial}</div>
          {userName && (
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
              title="Sign out"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Fixed width */}
        <div className="w-64 bg-white dark:bg-gray-800 shadow-sm h-[calc(100vh-64px)] hidden md:block border-r border-gray-200 dark:border-gray-700">
          <nav className="p-4 space-y-2">
            <Link to="/" className={linkClass('/')}>My Remotes</Link>
            <Link to="/jobs" className={linkClass('/jobs')}>Jobs</Link>
            <Link to="/config" className={linkClass('/config')}>Configure</Link>
            <a href="#" className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">Shared with me</a>
            <a href="#" className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">Recent</a>
            <a href="#" className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">Trash</a>
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto h-[calc(100vh-64px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Dashboard() {
  const [remotes, setRemotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    api.getRemotes()
      .then(setRemotes)
      .catch(err => showError(`Failed to load remotes: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading remotes...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Remotes</h2>
        <Link to="/config" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
          <span>Configure Remote</span>
        </Link>
      </div>

      {remotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow min-h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xl text-gray-400">No remotes found.</p>
            <p className="text-sm text-gray-500 mt-2">Use Rclone config to add remotes.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {remotes.map(remote => (
            <Link key={remote} to={`/remotes/${remote}`} className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-100 dark:border-gray-700 transition hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{remote}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Rclone Remote</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <span>Browse Files</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/callback" element={<CallbackHandler />} />

            <Route element={<PrivateLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/config" element={<RemoteConfig />} />
              <Route path="/remotes/:remoteName/*" element={<FileBrowser />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
