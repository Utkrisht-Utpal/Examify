# Manual Logout Test Guide

This document outlines the manual testing procedure to verify that the logout flow works correctly and users are properly signed out with no dashboard re-appearing after browser refresh.

## Test Prerequisites

1. Ensure the app is running locally or deployed
2. Have a valid test user account (student or teacher)
3. Use a modern browser with DevTools available (Chrome, Firefox, Edge, etc.)

## Test Procedure

### Test 1: Basic Logout Flow

**Steps:**
1. Open the application in your browser
2. Sign in with valid credentials
3. Verify you see the dashboard (student or teacher view)
4. Click the "Logout" button in the header
5. Verify you are redirected to the `/login` page
6. Verify the login form is displayed

**Expected Result:**
- User is logged out
- Redirected to `/login` page
- Login form is visible

---

### Test 2: Verify Session Cleared (Browser Refresh)

**Steps:**
1. Sign in to the application
2. Verify you see the dashboard
3. Click the "Logout" button
4. Wait for redirect to `/login` page
5. **Press F5 or Ctrl+R to refresh the browser**
6. Observe what page is displayed

**Expected Result:**
- After refresh, the `/login` page should still be displayed
- Dashboard should NOT reappear
- User should remain logged out

---

### Test 3: Verify LocalStorage/SessionStorage Cleared

**Steps:**
1. Sign in to the application
2. Open browser DevTools (F12)
3. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
4. Expand "Local Storage" and "Session Storage"
5. Note the presence of Supabase auth keys (starting with `sb-` or containing `supabase.auth`)
6. Return to the app and click "Logout"
7. After redirect to `/login`, check DevTools storage again

**Expected Result:**
- All Supabase authentication keys should be removed from localStorage
- All Supabase authentication keys should be removed from sessionStorage
- Keys to check include:
  - `sb-<project-id>-auth-token`
  - `sb-refresh-token`
  - Any keys containing `supabase.auth`
  - `accountRole:<email>` should be removed

---

### Test 4: Manual URL Navigation After Logout

**Steps:**
1. Sign in to the application
2. Click "Logout"
3. After redirect to `/login`, manually type the dashboard URL in the address bar: `http://localhost:8080/` (or your app URL)
4. Press Enter

**Expected Result:**
- User should be redirected back to `/login`
- Dashboard should NOT be accessible
- No authenticated content should be visible

---

### Test 5: Service Worker Cache Test (if applicable)

**Steps:**
1. Sign in to the application
2. Open DevTools (F12) → Application tab → Service Workers
3. Note if any service workers are registered
4. Click "Logout"
5. After logout, check Service Workers section again

**Expected Result:**
- Any registered service workers should be unregistered
- No service workers should be listed after logout
- This prevents cached dashboard HTML from being served

---

### Test 6: Browser Back Button After Logout

**Steps:**
1. Sign in to the application
2. Navigate to dashboard
3. Click "Logout"
4. After redirect to `/login`, click the browser's **Back button**

**Expected Result:**
- User should remain on `/login` page OR be redirected back to `/login`
- Dashboard should NOT be accessible via back button
- No authenticated content should be visible

---

### Test 7: New Tab After Logout

**Steps:**
1. Sign in to the application in one browser tab
2. Open a new tab and navigate to the app URL (should show dashboard due to shared session)
3. Return to the first tab and click "Logout"
4. Switch to the second tab and refresh (F5)

**Expected Result:**
- Second tab should show `/login` page after refresh
- Session should be cleared across all tabs
- No dashboard should be visible in any tab

---

### Test 8: Direct Supabase Session Check

**Steps:**
1. Sign in to the application
2. Open DevTools Console (F12 → Console tab)
3. Run: `await supabase.auth.getSession()`
   - You may need to import supabase first or access it via window object
4. Note the session object returned
5. Click "Logout"
6. After redirect to `/login`, open DevTools Console again
7. Run: `await supabase.auth.getSession()`

**Expected Result:**
- Before logout: Session object with `access_token`, `refresh_token`, etc.
- After logout: Session should be `null` or empty

---

## Common Issues and Troubleshooting

### Issue: Dashboard reappears after refresh
**Possible Causes:**
- Service worker serving cached HTML
- LocalStorage not properly cleared
- Session cookie not cleared (though this app uses localStorage, not cookies)

**Solution:**
- Verify service workers are unregistered
- Check localStorage in DevTools
- Clear browser cache manually and retry

---

### Issue: Logout button does nothing
**Possible Causes:**
- JavaScript error preventing logout handler from firing
- Event handler not attached properly

**Solution:**
- Check browser console for errors
- Verify the logout button's `onClick` handler is properly connected
- Check that `signOut` function is being called

---

### Issue: Redirected to dashboard instead of login
**Possible Causes:**
- Protected route logic not checking session properly
- Auth state not updated correctly

**Solution:**
- Verify `ProtectedRoute` component checks for valid session
- Check that `useAuth` hook properly detects null session
- Ensure `onAuthStateChange` listener is working

---

## Automated Test Commands

While manual testing is required to verify browser behavior, you can also run:

```bash
# Run linter to check for code issues
npm run lint

# Build the app to verify no compilation errors
npm run build

# Preview the production build
npm run preview
```

---

## Success Criteria

All tests should pass with the following confirmed:
- ✅ Logout button triggers signOut
- ✅ User redirected to `/login` after logout
- ✅ Browser refresh keeps user on `/login` (no dashboard)
- ✅ All Supabase auth tokens cleared from localStorage
- ✅ All Supabase auth tokens cleared from sessionStorage
- ✅ Service workers unregistered (if any were registered)
- ✅ Manual navigation to `/` redirects to `/login`
- ✅ Browser back button doesn't show cached dashboard
- ✅ Session cleared across all browser tabs

---

## Notes

- This is a **client-side only** React/Vite app (not Next.js)
- No server-side cookies are used (all auth is via Supabase localStorage)
- The `window.location.replace('/login')` forces a hard redirect with full page reload
- Service worker unregistration prevents any cached dashboard HTML from being served
