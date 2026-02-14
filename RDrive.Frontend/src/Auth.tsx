import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';
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

async function fetchAuthConfig(): Promise<AuthConfig> {
    const res = await fetch(`${API_BASE}/auth/config`);
    if (!res.ok) throw new Error('Failed to fetch auth config');
    return res.json();
}

function createUserManager(config: AuthConfig): UserManager {
    const redirectUri = `${window.location.origin}/callback`;
    return new UserManager({
        authority: config.authority!,
        client_id: config.clientId!,
        redirect_uri: redirectUri,
        post_logout_redirect_uri: window.location.origin,
        response_type: 'code',
        scope: 'openid profile email',
        automaticSilentRenew: true,
        userStore: new WebStorageStateStore({ store: window.localStorage }),
    });
}

// Module-level singletons to survive StrictMode double-mount
let _userManager: UserManager | null = null;
let _callbackPromise: Promise<User | null> | null = null;

function getOrCreateUserManager(config: AuthConfig): UserManager {
    if (!_userManager) {
        _userManager = createUserManager(config);
    }
    return _userManager;
}

function processCallback(mgr: UserManager): Promise<User | null> {
    if (!_callbackPromise) {
        _callbackPromise = mgr.signinRedirectCallback()
            .catch(() => mgr.getUser());
    }
    return _callbackPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
    const userManagerRef = useRef<UserManager | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const config = await fetchAuthConfig();

                if (!config.enabled) {
                    if (!cancelled) {
                        setAuthEnabled(false);
                        setIsLoading(false);
                    }
                    return;
                }

                setAuthEnabled(true);
                const mgr = getOrCreateUserManager(config);
                userManagerRef.current = mgr;

                // Wire token getter for API calls
                setTokenGetter(async () => {
                    const u = await mgr.getUser();
                    if (!u || u.expired) return null;
                    return u.access_token;
                });

                // Wire access denied handler
                setAccessDeniedHandler((denied: boolean) => {
                    if (!cancelled) setAccessDenied(denied);
                });

                // Handle redirect callback
                if (window.location.pathname === '/callback') {
                    const cbUser = await processCallback(mgr);
                    if (!cancelled && cbUser && !cbUser.expired) {
                        setUser(cbUser);
                    }
                    if (!cancelled) setIsLoading(false);
                    return;
                }

                // Try to get existing user
                const existingUser = await mgr.getUser();
                if (existingUser && !existingUser.expired) {
                    if (!cancelled) setUser(existingUser);
                }

                // Listen for user changes
                mgr.events.addUserLoaded((u) => {
                    if (!cancelled) setUser(u);
                });
                mgr.events.addUserUnloaded(() => {
                    if (!cancelled) setUser(null);
                });
                mgr.events.addAccessTokenExpired(() => {
                    if (!cancelled) setUser(null);
                });

                if (!cancelled) setIsLoading(false);
            } catch {
                // If auth config fetch fails, assume auth is disabled
                if (!cancelled) {
                    setAuthEnabled(false);
                    setIsLoading(false);
                }
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const login = useCallback(() => {
        const mgr = userManagerRef.current;
        if (!mgr) return;
        sessionStorage.setItem('rdrive_return_url', window.location.pathname + window.location.search);
        mgr.signinRedirect();
    }, []);

    const logout = useCallback(() => {
        const mgr = userManagerRef.current;
        if (!mgr) return;
        mgr.signoutRedirect();
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
