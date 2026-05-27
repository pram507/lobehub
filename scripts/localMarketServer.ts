import { exec } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { join } from 'node:path';

const PORT = process.env.MARKET_PORT || 3011;
const DATA_DIR = join(process.cwd(), 'data', 'market');

// Route mapping
const getFilePath = (url: string): string | null => {
  if (url === '/api/v1/agents/index.json') return join(DATA_DIR, 'agents.json');
  if (url === '/api/v1/plugins/index.json') return join(DATA_DIR, 'plugins.json');
  if (url === '/api/v1/skills/categories') return join(DATA_DIR, 'skill-categories.json');
  if (url === '/api/v1/plugins/categories') return join(DATA_DIR, 'plugin-categories.json');
  if (url === '/api/v1/providers') return join(DATA_DIR, 'providers.json');

  const parts = url.split('/').filter(Boolean); // ['api', 'v1', ...]

  // /api/v1/skills
  if (parts.length === 3 && parts[2] === 'skills') {
    return join(DATA_DIR, 'skills.json');
  }
  // /api/v1/skills/:id
  if (parts.length === 4 && parts[2] === 'skills') {
    return join(DATA_DIR, 'skills', `${decodeURIComponent(parts[3])}.json`);
  }

  // /api/v1/agents
  if (parts.length === 3 && parts[2] === 'agents') {
    return join(DATA_DIR, 'agents-list.json');
  }
  // /api/v1/agents/detail/:id
  if (parts.length === 5 && parts[2] === 'agents' && parts[3] === 'detail') {
    return join(DATA_DIR, 'agents', `${decodeURIComponent(parts[4])}.json`);
  }

  // /api/v1/plugins
  if (parts.length === 3 && parts[2] === 'plugins') {
    return join(DATA_DIR, 'plugins-list.json');
  }
  // /api/v1/plugins/:id
  if (parts.length === 4 && parts[2] === 'plugins') {
    return join(DATA_DIR, 'plugins', `${decodeURIComponent(parts[3])}.json`);
  }
  // /api/v1/plugins/:id/manifest
  if (parts.length === 5 && parts[2] === 'plugins' && parts[4] === 'manifest') {
    return join(DATA_DIR, 'plugins', `${decodeURIComponent(parts[3])}-manifest.json`);
  }

  return null;
};

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Strip query parameters
  const pathname = req.url ? req.url.split('?')[0] : '/';

  // Mock OAuth token endpoint for local development
  if (pathname === '/oauth/token') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        access_token: 'local-mock-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );
    return;
  }

  // Mock run-buildin-tools endpoint for local development
  if (
    pathname === '/api/v1/plugins/run-buildin-tools' ||
    pathname === '/v1/plugins/run-buildin-tools'
  ) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        console.log('Local Market Server: received payload:', JSON.stringify(payload, null, 2));

        const toolName = payload.toolName || payload.identifier;
        const params = payload.params || payload.arguments || {};

        const SANDBOX_ROOT = join(process.cwd(), 'data', 'sandbox');
        if (!existsSync(SANDBOX_ROOT)) {
          mkdirSync(SANDBOX_ROOT, { recursive: true });
        }

        const mapPath = (p: string) => {
          if (!p) return p;
          if (p.startsWith('/tmp/')) {
            const sandboxTmp = join(SANDBOX_ROOT, 'tmp', p.slice(5));
            if (existsSync(sandboxTmp)) return sandboxTmp;
            return p;
          }
          if (p.startsWith('/home/user')) {
            return p.replaceAll('/home/user', SANDBOX_ROOT);
          }
          if (!p.startsWith('/')) {
            return join(SANDBOX_ROOT, p);
          }
          return p.replaceAll('/home/user', SANDBOX_ROOT);
        };

        // 1. writeLocalFile
        if (toolName === 'writeLocalFile' && params.path) {
          const mappedPath = mapPath(params.path);
          const dir = join(mappedPath, '..');
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(mappedPath, params.content || '', 'utf-8');
          console.log(`Local Market Server: Wrote file: ${mappedPath}`);

          const responseData = {
            success: true,
            data: {
              result: {
                bytesWritten: (params.content || '').length,
              },
              sessionExpiredAndRecreated: false,
            },
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
          return;
        }

        // 2. readLocalFile
        if (toolName === 'readLocalFile' && params.path) {
          const mappedPath = mapPath(params.path);
          if (!existsSync(mappedPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                error: { message: `File not found: ${params.path}` },
              }),
            );
            return;
          }
          const content = readFileSync(mappedPath, 'utf-8');
          const responseData = {
            success: true,
            data: {
              result: {
                content,
                charCount: content.length,
                totalLineCount: content.split('\n').length,
              },
              sessionExpiredAndRecreated: false,
            },
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
          return;
        }

        // 3. listLocalFiles
        if (toolName === 'listLocalFiles') {
          const mappedPath = mapPath(params.directoryPath || '');
          if (!existsSync(mappedPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                error: { message: `Directory not found: ${params.directoryPath}` },
              }),
            );
            return;
          }
          const entries = readdirSync(mappedPath, { withFileTypes: true });
          const files = entries.map((entry) => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: join(params.directoryPath || '', entry.name),
          }));
          const responseData = {
            success: true,
            data: {
              result: {
                files,
                totalCount: files.length,
              },
              sessionExpiredAndRecreated: false,
            },
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
          return;
        }

        // 4. executeCode
        if (toolName === 'executeCode' && params.code) {
          const lang = params.language || 'python';
          const ext = lang === 'javascript' || lang === 'js' ? 'js' : 'py';
          const filename = `temp_code_${Date.now()}.${ext}`;
          const filePath = join(SANDBOX_ROOT, filename);
          writeFileSync(filePath, params.code, 'utf-8');

          const cmd =
            lang === 'js' || lang === 'javascript' ? `node ${filename}` : `python3 ${filename}`;
          console.log(`Local Market Server: Executing code via "${cmd}"`);

          exec(cmd, { cwd: SANDBOX_ROOT }, (error, stdout, stderr) => {
            // Clean up temporary file
            try {
              unlinkSync(filePath);
            } catch (e) {}

            const responseData = {
              success: true,
              data: {
                result: {
                  success: !error,
                  exitCode: error ? error.code || 1 : 0,
                  output: stdout,
                  stderr,
                  error: error ? error.message : null,
                },
                sessionExpiredAndRecreated: false,
              },
            };
            console.log(
              'Local Market Server: code execution finished. exitCode:',
              responseData.data.result.exitCode,
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
          });
          return;
        }

        // 5. exportFile
        if (toolName === 'exportFile' && params.path && params.uploadUrl) {
          const mappedPath = mapPath(params.path);
          console.log(
            `Local Market Server: Exporting file from ${mappedPath} to S3 upload URL: ${params.uploadUrl}`,
          );

          if (!existsSync(mappedPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                error: { message: `File not found to export: ${params.path}` },
              }),
            );
            return;
          }

          const fileContent = readFileSync(mappedPath);

          let contentType = 'application/octet-stream';
          if (mappedPath.endsWith('.svg')) contentType = 'image/svg+xml';
          else if (mappedPath.endsWith('.png')) contentType = 'image/png';
          else if (mappedPath.endsWith('.jpg') || mappedPath.endsWith('.jpeg'))
            contentType = 'image/jpeg';
          else if (mappedPath.endsWith('.json')) contentType = 'application/json';
          else if (mappedPath.endsWith('.txt')) contentType = 'text/plain';

          fetch(params.uploadUrl, {
            method: 'PUT',
            body: fileContent,
            headers: {
              'Content-Type': contentType,
            },
          })
            .then(async (uploadResponse) => {
              if (!uploadResponse.ok) {
                const errText = await uploadResponse.text();
                throw new Error(`Upload failed with status ${uploadResponse.status}: ${errText}`);
              }
              console.log('Local Market Server: File successfully uploaded to S3.');

              const responseData = {
                success: true,
                data: {
                  result: {
                    success: true,
                  },
                  sessionExpiredAndRecreated: false,
                },
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(responseData));
            })
            .catch((error) => {
              console.error('Local Market Server: S3 upload failed:', error);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: { message: `S3 upload failed: ${error.message}` },
                }),
              );
            });

          return;
        }

        // 6. runCommand
        if (toolName === 'runCommand' && params.command) {
          let command = params.command;
          // Map /home/user to local sandbox directory
          command = command.replaceAll('/home/user', SANDBOX_ROOT);

          console.log(
            `Local Market Server: Executing command locally in ${SANDBOX_ROOT}:\n  "${command}"`,
          );

          exec(command, { cwd: SANDBOX_ROOT }, (error, stdout, stderr) => {
            const responseData = {
              success: true,
              data: {
                result: {
                  exitCode: error ? error.code || 1 : 0,
                  stdout,
                  stderr,
                  error: error ? error.message : null,
                },
                sessionExpiredAndRecreated: false,
              },
            };
            console.log(
              'Local Market Server: command execution finished. exitCode:',
              responseData.data.result.exitCode,
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
          });
          return;
        }

        // Catch-all mock response for other sandbox tools
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: {
              result: 'Mocked local sandbox response',
              sessionExpiredAndRecreated: false,
            },
          }),
        );
      } catch (err) {
        console.error('Error in run-buildin-tools:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Internal Server Error', message: (err as Error).message }),
        );
      }
    });
    return;
  }

  // Mock user credentials endpoint for local development
  // if (pathname === '/api/v1/user/creds') {
  //   res.writeHead(200, { 'Content-Type': 'application/json' });
  //   res.end(JSON.stringify({
  //     data: []
  //   }));
  //   return;
  // }

  const filePath = getFilePath(pathname);

  // If the request is for a list file that needs filtering, apply optional filtering
  if (
    filePath &&
    (filePath.endsWith('plugins-list.json') ||
      filePath.endsWith('skills.json') ||
      filePath.endsWith('agents-list.json') ||
      filePath.endsWith('providers.json'))
  ) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const json = JSON.parse(raw);
      let items = json.items || json.plugins || json.agents || json; // Handle different JSON structures
      if (!Array.isArray(items) && json.items) items = json.items;

      const requestUrl = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
      const { searchParams } = requestUrl;
      // Extract query parameters
      const category = searchParams.get('category');
      const q = searchParams.get('q');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(
        searchParams.get('pageSize') || searchParams.get('limit') || '0',
        10,
      );

      // Apply category filter
      if (category) {
        items = items.filter((item: any) => {
          if (item.category === category) return true;
          if (item.meta && item.meta.category === category) return true;
          // Support multiple categories
          if (Array.isArray(item.categories) && item.categories.includes(category)) return true;
          return false;
        });
      }

      // Apply search query filter
      if (q) {
        const lowerQ = q.toLowerCase();
        items = items.filter((item: any) => {
          const strToSearch = [
            item.title,
            item.description,
            item.identifier,
            item.meta?.title,
            item.meta?.description,
            ...(item.meta?.tags || []),
            item.author,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return strToSearch.includes(lowerQ);
        });
      }
      const totalFiltered = items.length;
      // Pagination
      const effectivePageSize = pageSize > 0 ? pageSize : totalFiltered;
      const totalPages = Math.ceil(totalFiltered / effectivePageSize);
      const startIdx = (page - 1) * effectivePageSize;
      const pagedItems = items.slice(startIdx, startIdx + effectivePageSize);
      const response = {
        items: pagedItems,
        totalCount: totalFiltered,
        totalPages,
        currentPage: page,
        pageSize: effectivePageSize,
        categories: [],
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
    return;
  }

  if (filePath && existsSync(filePath)) {
    try {
      const data = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
    return;
  }

  // Fallback for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', url: pathname }));
});

server.listen(PORT, () => {
  console.log(`Local Market Server is running at http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
