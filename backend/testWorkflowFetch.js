const http = require('http');

const data = JSON.stringify({
  email: 'admin@tvs.com',
  password: 'admin123'
});

const loginOptions = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const makeReq = (options, postData) => new Promise((resolve, reject) => {
  const req = http.request(options, res => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', chunk => body += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  if (postData) req.write(postData);
  req.end();
});

const run = async () => {
  try {
    const loginRes = await makeReq(loginOptions, data);
    const authData = JSON.parse(loginRes.body);
    const token = authData.token;
    console.log('Login success:', authData.email);

    // Get a list of asset requests first to find an ID
    const listRes = await makeReq({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/asset-request',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const listData = JSON.parse(listRes.body);
    if (!listData.data || listData.data.length === 0) {
      console.log('No asset requests found.');
      return;
    }
    
    const reqId = listData.data[0]._id;
    console.log('Testing request ID:', reqId);

    const assetReqRes = await makeReq({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/asset-request/${reqId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('GET /api/asset-request/:id ->', assetReqRes.status, assetReqRes.body.substring(0, 100));

    const wfRes = await makeReq({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/workflow/${reqId}/state`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('GET /api/workflow/:id/state ->', wfRes.status, wfRes.body.substring(0, 100));

  } catch (err) {
    console.error(err);
  }
};

run();
