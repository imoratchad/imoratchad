# IMORA - Auth Testing Playbook

## Test users (Google Auth via Emergent)
- Demo accounts are created on first Google sign-in via Emergent Auth.
- No password is stored (Google OAuth).

## Quick admin test account (created by seed script if needed)
- email: imoratchad@gmail.com (must be promoted to role=admin in DB)

## How to test backend
```bash
# Get session cookie (from real Google flow) OR use a mongosh-injected session
mongosh --eval "
use('test_database');
var userId = 'test-user-admin';
var sessionToken = 'test_session_admin';
db.users.replaceOne({user_id: userId}, {
  user_id: userId,
  email: 'imoratchad@gmail.com',
  name: 'IMORA Admin',
  picture: '',
  role: 'admin',
  created_at: new Date()
}, {upsert: true});
db.user_sessions.replaceOne({session_token: sessionToken}, {
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now()+7*24*60*60*1000),
  created_at: new Date()
}, {upsert: true});
print('Session: ' + sessionToken);
"

# Test /api/auth/me
curl -X GET https://immobilier-tchad.preview.emergentagent.com/api/auth/me \
  -H "Authorization: Bearer test_session_admin"
```

## Test cookie injection in browser
```javascript
await context.add_cookies([{
  name: "session_token",
  value: "test_session_admin",
  domain: ".preview.emergentagent.com",
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "None"
}]);
```
