import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';
import { setTokenGetter } from './api';

interface AuthConfig {
    enabled: boolean;
    authority: string | null;
    clientId: string | null;
}

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    userName: string | null;
    login: () => void;
    logout: () => void;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    isLoading: true,
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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
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
                const mgr = createUserManager(config);
                userManagerRef.current = mgr;

                // Wire token getter for API calls
                setTokenGetter(async () => {
                    const u = await mgr.getUser();
                    if (!u || u.expired) return null;
                    return u.access_token;
                });

                // Handle redirect callback
                if (window.location.pathname === '/callback') {
                    try {
                        const cbUser = await mgr.signinRedirectCallback();
                        if (!cancelled) setUser(cbUser);
                        // Restore original URL or go to root
                        const returnUrl = sessionStorage.getItem('rdrive_return_url') || '/';
                        sessionStorage.removeItem('rdrive_return_url');
                        window.history.replaceState({}, '', returnUrl);
                    } catch {
                        window.history.replaceState({}, '', '/');
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

    const isAuthenticated = authEnabled === false || (user != null && !user.expired);

    const userName = user?.profile?.preferred_username
        || user?.profile?.name
        || user?.profile?.email
        || null;

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isLoading,
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
