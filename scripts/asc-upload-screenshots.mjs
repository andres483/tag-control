/**
 * asc-upload-screenshots.mjs
 * Replaces all screenshots in ASC for iPhone 6.5" + iPad Pro 12.9" + iPad Pro 11"
 *
 * Usage:
 *   node scripts/asc-upload-screenshots.mjs              # upload all + submit
 *   node scripts/asc-upload-screenshots.mjs --upload     # upload only (no submit)
 *   node scripts/asc-upload-screenshots.mjs --submit     # submit only (skip upload)
 *   node scripts/asc-upload-screenshots.mjs --check      # check submission state only
 */

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KEY_ID    = 'S43MJL4WRM';
const ISSUER_ID = 'd0326120-d44e-4d10-b9bd-ee9a00b9737a';
const APP_ID    = '6762680012';
const VERSION_ID    = '94706861-cd1b-41ea-b502-b42d04bbe877';
const LOC_ID        = '4b3204be-a31f-42ce-bcfb-9d89dfb213c5';
const SUBMISSION_ID = '14ac2994-dc83-4fa9-a67a-c3a6a4474fcc';
const P8_PATH = '/Users/panthervillagran/blooming-website/proposals/clients/tagcontrol/AuthKey_S43MJL4WRM.p8';
const SCREENSHOTS_BASE = path.join(__dirname, '../app/store/apple/screenshot/es-MX');

// Set IDs (discovered via API)
const SETS = {
  APP_IPHONE_65:          '55087679-ba5d-4a81-9e18-da42add0bb4b',
  APP_IPAD_PRO_3GEN_129:  '0bf755df-99e4-4452-a89e-61f1fa44020d',
  APP_IPAD_PRO_3GEN_11:   '768f9226-bbe7-4ca2-97fd-39c57ee7a15f',
};

const FILES = ['01_login.png', '02_home.png', '03_history.png', '04_settings.png'];

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

function uploadFile(uploadUrl, fileBuffer, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Length': fileBuffer.length,
      },
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

async function replaceScreenshotsInSet(setId, displayType, dirName) {
  console.log(`\n  📱 ${displayType}`);

  // 1. Delete existing screenshots
  const existingRes = await apiCall('GET', `/appScreenshotSets/${setId}/appScreenshots`);
  const existing = existingRes.body.data || [];
  console.log(`     Deleting ${existing.length} existing screenshots...`);
  for (const ss of existing) {
    const delRes = await apiCall('DELETE', `/appScreenshots/${ss.id}`);
    if (delRes.status !== 204) {
      console.error(`     ✗ Failed to delete ${ss.id}: ${delRes.status}`);
      if (delRes.status === 409) {
        console.error(`     → Submission still active? Cannot modify screenshots in WAITING_FOR_REVIEW`);
        console.error(`     → Go to ASC UI → Remove from Review first`);
        return false;
      }
    }
  }
  console.log(`     ✓ Deleted`);

  // 2. Upload new screenshots
  const dirPath = path.join(SCREENSHOTS_BASE, dirName);
  for (let i = 0; i < FILES.length; i++) {
    const fileName = FILES[i];
    const filePath = path.join(dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`     ✗ Missing file: ${filePath}`);
      continue;
    }
    const fileBuffer = fs.readFileSync(filePath);
    const md5 = crypto.createHash('md5').update(fileBuffer).digest('base64');

    // Reserve slot
    const reserveRes = await apiCall('POST', '/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize: fileBuffer.length },
        relationships: {
          appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } },
        },
      },
    });

    if (reserveRes.status !== 201) {
      console.error(`     ✗ Reserve failed for ${fileName}: ${reserveRes.status}`, JSON.stringify(reserveRes.body).substring(0, 200));
      continue;
    }

    const screenshotId = reserveRes.body.data.id;
    const ops = reserveRes.body.data.attributes.uploadOperations || [];

    // Upload to S3
    for (const op of ops) {
      const reqHeaders = {};
      for (const h of (op.requestHeaders || [])) reqHeaders[h.name] = h.value;
      const upRes = await uploadFile(op.url, fileBuffer, reqHeaders);
      if (upRes.status >= 300) {
        console.error(`     ✗ S3 upload failed: ${upRes.status}`);
      }
    }

    // Commit
    const commitRes = await apiCall('PATCH', `/appScreenshots/${screenshotId}`, {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: { uploaded: true, sourceFileChecksum: md5 },
      },
    });

    const state = commitRes.body.data?.attributes?.assetStatePublishState || commitRes.body.data?.attributes?.uploadState || commitRes.status;
    console.log(`     ✓ ${fileName} → ${screenshotId.substring(0, 8)}... (${state})`);
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyUpload  = args.includes('--upload');
  const onlySubmit  = args.includes('--submit');
  const onlyCheck   = args.includes('--check');
  const doUpload    = !onlySubmit && !onlyCheck;
  const doSubmit    = !onlyUpload && !onlyCheck;

  console.log('═══════════════════════════════════════════');
  console.log('  TAGcontrol — ASC Screenshot Upload');
  console.log('═══════════════════════════════════════════\n');

  // Always check state first
  const subRes = await apiCall('GET', `/reviewSubmissions/${SUBMISSION_ID}`);
  const subState = subRes.body.data?.attributes?.state;
  console.log(`Submission state: ${subState}`);

  if (onlyCheck) {
    const vRes = await apiCall('GET', `/appStoreVersions/${VERSION_ID}?fields[appStoreVersions]=appStoreState`);
    console.log(`Version state:    ${vRes.body.data?.attributes?.appStoreState}`);
    // Check metadata
    const locRes = await apiCall('GET', `/appStoreVersionLocalizations/${LOC_ID}`);
    const a = locRes.body.data?.attributes || {};
    console.log(`Support URL:      ${a.supportUrl}`);
    console.log(`Marketing URL:    ${a.marketingUrl}`);
    const vFullRes = await apiCall('GET', `/appStoreVersions/${VERSION_ID}?fields[appStoreVersions]=usesIdfa`);
    console.log(`usesIdfa:         ${vFullRes.body.data?.attributes?.usesIdfa}`);
    return;
  }

  if (subState === 'WAITING_FOR_REVIEW' && doUpload) {
    console.error('\n❌ Cannot upload screenshots — submission is still WAITING_FOR_REVIEW');
    console.error('   → Go to App Store Connect: https://appstoreconnect.apple.com');
    console.error('   → My Apps → TAGcontrol → iOS App → 1.0 → Remove from Review');
    console.error('   → Then re-run this script');
    process.exit(1);
  }

  if (doUpload) {
    console.log('\n📸 Uploading screenshots...');
    const uploads = [
      ['APP_IPHONE_65',         'APP_IPHONE_65'],
      ['APP_IPAD_PRO_3GEN_129', 'APP_IPAD_PRO_3GEN_129'],
      ['APP_IPAD_PRO_3GEN_11',  'APP_IPAD_PRO_3GEN_11'],
    ];
    for (const [key, dirName] of uploads) {
      const ok = await replaceScreenshotsInSet(SETS[key], key, dirName);
      if (!ok) {
        console.error('\n❌ Upload aborted — fix submission state first');
        process.exit(1);
      }
    }
    console.log('\n✅ All screenshots uploaded');
  }

  if (doSubmit) {
    console.log('\n🚀 Submitting for review...');

    // Resolve any rejected items
    const itemsRes = await apiCall('GET', `/reviewSubmissions/${SUBMISSION_ID}/items`);
    for (const item of (itemsRes.body.data || [])) {
      if (item.attributes?.state === 'REJECTED') {
        console.log(`   Resolving rejected item ${item.id.substring(0, 8)}...`);
        await apiCall('PATCH', `/reviewSubmissionItems/${item.id}`, {
          data: { type: 'reviewSubmissionItems', id: item.id, attributes: { resolved: true } },
        });
      }
    }

    const resubRes = await apiCall('PATCH', `/reviewSubmissions/${SUBMISSION_ID}`, {
      data: { type: 'reviewSubmissions', id: SUBMISSION_ID, attributes: { submitted: true } },
    });

    if (resubRes.status === 200) {
      const newState = resubRes.body.data?.attributes?.state;
      console.log(`\n   ✅ SUBMITTED FOR REVIEW! State: ${newState}`);
      console.log(`   Submission ID: ${SUBMISSION_ID}`);
    } else {
      console.error(`   ✗ Submit failed (${resubRes.status}):`, JSON.stringify(resubRes.body).substring(0, 500));
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Done.');
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error(e); process.exit(1); });
