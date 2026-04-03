#!/usr/bin/env node

/**
 * Test the login flow locally without needing VPS access
 * This validates that the session cookie flow is working correctly
 */

import http from "http";

const BASE_URL = "http://localhost:3000";

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testLoginFlow() {
  console.log("🔍 Testing Login Flow Locally\n");

  try {
    // Test 1: Health check
    console.log("1️⃣  Health Check");
    try {
      const health = await makeRequest("GET", "/api/health");
      console.log(`   Status: ${health.status}`);
      console.log(`   Response: ${JSON.stringify(health.body)}\n`);
    } catch (e) {
      console.log(
        `   ❌ Failed to connect to API at ${BASE_URL}`
      );
      console.log(
        "   Make sure you've started the API with: cd artifacts/api-server && pnpm dev\n"
      );
      return;
    }

    // Test 2: Get seeded users
    console.log("2️⃣  Check Seeded Users");
    try {
      const users = await makeRequest("GET", "/api/admin/users");
      console.log(`   Status: ${users.status}`);
      if (users.body?.users) {
        users.body.users.slice(0, 3).forEach((u) => {
          console.log(`   - ${u.username} (${u.email})`);
        });
      }
      console.log();
    } catch (e) {
      console.log(`   Could not fetch users: ${e.message}\n`);
    }

    // Test 3: Login with test credentials
    console.log("3️⃣  Login with Test Account");
    console.log("   Credentials: testuser / Test@123");
    const loginRes = await makeRequest("POST", "/api/auth/login", {
      email: "testuser@example.com",
      password: "Test@123",
    });

    console.log(`   Status: ${loginRes.status}`);
    console.log(
      `   Response: ${JSON.stringify(loginRes.body, null, 2).split("\n")[0]}`
    );
    console.log();

    // Test 4: Check Set-Cookie header
    console.log("4️⃣  Session Cookie Check");
    const setCookie = loginRes.headers["set-cookie"];
    if (setCookie) {
      console.log(`   ✅ Set-Cookie header found:`);
      setCookie.forEach((cookie) => {
        const parts = cookie.split(";")[0];
        console.log(`      ${parts}`);
      });
    } else {
      console.log(
        `   ❌ NO Set-Cookie header! Sessions won't persist.`
      );
      console.log(`   Available headers: ${JSON.stringify(loginRes.headers)}`);
    }
    console.log();

    // Test 5: Check if user was returned
    console.log("5️⃣  User Data Check");
    if (loginRes.body?.user) {
      console.log(`   ✅ User returned: ${loginRes.body.user.username}`);
      console.log(`   ID: ${loginRes.body.user.id}`);
      console.log(`   Email: ${loginRes.body.user.email}`);
    } else {
      console.log(`   ❌ No user data returned`);
    }
  } catch (err) {
    console.error("❌ Test failed:", err.message);
  }
}

testLoginFlow();
