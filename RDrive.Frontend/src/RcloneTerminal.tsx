import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from './Auth';

interface RcloneTerminalProps {
    onClose: () => void;
    onDone?: () => void;
}

export default function RcloneTerminal({ onClose, onDone }: RcloneTerminalProps) {
    const termRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const onCloseRef = useRef(onClose);
    const onDoneRef = useRef(onDone);
    const { getAccessToken } = useAuth();
    const getAccessTokenRef = useRef(getAccessToken);
    onCloseRef.current = onClose;
    onDoneRef.current = onDone;
    getAccessTokenRef.current = getAccessToken;

    useEffect(() => {
        if (!termRef.current) return;
        let cancelled = false;

        // Create terminal
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, monospace",
            theme: {
                background: '#1e1e2e',
                foreground: '#cdd6f4',
                cursor: '#f5e0dc',
                selectionBackground: '#585b7066',
                black: '#45475a',
                red: '#f38ba8',
                green: '#a6e3a1',
                yellow: '#f9e2af',
                blue: '#89b4fa',
                magenta: '#f5c2e7',
                cyan: '#94e2d5',
                white: '#bac2de',
                brightBlack: '#585b70',
                brightRed: '#f38ba8',
                brightGreen: '#a6e3a1',
                brightYellow: '#f9e2af',
                brightBlue: '#89b4fa',
                brightMagenta: '#f5c2e7',
                brightCyan: '#94e2d5',
                brightWhite: '#a6adc8',
            },
            convertEol: true,
            scrollback: 1000,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        terminal.open(termRef.current);
        fitAddon.fit();

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Delay focus to ensure DOM is settled (React StrictMode double-mount)
        const focusTimer = setTimeout(() => terminal.focus(), 100);

        terminal.writeln('\x1b[1;34m━━━ rclone config ━━━\x1b[0m');
        terminal.writeln('');

        // Connect WebSocket (deferred to avoid StrictMode double-mount errors)
        let ws: WebSocket | null = null;
        const connectTimer = setTimeout(async () => {
            if (cancelled) return;
            const apiBase = import.meta.env.VITE_API_BASE || '/api';
            const base = new URL(apiBase, window.location.origin);
            const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl = `${protocol}//${base.host}${base.pathname}/terminal/ws`;

            // Attach token as query param (browsers can't set WS headers)
            const token = await getAccessTokenRef.current();
            if (token) wsUrl += `?access_token=${encodeURIComponent(token)}`;

            ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                terminal.focus();
            };

            ws.onmessage = (event) => {
                terminal.write(event.data);
            };

            ws.onclose = () => {
                terminal.writeln('');
                terminal.writeln('\x1b[1;33m[Session ended. Press any key to close.]\x1b[0m');
                terminal.onKey(() => {
                    onDoneRef.current?.();
                    onCloseRef.current();
                });
            };

            ws.onerror = () => {
                terminal.writeln('\x1b[1;31m[Connection error]\x1b[0m');
            };

            // Line-buffered input: rclone config reads lines, not raw chars
            let inputBuffer = '';

            terminal.onData((data) => {
                if (!ws || ws.readyState !== WebSocket.OPEN) return;

                for (const ch of data) {
                    if (ch === '\r') {
                        // Enter: send buffered line + newline, echo newline
                        terminal.write('\r\n');
                        ws.send(inputBuffer + '\n');
                        inputBuffer = '';
                    } else if (ch === '\x7f' || ch === '\b') {
                        // Backspace: remove last char and erase on screen
                        if (inputBuffer.length > 0) {
                            inputBuffer = inputBuffer.slice(0, -1);
                            terminal.write('\b \b');
                        }
                    } else if (ch === '\x03') {
                        // Ctrl+C
                        ws.send('\x03');
                        inputBuffer = '';
                    } else if (ch >= ' ') {
                        // Printable character: buffer and echo
                        inputBuffer += ch;
                        terminal.write(ch);
                    }
                }
            });
        }, 50);

        const handleResize = () => {
            fitAddon.fit();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelled = true;
            clearTimeout(focusTimer);
            clearTimeout(connectTimer);
            window.removeEventListener('resize', handleResize);
            ws?.close();
            terminal.dispose();
            wsRef.current = null;
            terminalRef.current = null;
            fitAddonRef.current = null;
        };
    }, []); // stable — no dependencies, callbacks accessed via refs

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1e1e2e] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden border border-gray-700">
                {/* Title bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-gray-400 text-sm ml-2 font-mono">rclone config</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-gray-700"
                        title="Close terminal"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Terminal */}
                <div
                    ref={termRef}
                    className="flex-1 p-2"
                    style={{ minHeight: '400px', maxHeight: '70vh' }}
                    onClick={() => terminalRef.current?.focus()}
                />
            </div>
        </div>
    );
}
