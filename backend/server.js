const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec, spawn } = require('child_process');

// .envファイルを読み込む（dotenvパッケージなしで実装）
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    try {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(rawLine => {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) return;
            const idx = line.indexOf('=');
            if (idx === -1) return;
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            if (key) process.env[key] = value;
        });
        console.log(`Loaded environment from: ${envPath}`);
    } catch (err) {
        console.log(`No .env file found at project root, using defaults`);
        // デフォルト値を設定
        process.env.PORT = process.env.PORT || '7777';
        process.env.SCAN_PATH = process.env.SCAN_PATH || path.join(__dirname, '..', 'static', 'images');
    }
}
loadEnv();

function logSanitizedEnv() {
    const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
    if (!key) {
        console.log('[ENV] Anthropic API key not detected');
    } else {
        const masked = key.length <= 10 ? `${key.slice(0, 2)}****` : `${key.slice(0, 6)}****${key.slice(-4)}`;
        console.log(`[ENV] Anthropic API key loaded (mask=${masked}, length=${key.length})`);
    }
    if (process.env.CLAUDE_SKIP_PERMISSIONS) {
        console.log(`[ENV] CLAUDE_SKIP_PERMISSIONS=${process.env.CLAUDE_SKIP_PERMISSIONS}`);
    }
    if (process.env.CLAUDE_DEBUG) {
        console.log(`[ENV] CLAUDE_DEBUG=${process.env.CLAUDE_DEBUG}`);
    }
    if (process.env.CLAUDE_MAX_TURNS) {
        console.log(`[ENV] CLAUDE_MAX_TURNS=${process.env.CLAUDE_MAX_TURNS}`);
    }
}
logSanitizedEnv();

// Claude Code CLI 設定
const DEFAULT_CLAUDE_MCP_CONFIG = process.env.CLAUDE_MCP_CONFIG_PATH;
console.log(`[ENV] CLAUDE_MCP_CONFIG_PATH=${DEFAULT_CLAUDE_MCP_CONFIG || '(not set)'}`);
if (DEFAULT_CLAUDE_MCP_CONFIG && fs.existsSync(DEFAULT_CLAUDE_MCP_CONFIG)) {
    console.log(`[ENV] MCP config file exists at ${DEFAULT_CLAUDE_MCP_CONFIG}`);
} else if (DEFAULT_CLAUDE_MCP_CONFIG) {
    console.error(`[ENV] WARNING: MCP config file NOT found at ${DEFAULT_CLAUDE_MCP_CONFIG}`);
}

// タスク管理（メモリ内）
const tasks = {};
let nextTaskId = 1;

// サーバーログ（リングバッファ + 任意でファイルにも保存）
const serverLogs = [];
const SERVER_LOG_LIMIT = 1000;
const SERVER_STARTED_AT = new Date().toISOString();
const LOG_FILE_PATH = path.join(__dirname, 'backend.log');
function writeLogLine(line) {
    try { fs.appendFileSync(LOG_FILE_PATH, line + '\n'); } catch (_) {}
}
function pushServerLog(level, message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}`;
    serverLogs.push(line);
    if (serverLogs.length > SERVER_LOG_LIMIT) serverLogs.splice(0, serverLogs.length - SERVER_LOG_LIMIT);
    writeLogLine(line);
}
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => { originalLog(...args); pushServerLog('INFO', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); };
console.error = (...args) => { originalError(...args); pushServerLog('ERROR', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); };

function createTaskId() {
    const id = String(nextTaskId++);
    return id;
}

function appendAndParseOutput(task, chunk) {
    const text = chunk.toString();
    task.logs.push(text);
    const nowIso = new Date().toISOString();
    task.updatedAt = nowIso;
    task.lastActivityAt = nowIso;
    // URL抽出
    const urlRegex = /(https?:\/\/[^\s"'<>\)]+)/g;
    let m;
    while ((m = urlRegex.exec(text)) !== null) {
        const url = m[1];
        if (!task.urls.includes(url)) task.urls.push(url);
    }
    // 絶対パスらしきものを抽出（mac/Linux）
    const pathRegex = /(?:\/[A-Za-z0-9._\-]+)+\.[A-Za-z0-9._\-]+/g;
    let p;
    while ((p = pathRegex.exec(text)) !== null) {
        const filePath = p[0];
        if (!task.files.includes(filePath)) task.files.push(filePath);
    }
}

function startClaudeTask({ prompt, mcpConfigPath, cwd, extraArgs }) {
    const id = createTaskId();
    const resolvedMcp = mcpConfigPath || DEFAULT_CLAUDE_MCP_CONFIG;
    
    if (!resolvedMcp) {
        console.error('[ERROR] CLAUDE_MCP_CONFIG_PATH environment variable is not set');
        throw new Error('MCP configuration path is required. Set CLAUDE_MCP_CONFIG_PATH environment variable.');
    }
    
    // CLIコマンドの構築（--printオプションと正しい順序で）
    const args = ['--print'];

    if (process.env.CLAUDE_SKIP_PERMISSIONS === '1' || process.env.CLAUDE_SKIP_PERMISSIONS === 'true') {
        args.push('--dangerously-skip-permissions');
    }

    if (process.env.CLAUDE_DEBUG) {
        args.push('--debug');
        if (process.env.CLAUDE_DEBUG !== '1' && process.env.CLAUDE_DEBUG !== 'true') {
            args.push(process.env.CLAUDE_DEBUG);
        }
    }

    const extraArgKeys = extraArgs && typeof extraArgs === 'object' ? Object.keys(extraArgs) : [];
    const hasOutputFormat = extraArgKeys.some(k => k === 'output-format' || k === 'outputFormat');
    const defaultOutputFormat = process.env.CLAUDE_OUTPUT_FORMAT || 'json';
    if (!hasOutputFormat && defaultOutputFormat) {
        args.push('--output-format', defaultOutputFormat);
    }

    args.push('--mcp-config', resolvedMcp);

    const hasMaxTurns = extraArgKeys.some(k => k === 'max-turns' || k === 'maxTurns');
    if (!hasMaxTurns && process.env.CLAUDE_MAX_TURNS) {
        args.push('--max-turns', String(process.env.CLAUDE_MAX_TURNS));
    }
    
    if (extraArgs && typeof extraArgs === 'object') {
        Object.entries(extraArgs).forEach(([k, v]) => {
            args.push(`--${k}`);
            if (v !== null && v !== undefined && v !== '') {
                args.push(String(v));
            }
        });
    }
    
    // Commander in Claude CLI treats --mcp-config as variadic. Insert "--" to
    // terminate option parsing so the prompt is not consumed as another config path.
    if (prompt !== undefined && prompt !== null) {
        args.push('--');
        args.push(String(prompt));
    }
    
    const cmd = `claude ${args.join(' ')}`;
    console.log(`[TASK ${id}] Starting: ${cmd}`);
    
    // 直接 claude コマンドを実行（bash経由を避ける）
    const child = spawn('claude', args, {
        env: { ...process.env, PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin:/usr/bin` },
        cwd: cwd && typeof cwd === 'string' ? cwd : process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const nowIso = new Date().toISOString();
    const task = {
        id,
        status: 'running',
        prompt: String(prompt || ''),
        command: cmd,
        pid: child.pid,
        proc: child,
        createdAt: nowIso,
        updatedAt: nowIso,
        endedAt: null,
        exitCode: null,
        logs: [],
        urls: [],
        files: [],
        monitor: null,
        stdout: '',
        stderr: '',
        resultMeta: null,
        lastActivityAt: nowIso,
        durationMs: null,
        heartbeatIntervalId: null,
        resultText: null,
        stdoutBytes: 0,
        stderrBytes: 0
    };
    tasks[id] = task;
    console.log(`[TASK ${id}] Child PID: ${child.pid}`);
    const mcpExists = resolvedMcp && fs.existsSync(resolvedMcp);
    console.log(`[TASK ${id}] MCP config path=${resolvedMcp} (exists=${mcpExists})`);
    
    if (!mcpExists) {
        console.error(`[TASK ${id}] ERROR: MCP config file not found at ${resolvedMcp}`);
        task.status = 'failed';
        task.exitCode = -1;
        task.endedAt = new Date().toISOString();
        task.updatedAt = task.endedAt;
        task.logs.push(`ERROR: MCP config file not found at ${resolvedMcp}`);
        return task;
    }

    const heartbeatMs = Number(process.env.CLAUDE_HEARTBEAT_MS || 10000);
    if (!Number.isNaN(heartbeatMs) && heartbeatMs > 0) {
        task.heartbeatIntervalId = setInterval(() => {
            const lastTs = task.lastActivityAt ? new Date(task.lastActivityAt).getTime() : Date.now();
            const sinceSec = Math.round((Date.now() - lastTs) / 1000);
            console.log(`[TASK ${id}] Heartbeat: status=${task.status}, lastActivity=${sinceSec}s ago, pid=${task.pid}, stdoutBytes=${task.stdoutBytes}, stderrBytes=${task.stderrBytes}`);
        }, heartbeatMs);
    }

    child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        const preview = text.length > 200 ? `${text.slice(0, 200)}...` : text;
        console.log(`[TASK ${id}] STDOUT (${text.length} bytes): ${preview}`);
        task.stdout += text;
        task.stdoutBytes += Buffer.byteLength(chunk);
        appendAndParseOutput(task, chunk);
    });

    child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        console.log(`[TASK ${id}] STDERR (${text.length} bytes): ${text}`); // 全文を表示
        task.stderr += text;
        task.stderrBytes += Buffer.byteLength(chunk);
        appendAndParseOutput(task, chunk);
    });

    child.on('close', (code) => {
        console.log(`[TASK ${id}] Process closed with code: ${code}`);
        task.status = code === 0 ? 'completed' : 'failed';
        task.exitCode = code;
        task.endedAt = new Date().toISOString();
        task.updatedAt = task.endedAt;
        if (task.heartbeatIntervalId) {
            clearInterval(task.heartbeatIntervalId);
            task.heartbeatIntervalId = null;
        }
        if (task.createdAt) {
            task.durationMs = new Date(task.endedAt).getTime() - new Date(task.createdAt).getTime();
        }
        const stdoutTrimmed = task.stdout.trim();
        if (stdoutTrimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(stdoutTrimmed);
                task.resultMeta = parsed;
                const turns = parsed.num_turns ?? parsed.numTurns ?? null;
                if (turns !== null) {
                    console.log(`[TASK ${id}] Result: turns=${turns}`);
                }
                const resultText = typeof parsed.result === 'string'
                    ? parsed.result
                    : Array.isArray(parsed.messages)
                        ? parsed.messages.map((msg) => {
                            if (!msg || typeof msg !== 'object') return '';
                            if (Array.isArray(msg.content)) {
                                return msg.content.map((entry) => entry && typeof entry === 'object' && typeof entry.text === 'string' ? entry.text : '').join('\n');
                            }
                            if (typeof msg.content === 'string') return msg.content;
                            if (typeof msg.text === 'string') return msg.text;
                            return '';
                        }).join('\n').trim()
                        : null;
                if (resultText) {
                    task.resultText = resultText;
                    const preview = resultText.length > 400 ? `${resultText.slice(0, 400)}...` : resultText;
                    console.log(`[TASK ${id}] AI Result: ${preview}`);
                    task.logs.push(`\n[AI Result]\n${resultText}\n`);
                }
                if (parsed.duration_ms || parsed.durationMs) {
                    console.log(`[TASK ${id}] Result duration(ms): ${parsed.duration_ms || parsed.durationMs}`);
                }
                if (parsed.total_cost_usd !== undefined) {
                    console.log(`[TASK ${id}] Result cost(USD): ${parsed.total_cost_usd}`);
                }
            } catch (err) {
                console.log(`[TASK ${id}] Result JSON parse error: ${err.message}`);
            }
        }
    });

    child.on('error', (err) => {
        console.log(`[TASK ${id}] Process error: ${err.message}`);
        appendAndParseOutput(task, String(err.message || err));
        task.status = 'failed';
        task.exitCode = -1;
        task.endedAt = new Date().toISOString();
        task.updatedAt = task.endedAt;
        if (task.heartbeatIntervalId) {
            clearInterval(task.heartbeatIntervalId);
            task.heartbeatIntervalId = null;
        }
    });
    
    return task;
}

function startMonitor(task, { intervalSec = 10, callbackUrl } = {}) {
    if (!task || task.monitor) return task;
    const intervalMs = Math.max(1, Number(intervalSec)) * 1000;
    const monitor = {
        intervalMs,
        intervalSec: intervalMs / 1000,
        startedAt: new Date().toISOString(),
        nextCheckAt: new Date(Date.now() + intervalMs).toISOString(),
        checks: 0,
        callbackUrl: typeof callbackUrl === 'string' ? callbackUrl : null,
        intervalId: null
    };
    function postCallbackIfNeeded(final = false) {
        if (!monitor.callbackUrl) return;
        try {
            const payload = JSON.stringify({ final, task: publicTaskView(task, final) });
            const url = new URL(monitor.callbackUrl);
            const client = url.protocol === 'https:' ? require('https') : require('http');
            const req = client.request({
                method: 'POST',
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + (url.search || ''),
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            });
            req.on('error', () => {});
            req.write(payload);
            req.end();
        } catch (_) {}
    }
    monitor.intervalId = setInterval(() => {
        monitor.checks += 1;
        monitor.nextCheckAt = new Date(Date.now() + intervalMs).toISOString();
        // 子プロセスの状態はイベントで更新されるが、ここでは心拍のようなメタ情報のみ更新
        task.updatedAt = new Date().toISOString();
        if (task.status === 'completed' || task.status === 'failed') {
            clearInterval(monitor.intervalId);
            monitor.intervalId = null;
            postCallbackIfNeeded(true);
        } else {
            postCallbackIfNeeded(false);
        }
    }, intervalMs);
    task.monitor = monitor;
    return task;
}

function publicTaskView(task, includeLogs = false) {
    if (!task) return null;
    const joinedLogs = (task.logs || []).join('');
    const maxLen = 20000;
    const takeTail = (value) => {
        if (!value) return '';
        return value.length > maxLen ? value.slice(-maxLen) : value;
    };
    const logs = includeLogs ? takeTail(joinedLogs) : undefined;
    const stdout = includeLogs ? takeTail(task.stdout || '') : undefined;
    const stderr = includeLogs ? takeTail(task.stderr || '') : undefined;
    return {
        id: task.id,
        status: task.status,
        prompt: task.prompt,
        command: task.command,
        pid: task.pid,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        endedAt: task.endedAt,
        exitCode: task.exitCode,
        urls: task.urls,
        files: task.files,
        lastActivityAt: task.lastActivityAt,
        durationMs: task.durationMs,
        numTurns: task.resultMeta ? (task.resultMeta.num_turns ?? task.resultMeta.numTurns ?? null) : null,
        resultText: task.resultText,
        resultMeta: includeLogs ? task.resultMeta : undefined,
        monitor: task.monitor ? {
            intervalSec: task.monitor.intervalSec,
            checks: task.monitor.checks,
            nextCheckAt: task.monitor.nextCheckAt,
            startedAt: task.monitor.startedAt,
            callbackUrl: task.monitor.callbackUrl || undefined
        } : null,
        logs,
        stdout,
        stderr,
        stdoutBytes: task.stdoutBytes,
        stderrBytes: task.stderrBytes
    };
}

// メディア/ドキュメント/コードなどの拡張子
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
const htmlExtensions  = ['html', 'htm'];
const yamlExtensions  = ['yml', 'yaml'];
const jsonExtensions  = ['json'];
const textExtensions  = ['txt', 'md', 'markdown', 'log'];
const codeExtensions  = ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'fish'];
const docExtensions   = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'tsv'];

// ディレクトリをスキャンする関数
function scanDirectory(dirPath, baseDir = null, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return { files: [], folders: [] };
    
    if (!baseDir) baseDir = dirPath;
    
    const result = {
        files: [],
        folders: []
    };
    
    try {
        const items = fs.readdirSync(dirPath);
        
        items.forEach(item => {
            // 隠しファイルやシステムファイルをスキップ
            if (item.startsWith('.') || item === 'node_modules') return;
            
            const fullPath = path.join(dirPath, item);
            const relativePath = path.relative(baseDir, fullPath);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                const subItems = scanDirectory(fullPath, baseDir, depth + 1, maxDepth);
                result.folders.push({
                    name: item,
                    path: relativePath,
                    items: subItems
                });
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase().slice(1);
                let type = 'other';
                
                if (imageExtensions.includes(ext)) type = 'image';
                else if (videoExtensions.includes(ext)) type = 'video';
                else if (audioExtensions.includes(ext)) type = 'audio';
                else if (htmlExtensions.includes(ext)) type = 'html';
                else if (yamlExtensions.includes(ext)) type = 'yaml';
                else if (jsonExtensions.includes(ext)) type = 'json';
                else if (codeExtensions.includes(ext)) type = 'code';
                else if (textExtensions.includes(ext)) type = 'text';
                else if (docExtensions.includes(ext)) type = 'doc';
                
                // すべてのタイプ（other含む）を返す
                result.files.push({
                    name: item,
                    path: relativePath,
                    fullPath: fullPath,
                    type: type,
                    ext: ext,
                    size: stat.size,
                    modified: stat.mtime
                });
            }
        });
    } catch (err) {
        console.error('Error scanning directory:', dirPath, err);
    }
    
    return result;
}

// HTTPサーバーの作成
const server = http.createServer((req, res) => {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS リクエストへの対応（CORS preflight）
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 設定情報のエンドポイント
    if (req.url === '/api/config') {
        if (!process.env.PORT || !process.env.SCAN_PATH) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                error: 'Missing required environment variables: PORT and/or SCAN_PATH'
            }));
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
            port: process.env.PORT,
            scanPath: process.env.SCAN_PATH
        }));
        return;
    }
    
    // 静的ファイルの配信（画像、動画、音声）
    if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        // index.htmlの配信
        if (req.url === '/' || req.url === '/index.html') {
            const indexPath = path.join(__dirname, 'index.html');
            fs.readFile(indexPath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                res.setHeader('Content-Type', 'text/html');
                res.writeHead(200);
                res.end(data);
            });
            return;
        }
        
        // メディアファイルの配信
        if (!process.env.SCAN_PATH) {
            res.writeHead(500);
            res.end('ERROR: SCAN_PATH environment variable is not set');
            return;
        }
        const baseDir = process.env.SCAN_PATH;
        const filePath = decodeURIComponent(req.url.substring(1)); // 先頭の/を削除
        const fullPath = path.join(baseDir, filePath);
        
        // ファイルの存在確認
        fs.stat(fullPath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            
            // MIMEタイプの設定
            const ext = path.extname(fullPath).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.mp4': 'video/mp4',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
                '.mkv': 'video/x-matroska',
                '.webm': 'video/webm',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.flac': 'audio/flac',
                '.m4a': 'audio/mp4',
                '.html': 'text/html; charset=utf-8',
                '.htm': 'text/html; charset=utf-8'
            };
            
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            // ファイルをストリーミング
            const stream = fs.createReadStream(fullPath);
            stream.pipe(res);
            stream.on('error', () => {
                res.writeHead(500);
                res.end('Internal server error');
            });
        });
        return;
    }
    
    res.setHeader('Content-Type', 'application/json');
    const requestUrl = new URL(req.url, 'http://localhost');
    
    if (requestUrl.pathname === '/api/scan' && req.method === 'GET') {
        // .envで指定された絶対パスをスキャン
        if (!process.env.SCAN_PATH) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'SCAN_PATH environment variable is not set' }));
            return;
        }
        const currentDir = process.env.SCAN_PATH;
        console.log('Scanning directory:', currentDir);
        const mediaFiles = scanDirectory(currentDir);
        
        res.writeHead(200);
        res.end(JSON.stringify({
            baseDir: currentDir,
            data: mediaFiles
        }));
    } else if (requestUrl.pathname === '/api/open-file' && req.method === 'POST') {
        // ファイルを開く
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { path: filePath } = JSON.parse(body);
                if (!process.env.SCAN_PATH) {
            res.writeHead(500);
            res.end('ERROR: SCAN_PATH environment variable is not set');
            return;
        }
        const baseDir = process.env.SCAN_PATH;
                const fullPath = path.join(baseDir, filePath);
                
                // macOSの場合
                if (process.platform === 'darwin') {
                    exec(`open "${fullPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening file:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open file' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Windowsの場合
                else if (process.platform === 'win32') {
                    exec(`start "" "${fullPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening file:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open file' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Linuxの場合
                else {
                    exec(`xdg-open "${fullPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening file:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open file' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
            } catch (err) {
                console.error('Error parsing request:', err);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else if (requestUrl.pathname === '/api/open-file-absolute' && req.method === 'POST') {
        // 絶対パスのファイルを開く
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { path: filePath } = JSON.parse(body);
                if (!filePath || !filePath.startsWith('/')) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid absolute path' }));
                    return;
                }
                
                // macOSの場合
                if (process.platform === 'darwin') {
                    exec(`open "${filePath}"`, (error) => {
                        if (error) {
                            console.error('Error opening file:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open file' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Windowsの場合
                else if (process.platform === 'win32') {
                    exec(`start "" "${filePath}"`, (error) => {
                        if (error) {
                            console.error('Error opening file:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open file' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Linuxの場合
                else {
                    exec(`xdg-open "${filePath}"`, (error) => {
                        if (error) {
                            console.error('Error opening file:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open file' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
            } catch (err) {
                console.error('Error parsing request:', err);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else if (requestUrl.pathname === '/api/open-folder-absolute' && req.method === 'POST') {
        // 絶対パスのフォルダを開く
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { path: folderPath } = JSON.parse(body);
                if (!folderPath || !folderPath.startsWith('/')) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid absolute path' }));
                    return;
                }
                
                // macOSの場合
                if (process.platform === 'darwin') {
                    exec(`open "${folderPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening folder:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open folder' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Windowsの場合
                else if (process.platform === 'win32') {
                    exec(`explorer "${folderPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening folder:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open folder' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Linuxの場合
                else {
                    exec(`xdg-open "${folderPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening folder:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open folder' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
            } catch (err) {
                console.error('Error parsing request:', err);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else if (requestUrl.pathname === '/api/open-folder' && req.method === 'POST') {
        // フォルダを開く
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { path: folderPath } = JSON.parse(body);
                if (!process.env.SCAN_PATH) {
            res.writeHead(500);
            res.end('ERROR: SCAN_PATH environment variable is not set');
            return;
        }
        const baseDir = process.env.SCAN_PATH;
                const fullPath = path.join(baseDir, folderPath);
                
                // macOSの場合
                if (process.platform === 'darwin') {
                    exec(`open "${fullPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening folder:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open folder' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Windowsの場合
                else if (process.platform === 'win32') {
                    exec(`explorer "${fullPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening folder:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open folder' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
                // Linuxの場合
                else {
                    exec(`xdg-open "${fullPath}"`, (error) => {
                        if (error) {
                            console.error('Error opening folder:', error);
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to open folder' }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                }
            } catch (err) {
                console.error('Error parsing request:', err);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else if (requestUrl.pathname === '/api/health' && req.method === 'GET') {
        const all = Object.values(tasks);
        const stats = all.reduce((acc, t) => {
            acc.total++;
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, { total: 0, running: 0, completed: 0, failed: 0 });
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'ok',
            port: process.env.PORT,
            scanPath: process.env.SCAN_PATH,
            pid: process.pid,
            startedAt: SERVER_STARTED_AT,
            uptimeSeconds: Math.floor(process.uptime()),
            tasks: stats
        }));
    } else if (requestUrl.pathname === '/api/logs' && req.method === 'GET') {
        const limitParam = requestUrl.searchParams.get('limit');
        const limit = Math.max(1, Math.min(1000, Number(limitParam) || 200));
        const since = requestUrl.searchParams.get('since');
        let lines = serverLogs.slice(-limit);
        if (since) {
            const idx = serverLogs.findIndex(l => l.startsWith(`[${since}`));
            if (idx >= 0) lines = serverLogs.slice(idx);
        }
        res.writeHead(200);
        res.end(JSON.stringify({ lines, count: lines.length }));
    } else if (requestUrl.pathname === '/api/agent/submit' && req.method === 'POST') {
        // タスクを新規作成して実行
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const payload = body ? JSON.parse(body) : {};
                const prompt = payload.prompt || '';
                const mcpConfigPath = payload.mcpConfigPath;
                const cwd = payload.cwd;
                const extraArgs = payload.extraArgs;
                const task = startClaudeTask({ prompt, mcpConfigPath, cwd, extraArgs });
                res.writeHead(202);
                res.end(JSON.stringify({ task: publicTaskView(task, false) }));
            } catch (err) {
                console.error('Submit parse error:', err);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else if (requestUrl.pathname === '/api/agent/status' && req.method === 'GET') {
        // タスクの状態を返す（id指定がなければ一覧）
        const id = requestUrl.searchParams.get('id');
        if (id) {
            const task = tasks[id];
            if (!task) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Task not found' }));
                return;
            }
            res.writeHead(200);
            res.end(JSON.stringify({ task: publicTaskView(task, false) }));
        } else {
            const list = Object.values(tasks).map(t => publicTaskView(t, false));
            // サマリー統計
            const stats = list.reduce((acc, t) => {
                acc.total++;
                acc[t.status] = (acc[t.status] || 0) + 1;
                return acc;
            }, { total: 0, running: 0, completed: 0, failed: 0 });
            res.writeHead(200);
            res.end(JSON.stringify({ tasks: list, stats }));
        }
    } else if (requestUrl.pathname === '/api/agent/result' && req.method === 'GET') {
        // タスク結果詳細（ログ含む）
        const id = requestUrl.searchParams.get('id');
        const includeLogs = requestUrl.searchParams.get('logs') === '1' || requestUrl.searchParams.get('logs') === 'true';
        if (!id) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing id' }));
            return;
        }
        const task = tasks[id];
        if (!task) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Task not found' }));
            return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ task: publicTaskView(task, includeLogs) }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

if (!process.env.PORT) {
    console.error('ERROR: PORT environment variable is not set');
    process.exit(1);
}
const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`Media scanner server running at http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/scan`);
});
