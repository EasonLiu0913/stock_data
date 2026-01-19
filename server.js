const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIRS = {
    'fubon': path.join(__dirname, 'data_fubon'),
    'twse': path.join(__dirname, 'data_twse')
};

const server = http.createServer((req, res) => {
    // Enable CORS just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Log request for debugging
    console.log(`${req.method} ${req.url}`);

    // Remove query string for path matching
    const urlPath = req.url.split('?')[0];

    if (urlPath === '/' || urlPath === '') {
        // Serve the analyze.html file
        fs.readFile(path.join(__dirname, 'web/analyze.html'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading analyze.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            }
        });
    } else if (urlPath === '/compare') {
        // Serve the compare.html file
        fs.readFile(path.join(__dirname, 'web/compare.html'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading compare.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            }
        });
    } else if (urlPath.startsWith('/web/')) {
        // Serve files from web directory
        // /web/compare.html or /web/analyze.html
        const fileName = urlPath.replace('/web/', '');
        const filePath = path.join(__dirname, 'web', fileName);
        
        // Security check: ensure file is within web directory
        const webDir = path.join(__dirname, 'web');
        if (!filePath.startsWith(webDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        // Determine content type based on file extension
        let contentType = 'text/html; charset=utf-8';
        if (fileName.endsWith('.css')) {
            contentType = 'text/css';
        } else if (fileName.endsWith('.js')) {
            contentType = 'application/javascript';
        }
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    } else if (urlPath.startsWith('/api/files')) {
        // /api/files?source=fubon or /api/files?source=twse
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
        const urlParams = new URLSearchParams(queryString);
        const source = urlParams.get('source') || 'fubon';
        const targetDir = DIRS[source];

        if (!targetDir || !fs.existsSync(targetDir)) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Source not found' }));
            return;
        }

        fs.readdir(targetDir, (err, files) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Could not list files' }));
            } else {
                // Filter for CSV files
                const csvFiles = files.filter(f => f.endsWith('.csv'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(csvFiles));
            }
        });
    } else if (urlPath.startsWith('/data/')) {
        // /data/fubon/filename.csv or /data/twse/filename.csv
        const parts = urlPath.split('/');
        // parts: ['', 'data', 'source', 'filename']
        if (parts.length < 4) {
            res.writeHead(400);
            res.end('Invalid path');
            return;
        }

        const source = parts[2];
        const fileName = decodeURIComponent(parts.slice(3).join('/')); // Handle filenames with slashes if any, though unlikely here
        const targetDir = DIRS[source];

        if (!targetDir) {
            res.writeHead(404);
            res.end('Source not found');
            return;
        }

        const filePath = path.join(targetDir, fileName);

        // Security check: ensure file is within targetDir
        if (!filePath.startsWith(targetDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                // Determine content type based on file extension
                let contentType = 'text/plain; charset=utf-8';
                if (fileName.endsWith('.csv')) {
                    contentType = 'text/csv; charset=utf-8';
                } else if (fileName.endsWith('.json')) {
                    contentType = 'application/json; charset=utf-8';
                }
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop');
});
