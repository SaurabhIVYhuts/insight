#!/usr/bin/env node
// One-shot helper to provision an internal-role account that can open the
// Market Insight dashboard.
//
// It does the two things the dashboard's auth chain needs:
//   1. Redis  — creates the login credentials (api/_lib/userStore.js), the
//      same record api/auth/signup.js would write.
//   2. MongoDB — creates/updates the matching User document and sets its
//      `role` to an internal role (api/_lib/models/User.js), which is what
//      api/_lib/insightsDevAuth.js checks on every dashboard data call.
//
// If you share Redis + Mongo with the main ivyhuts-website app, any internal
// account that already works there works here too — you only need this for a
// brand-new environment, or to promote an account you just signed up through
// the /login form.
//
// Usage:
//   node scripts/create-internal-user.js \
//     --email you@ivyhuts.com --password 'strong-pass' \
//     --name "Your Name" --phone 9876543210 --role ADMIN
//
// Env: reads .env.local then .env (same as scripts/local-api-server.js).

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const INTERNAL_ROLES = ["MARKETING_AGENT", "MARKETING_MANAGER", "ADMIN"];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = (args.email || "").trim().toLowerCase();
  const password = args.password || "";
  const name = (args.name || "").trim() || "Insight Admin";
  const phone = (args.phone || "").replace(/[\s-]/g, "").trim() || null;
  const role = (args.role || "ADMIN").toUpperCase();

  if (!email || !password) {
    console.error("Missing required args. Example:\n  node scripts/create-internal-user.js --email you@ivyhuts.com --password 'pass' --name 'You' --phone 9876543210 --role ADMIN");
    process.exit(1);
  }
  if (!INTERNAL_ROLES.includes(role)) {
    console.error(`--role must be one of: ${INTERNAL_ROLES.join(", ")}`);
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — cannot set the user's role.");
    process.exit(1);
  }

  const { createUser, findUserByEmail } = require("../api/_lib/userStore.js");
  const { connectToDatabase, disconnectFromDatabase } = require("../api/_lib/mongodb.js");
  const User = require("../api/_lib/models/User.js");

  // 1. Redis login credentials
  const existingRedis = await findUserByEmail(email).catch((err) => {
    console.error("[redis] lookup failed:", err.message);
    process.exit(1);
  });
  if (existingRedis) {
    console.log(`[redis] login already exists for ${email} — leaving credentials untouched.`);
  } else {
    await createUser({ name, email, password, phone });
    console.log(`[redis] created login credentials for ${email}.`);
  }

  // 2. Mongo User document + role
  await connectToDatabase();
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, name, phone: phone || undefined, role, marketing: { source: "signup" } });
    await user.save({ validateBeforeSave: Boolean(phone) });
    console.log(`[mongo] created User ${email} with role ${role}.`);
  } else {
    user.role = role;
    if (!user.name) user.name = name;
    await user.save({ validateBeforeSave: false });
    console.log(`[mongo] updated User ${email} — role is now ${role}.`);
  }

  await disconnectFromDatabase();
  console.log("\nDone. Sign in at /login with this email + password, then open /insight.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
