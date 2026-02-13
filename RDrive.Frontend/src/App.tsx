import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Login from './Login';
import FileBrowser from './FileBrowser';
import Jobs from './Jobs';
import { api } from './api';
import './index.css';

function PrivateLayout() {
  // TODO: Check auth state
  const isAuthenticated = true; // Mock for now
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" />;

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
          <span className="text-sm text-gray-600 dark:text-gray-300">Admin</span>
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">A</div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Fixed width */}
        <div className="w-64 bg-white dark:bg-gray-800 shadow-sm h-[calc(100vh-64px)] hidden md:block border-r border-gray-200 dark:border-gray-700">
          <nav className="p-4 space-y-2">
            <Link to="/" className={linkClass('/')}>My Remotes</Link>
            <Link to="/jobs" className={linkClass('/jobs')}>Jobs</Link>
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

  useEffect(() => {
    api.getRemotes()
      .then(setRemotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading remotes...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Remotes</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
          {/* Remotes must be added via config for now */}
          <span>Configure Remote</span>
        </button>
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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<PrivateLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/remotes/:remoteName/*" element={<FileBrowser />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
