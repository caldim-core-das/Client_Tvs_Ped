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

    const wfRes = await makeReq({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/workflow/queue/l1`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('GET /api/workflow/queue/l1 ->', wfRes.status, wfRes.body);

  } catch (err) {
    console.error(err);
  }
};

run();
