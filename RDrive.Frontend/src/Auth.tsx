import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';
import { Navigate, useNavigate } from 'react-router-dom';
import { setTokenGetter, setAccessDeniedHandler } from './api';

interface AuthConfig {
    enabled: boolean;
    authority: string | null;
    clientId: string | null;
}

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    accessDenied: boolean;
    user: User | null;
    userName: string | null;
    login: () => void;
    logout: () => void;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    isLoading: true,
    accessDenied: false,
    user: null,
    userName: null,
    login: () => {},
    logout: () => {},
    getAccessToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const RETURN_URL_KEY = 'rdrive_return_url';

async function fetchAuthConfig(): Promise<AuthConfig> {
    const res = await fetch(`${API_BASE}/auth/config`);
    if (!res.ok) throw new Error('Failed to fetch auth config');
    return res.json();
}

// Module-level singletons to survive StrictMode double-mount
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
function wireApiBridge(mgr: UserManager, onAccessDenied: (denied: boolean) => void) {
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
    const [user, setUser] = useState<User | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
    const userManagerRef = useRef<UserManager | null>(null);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        async function init() {
            try {
                const config = await fetchAuthConfig();

                if (!config.enabled) {
                    if (!cancelled) {
                        setAuthEnabled(false);
                        setIsLoading(false);
                    }
                    return;
                }

                if (!cancelled) setAuthEnabled(true);
                const mgr = getOrCreateUserManager(config);
                userManagerRef.current = mgr;

                wireApiBridge(mgr, (denied) => {
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
                    setAuthEnabled(false);
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

    const logout = useCallback(() => {
        const mgr = userManagerRef.current;
        if (!mgr || _redirecting) return;
        _redirecting = true;
        mgr.signoutRedirect().catch(() => { _redirecting = false; });
    }, []);

    const getAccessToken = useCallback(async (): Promise<string | null> => {
        const mgr = userManagerRef.current;
        if (!mgr) return null;
        const u = await mgr.getUser();
        if (!u || u.expired) return null;
        return u.access_token;
    }, []);

    // Reset access denied when user changes
    useEffect(() => {
        setAccessDenied(false);
    }, [user]);

    const isAuthenticated = authEnabled === false || (user != null && !user.expired && !accessDenied);

    const userName = user?.profile?.preferred_username
        || user?.profile?.name
        || user?.profile?.email
        || null;

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isLoading,
            accessDenied,
            user,
            userName,
            login,
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
    const { login, isLoading, isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            login();
        }
    }, [isLoading, isAuthenticated, login]);

    if (!isLoading && isAuthenticated) {
        return <Navigate to="/" replace />;
    }

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
