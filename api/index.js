const { createServer } = require('http');
const url = require('url');

const LICENSES_FILE = '/tmp/licenses.json';
let licenses = {};

// 加载许可证数据
function loadLicenses() {
    return licenses;
}

function saveLicenses(data) {
    licenses = data;
}

const server = createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 路由处理
    if (path === '/api/test' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', service: 'license-server' }));
        return;
    }
    
    if (path === '/api/check_license' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const machineCode = (data.machine_code || '').replace(/-/g, '').toUpperCase();
                
                if (!machineCode || machineCode.length !== 32) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid machine code' }));
                    return;
                }
                
                const licenses = loadLicenses();
                
                if (licenses[machineCode] && licenses[machineCode].authorized) {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        authorized: true,
                        message: '设备已授权',
                        expire_date: licenses[machineCode].expire_date || '2099-12-31'
                    }));
                    return;
                }
                
                // 记录未授权设备
                if (!licenses[machineCode]) {
                    licenses[machineCode] = {
                        authorized: false,
                        first_seen: new Date().toISOString(),
                        last_check: new Date().toISOString()
                    };
                    saveLicenses(licenses);
                }
                
                res.writeHead(200);
                res.end(JSON.stringify({
                    authorized: false,
                    message: '设备未授权，请联系管理员'
                }));
                
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    if (path === '/api/update_license' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const machineCode = (data.machine_code || '').replace(/-/g, '').toUpperCase();
                const authorized = data.authorized || false;
                
                if (!machineCode || machineCode.length !== 32) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid machine code' }));
                    return;
                }
                
                const licenses = loadLicenses();
                licenses[machineCode] = {
                    ...licenses[machineCode],
                    authorized: authorized,
                    updated_at: new Date().toISOString(),
                    updated_by: 'admin'
                };
                saveLicenses(licenses);
                
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    machine_code: machineCode,
                    authorized: authorized
                }));
                
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    if (path === '/api/list_licenses' && req.method === 'GET') {
        const licenses = loadLicenses();
        res.writeHead(200);
        res.end(JSON.stringify({
            licenses: licenses,
            count: Object.keys(licenses).length
        }));
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Vercel 导出
module.exports = server;

// 本地运行
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}