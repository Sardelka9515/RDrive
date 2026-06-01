import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';
import { Navigate, useNavigate } from 'react-router-dom';
import { setTokenGetter, setAccessDeniedHandler } from './api';

type AuthMode = 'none' | 'oidc' | 'password';

interface AuthConfig {
    enabled: boolean;
    mode?: AuthMode;
    authority: string | null;
    clientId: string | null;
}

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    accessDenied: boolean;
    mode: AuthMode | null;
    user: User | null;
    userName: string | null;
    login: () => void;
    loginWithPassword: (password: string) => Promise<void>;
    logout: () => void;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    isLoading: true,
    accessDenied: false,
    mode: null,
    user: null,
    userName: null,
    login: () => {},
    loginWithPassword: async () => {},
    logout: () => {},
    getAccessToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const RETURN_URL_KEY = 'rdrive_return_url';
const TOKEN_KEY = 'rdrive_token';

async function fetchAuthConfig(): Promise<AuthConfig> {
    const res = await fetch(`${API_BASE}/auth/config`);
    if (!res.ok) throw new Error('Failed to fetch auth config');
    return res.json();
}

/* ── Password-mode token helpers ──────────────────────── */

function loadToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}
function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/** Returns the token's expiry in epoch milliseconds, or null if it has no/unparsable exp. */
function tokenExpiry(token: string): number | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}
function isTokenValid(token: string | null): token is string {
    if (!token) return false;
    const exp = tokenExpiry(token);
    return exp == null ? true : Date.now() < exp;
}

/* ── OIDC singletons (survive StrictMode double-mount) ── */

let _userManager: UserManager | null = null;
let _callbackPromise: Promise<User | null> | null = null;
let _redirecting = false;

function getOrCreateUserManager(config: AuthConfig): UserManager {
    if (!_userManager) {
        _userManager = new UserManager({
            authority: config.authority!,
            client_id: config.clientId!,
            redirect_uri: `${window.location.origin}/callback`,
            post_logout_redirect_uri: window.location.origin,
            response_type: 'code',
            scope: 'openid profile email',
            automaticSilentRenew: true,
            userStore: new WebStorageStateStore({ store: window.localStorage }),
        });
    }
    return _userManager;
}

function processCallback(mgr: UserManager): Promise<User | null> {
    if (!_callbackPromise) {
        _callbackPromise = mgr.signinRedirectCallback().catch(() => mgr.getUser());
    }
    return _callbackPromise;
}

/** Wire the API module's auth token getter and 403 handler to this OIDC manager. */
function wireOidcApiBridge(mgr: UserManager, onAccessDenied: (denied: boolean) => void) {
    setTokenGetter(async () => {
        const u = await mgr.getUser();
        return (u && !u.expired) ? u.access_token : null;
    });
    setAccessDeniedHandler(onAccessDenied);
}

/** Subscribe to OIDC user lifecycle events. Returns an unsubscribe function. */
function subscribeToUserEvents(
    mgr: UserManager,
    onLoaded: (u: User) => void,
    onRemoved: () => void,
): () => void {
    mgr.events.addUserLoaded(onLoaded);
    mgr.events.addUserUnloaded(onRemoved);
    mgr.events.addAccessTokenExpired(onRemoved);

    return () => {
        mgr.events.removeUserLoaded(onLoaded);
        mgr.events.removeUserUnloaded(onRemoved);
        mgr.events.removeAccessTokenExpired(onRemoved);
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<AuthMode | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const userManagerRef = useRef<UserManager | null>(null);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        async function init() {
            try {
                const config = await fetchAuthConfig();
                const m: AuthMode = config.mode ?? (config.enabled ? 'oidc' : 'none');
                if (!cancelled) setMode(m);

                if (m === 'none') {
                    if (!cancelled) setIsLoading(false);
                    return;
                }

                if (m === 'password') {
                    // Read the stored token freshly on every request so it stays in sync.
                    setTokenGetter(async () => {
                        const t = loadToken();
                        return isTokenValid(t) ? t : null;
                    });
                    // A 401/403 means the token is gone/expired — drop it and force re-login.
                    setAccessDeniedHandler((denied) => {
                        if (denied) {
                            clearToken();
                            if (!cancelled) setToken(null);
                        }
                    });
                    const existing = loadToken();
                    if (!cancelled && isTokenValid(existing)) setToken(existing);
                    if (!cancelled) setIsLoading(false);
                    return;
                }

                // m === 'oidc'
                const mgr = getOrCreateUserManager(config);
                userManagerRef.current = mgr;

                wireOidcApiBridge(mgr, (denied) => {
                    if (!cancelled) setAccessDenied(denied);
                });

                // Handle OIDC redirect callback
                if (window.location.pathname === '/callback') {
                    const cbUser = await processCallback(mgr);
                    if (!cancelled && cbUser && !cbUser.expired) setUser(cbUser);
                    if (!cancelled) setIsLoading(false);
                    return;
                }

                // Restore existing session
                const existing = await mgr.getUser();
                if (!cancelled && existing && !existing.expired) setUser(existing);

                // Listen for token refresh / logout
                unsubscribe = subscribeToUserEvents(
                    mgr,
                    (u) => { if (!cancelled) setUser(u); },
                    () => { if (!cancelled) setUser(null); },
                );

                if (!cancelled) setIsLoading(false);
            } catch {
                if (!cancelled) {
                    setMode('none');
                    setIsLoading(false);
                }
            }
        }

        init();
        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, []);

    const login = useCallback(() => {
        const mgr = userManagerRef.current;
        if (!mgr || _redirecting) return;
        _redirecting = true;
        sessionStorage.setItem(RETURN_URL_KEY, window.location.pathname + window.location.search);
        mgr.signinRedirect().catch(() => { _redirecting = false; });
    }, []);

    const loginWithPassword = useCallback(async (password: string) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (!res.ok) {
            throw new Error(res.status === 401 ? 'Incorrect password' : 'Login failed. Please try again.');
        }
        const data = await res.json();
        saveToken(data.token);
        setToken(data.token);
        setAccessDenied(false);
    }, []);

    const logout = useCallback(() => {
        if (mode === 'oidc') {
            const mgr = userManagerRef.current;
            if (!mgr || _redirecting) return;
            _redirecting = true;
            mgr.signoutRedirect().catch(() => { _redirecting = false; });
            return;
        }
        // Password mode: clearing the token flips isAuthenticated and the route guard
        // redirects to /login.
        clearToken();
        setToken(null);
    }, [mode]);

    const getAccessToken = useCallback(async (): Promise<string | null> => {
        if (mode === 'password') {
            const t = loadToken();
            return isTokenValid(t) ? t : null;
        }
        const mgr = userManagerRef.current;
        if (!mgr) return null;
        const u = await mgr.getUser();
        if (!u || u.expired) return null;
        return u.access_token;
    }, [mode]);

    // Reset access denied when the OIDC user changes
    useEffect(() => {
        setAccessDenied(false);
    }, [user]);

    const isAuthenticated =
        mode === 'none' ? true :
        mode === 'password' ? isTokenValid(token) :
        mode === 'oidc' ? (user != null && !user.expired && !accessDenied) :
        false;

    const userName = mode === 'password'
        ? 'admin'
        : (user?.profile?.preferred_username
            || user?.profile?.name
            || user?.profile?.email
            || null);

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isLoading,
            accessDenied,
            mode,
            user,
            userName,
            login,
            loginWithPassword,
            logout,
            getAccessToken,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// --- Auth route components ---

export function CallbackPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoading) return;

        if (isAuthenticated) {
            const returnUrl = sessionStorage.getItem(RETURN_URL_KEY) || '/';
            sessionStorage.removeItem(RETURN_URL_KEY);
            navigate(returnUrl, { replace: true });
        } else {
            navigate('/login', { replace: true });
        }
    }, [isLoading, isAuthenticated, navigate]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Signing in...</div>
        </div>
    );
}

export function LoginPage() {
    const { mode, login, loginWithPassword, isLoading, isAuthenticated } = useAuth();
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // OIDC: redirect straight to the identity provider.
    useEffect(() => {
        if (mode === 'oidc' && !isLoading && !isAuthenticated) {
            login();
        }
    }, [mode, isLoading, isAuthenticated, login]);

    if (!isLoading && isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    if (mode === 'password') {
        const onSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            setError(null);
            try {
                await loginWithPassword(password);
            } catch (err: any) {
                setError(err.message || 'Login failed');
                setPassword('');
            } finally {
                setSubmitting(false);
            }
        };

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
                    <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">RDrive</h1>
                    <h2 className="text-lg text-gray-600 dark:text-gray-400">Sign in to continue</h2>
                </div>
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <form
                        onSubmit={onSubmit}
                        className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 border border-gray-200 dark:border-gray-700 space-y-5"
                    >
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoFocus
                                autoComplete="current-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Enter your password"
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={submitting || !password}
                            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // OIDC / loading: show a redirecting message.
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">RDrive</h1>
                <h2 className="text-xl text-gray-600 dark:text-gray-400 mb-8">Redirecting to sign in...</h2>
                <div className="text-gray-500 dark:text-gray-400">Please wait...</div>
            </div>
        </div>
    );
}
