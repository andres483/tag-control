/**
 * asc-update-build15.mjs
 * 1. Update Support URL → /support (fix Guideline 1.5)
 * 2. Update Review Notes (fix Guideline 2.1a - email field)
 * 3. Find Build 15, assign to version, submit
 *
 * Usage:
 *   node scripts/asc-update-build15.mjs --metadata   # only update URL + notes
 *   node scripts/asc-update-build15.mjs --submit      # find build 15 + submit
 *   node scripts/asc-update-build15.mjs               # metadata + submit
 */

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';

const KEY_ID = 'S43MJL4WRM';
const ISSUER_ID = 'd0326120-d44e-4d10-b9bd-ee9a00b9737a';
const APP_ID = '6762680012';
const VERSION_ID = '94706861-cd1b-41ea-b502-b42d04bbe877';
const LOC_ID = '4b3204be-a31f-42ce-bcfb-9d89dfb213c5'; // appStoreVersionLocalization es-MX
const REVIEW_DETAIL_ID = '46b81b64-3974-4fdb-b63d-e094d229fec0';
const SUBMISSION_ID = '14ac2994-dc83-4fa9-a67a-c3a6a4474fcc';
const P8_PATH = '/Users/panthervillagran/blooming-website/proposals/clients/tagcontrol/AuthKey_S43MJL4WRM.p8';

const SUPPORT_URL = 'https://tag-control.vercel.app/support';

const REVIEW_NOTES = `TAGcontrol detects highway tolls automatically via GPS while driving in Chile.

━━━ LOGIN CREDENTIALS ━━━
  Name: revisor
  PIN:  2026
  (No email needed — tap "Entrar" directly)
This account works 100% OFFLINE — no internet required.

━━━ DEMO MODE (alternative) ━━━
Tap "Ver cómo funciona →" on the login screen to explore without an account.
Shows 5 sample trips with real Chilean toll names and costs.

━━━ EMAIL FIELD — when it appears ━━━
The email field ONLY appears when creating a brand-new account:
  1. Enter a new name (e.g. "testuser") + any 4-digit PIN → tap "Entrar"
  2. App checks if user exists → not found → asks for email
  3. Type any email (e.g. test@apple.com) → tap "Entrar" → account created
The email input is fully responsive and accepts keyboard input on all devices.
With revisor/2026, you will NOT see the email field — login is immediate.

━━━ BACKGROUND LOCATION ━━━
GPS runs in the background only while a trip is active (user taps "Iniciar viaje").
Permission requested on first trip start, not at launch.

━━━ GPS NOTE ━━━
Toll detection is calibrated for Chilean highways. Review devices outside Chile will not auto-detect tolls. Use demo mode to see the full trip history UI.

━━━ SUPPORT ━━━
https://tag-control.vercel.app/support`;

const privateKey = fs.readFileSync(P8_PATH, 'utf8');

function generateToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const d = `${h}.${p}`;
  const s = crypto.createSign('SHA256');
  s.update(d);
  return `${d}.${s.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

function apiCall(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com',
      path: `/v1${urlPath}`, method,
      headers: {
        Authorization: `Bearer ${generateToken()}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: r.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const args = process.argv.slice(2);
const onlyMetadata = args.includes('--metadata');
const onlySubmit = args.includes('--submit');
const doMetadata = !onlySubmit;
const doSubmit = !onlyMetadata;

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  TAGcontrol Build 15 — ASC Update');
  console.log('═══════════════════════════════════════════\n');

  // ── 1. Update Support URL ─────────────────────────────────────────────────
  if (doMetadata) {
    // ── 1. Update Support URL on appStoreVersionLocalization ─────────────────
    console.log('1. Updating Support URL...');
    const locRes = await apiCall('PATCH', `/appStoreVersionLocalizations/${LOC_ID}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: LOC_ID,
        attributes: { supportUrl: SUPPORT_URL },
      },
    });
    if (locRes.status === 200) {
      console.log(`   ✓ supportUrl → ${SUPPORT_URL}`);
    } else {
      console.error(`   ✗ Support URL failed (${locRes.status}):`, JSON.stringify(locRes.body).substring(0, 300));
    }

    // ── 2. Update Review Notes via appStoreReviewDetails ─────────────────────
    console.log('\n2. Updating Review Notes...');
    // Try to fetch existing review detail first
    const detailGetRes = await apiCall('GET', `/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
    let detailId = detailGetRes.body.data?.id;

    const patchRes = await apiCall('PATCH', `/appStoreReviewDetails/${REVIEW_DETAIL_ID}`, {
      data: {
        type: 'appStoreReviewDetails',
        id: REVIEW_DETAIL_ID,
        attributes: { notes: REVIEW_NOTES },
      },
    });
    if (patchRes.status === 200) {
      console.log('   ✓ Review notes updated');
    } else {
      console.error(`   ✗ Notes failed (${patchRes.status}):`, JSON.stringify(patchRes.body).substring(0, 300));
    }
  }

  // ── 3. Find Build 15, assign, submit ─────────────────────────────────────
  if (doSubmit) {
    console.log('\n3. Finding Build 15...');
    const buildsRes = await apiCall('GET', `/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=15`);
    const builds = buildsRes.body.data || [];
    console.log('   Available builds:', builds.map(b => `${b.attributes.version} (${b.id.substring(0, 8)}...)`).join(', '));

    const build15 = builds.find(b => b.attributes.version === '15');
    if (!build15) {
      console.log('   ⚠ Build 15 not yet available. Run EAS build first:');
      console.log('     cd app && npx eas-cli build --platform ios --profile production');
      console.log('   Then re-run this script with --submit');
      if (doMetadata) {
        console.log('\n   Metadata updated successfully. Submit when build is ready.');
      }
      return;
    }

    console.log(`   ✓ Build 15 ID: ${build15.id}`);

    console.log('   Assigning Build 15 to version 1.0...');
    const assignRes = await apiCall('PATCH', `/appStoreVersions/${VERSION_ID}/relationships/build`, {
      data: { type: 'builds', id: build15.id },
    });
    console.log(`   ${assignRes.status === 204 || assignRes.status === 200 ? '✓ Assigned' : '✗ Failed (' + assignRes.status + ')'}`);

    console.log('\n4. Submitting for review...');
    const subRes = await apiCall('GET', `/reviewSubmissions/${SUBMISSION_ID}`);
    const subState = subRes.body.data?.attributes?.state;
    console.log(`   Submission state: ${subState}`);

    // Resolve any unresolved items first
    const itemsRes = await apiCall('GET', `/reviewSubmissions/${SUBMISSION_ID}/items`);
    for (const item of itemsRes.body.data || []) {
      if (item.attributes?.state === 'REJECTED') {
        console.log(`   Resolving item ${item.id}...`);
        await apiCall('PATCH', `/reviewSubmissionItems/${item.id}`, {
          data: { type: 'reviewSubmissionItems', id: item.id, attributes: { resolved: true } },
        });
      }
    }

    const resubRes = await apiCall('PATCH', `/reviewSubmissions/${SUBMISSION_ID}`, {
      data: { type: 'reviewSubmissions', id: SUBMISSION_ID, attributes: { submitted: true } },
    });

    if (resubRes.status === 200) {
      console.log('\n   ✅ SUBMITTED FOR REVIEW!');
      console.log('   Submission ID:', SUBMISSION_ID);
    } else {
      console.error(`   ✗ Submit failed (${resubRes.status}):`, JSON.stringify(resubRes.body).substring(0, 500));
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Done.');
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error(e); process.exit(1); });
