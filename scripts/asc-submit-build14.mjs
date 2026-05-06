/**
 * asc-submit-build14.mjs
 * Full submission pipeline for Build 14:
 * 1. Generate iPad screenshots from iPhone originals
 * 2. Create iPad screenshot sets in ASC
 * 3. Upload iPad screenshots
 * 4. Replace login screenshot (now has 2 fields, not 3)
 * 5. Swap build to 14
 * 6. Submit for review
 */

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KEY_ID = 'S43MJL4WRM';
const ISSUER_ID = 'd0326120-d44e-4d10-b9bd-ee9a00b9737a';
const APP_ID = '6762680012';
const VERSION_ID = '94706861-cd1b-41ea-b502-b42d04bbe877';
const LOC_ID = '4b3204be-a31f-42ce-bcfb-9d89dfb213c5';
const IPHONE_SET_ID = '55087679-ba5d-4a81-9e18-da42add0bb4b';
const P8_PATH = '/Users/panthervillagran/blooming-website/proposals/clients/tagcontrol/AuthKey_S43MJL4WRM.p8';

const SCREENSHOTS_DIR = path.join(__dirname, '../app/store/apple/screenshot/es-MX/APP_IPHONE_65');
const TMP_DIR = os.tmpdir();

const privateKey = fs.readFileSync(P8_PATH, 'utf8');

// iPad screenshot types needed + their dimensions (portrait)
const IPAD_CONFIGS = [
  { type: 'APP_IPAD_PRO_3GEN_129', width: 2048, height: 2732, label: 'iPad Pro 12.9"' },
  { type: 'APP_IPAD_PRO_3GEN_11',  width: 1668, height: 2388, label: 'iPad Pro 11"'  },
];

const IPHONE_SCREENS = ['01_login.png', '02_home.png', '03_history.png', '04_settings.png'];

// ── ASC API ──────────────────────────────────────────────────────────────────

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

// Upload binary file to a pre-signed URL (can be http or https)
function uploadFile(uploadUrl, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(filePath);
    const parsed = new URL(uploadUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
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

// ── PNG helpers ───────────────────────────────────────────────────────────────

function generateIPadScreenshot(iPhoneFile, outputFile, iPadWidth, iPadHeight) {
  // Scale iPhone screenshot to fill iPad height, then center horizontally
  // iPhone 6.5" = 1242x2688. iPad Pro 12.9" = 2048x2732, iPad Pro 11" = 1668x2388.
  // Strategy: scale the iPhone screenshot proportionally to fit the iPad height,
  // then pad horizontally with white.

  const tmpScaled = path.join(TMP_DIR, `scaled_${Date.now()}.png`);

  // Scale to iPad height (keeping aspect ratio)
  execSync(`sips -z ${iPadHeight} ${Math.round(1242 * iPadHeight / 2688)} "${iPhoneFile}" --out "${tmpScaled}" 2>/dev/null`);

  // Get actual scaled width
  const info = execSync(`sips -g pixelWidth "${tmpScaled}" 2>/dev/null`).toString();
  const scaledWidth = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0');

  if (scaledWidth >= iPadWidth) {
    // If content is wider than iPad width, just crop to iPad width
    execSync(`sips -c ${iPadHeight} ${iPadWidth} "${tmpScaled}" --out "${outputFile}" 2>/dev/null`);
  } else {
    // Pad horizontally with white to reach iPad width
    // sips doesn't support padding, so we use a two-step approach:
    // 1. Create white canvas at iPad dimensions
    // 2. Composite the scaled image centered

    // Use sips to create white base: sips can't create from scratch,
    // so we copy an existing PNG and resize + recolor it
    const whiteBase = path.join(TMP_DIR, `white_${Date.now()}.png`);

    // Create white canvas by copying and resizing the scaled image to iPad dims
    // then clearing it — not possible with sips alone.
    // Alternative: use python (available on macOS) to composite
    const xOffset = Math.round((iPadWidth - scaledWidth) / 2);

    const pythonScript = `
import struct, zlib

def make_png(w, h, color=(255,255,255)):
    sig = bytes([137,80,78,71,13,10,26,10])
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        crc = zlib.crc32(name + data) & 0xffffffff
        return c + struct.pack('>I', crc)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    row = bytes([0]) + bytes(color) * w
    raw = row * h
    idat = zlib.compress(raw, 9)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

with open('${whiteBase}', 'wb') as f:
    f.write(make_png(${iPadWidth}, ${iPadHeight}))
`;
    execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}" 2>/dev/null`);

    // Composite scaled image onto white base using sips... but sips can't composite.
    // Use python again to do the composite.
    const compositeScript = `
import struct, zlib, sys

def read_png_pixels(path):
    with open(path, 'rb') as f:
        data = f.read()
    # Find IHDR
    pos = 8
    chunks = {}
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]
        ctype = data[pos+4:pos+8]
        cdata = data[pos+8:pos+8+length]
        chunks[ctype] = chunks.get(ctype, b'') + cdata
        pos += 12 + length
    w, h = struct.unpack('>II', chunks[b'IHDR'][:8])
    bit_depth = chunks[b'IHDR'][8]
    color_type = chunks[b'IHDR'][9]
    raw = zlib.decompress(chunks[b'IDAT'])
    return w, h, raw, color_type

def write_png(path, w, h, pixels_rgb):
    sig = bytes([137,80,78,71,13,10,26,10])
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    rows = []
    bpp = 3
    for y in range(h):
        rows.append(bytes([0]) + pixels_rgb[y*w*bpp:(y+1)*w*bpp])
    raw = b''.join(rows)
    idat = zlib.compress(raw, 6)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))

# White canvas
canvas = bytearray([255] * (${iPadWidth} * ${iPadHeight} * 3))

# Read scaled iPhone screenshot
sw, sh, raw, ctype = read_png_pixels('${tmpScaled}')
bpp = 4 if ctype == 6 else 3
ox = ${xOffset}
for y in range(min(sh, ${iPadHeight})):
    for x in range(min(sw, ${iPadWidth} - ox)):
        src = (y * (sw + 1) * bpp + bpp + x * bpp) if True else 0
        # raw has filter bytes
        row_start = y * (sw * bpp + 1) + 1
        r = raw[row_start + x*bpp]
        g = raw[row_start + x*bpp + 1]
        b_val = raw[row_start + x*bpp + 2]
        dst = ((y) * ${iPadWidth} + (ox + x)) * 3
        canvas[dst] = r
        canvas[dst+1] = g
        canvas[dst+2] = b_val

write_png('${outputFile}', ${iPadWidth}, ${iPadHeight}, bytes(canvas))
`;
    fs.writeFileSync(path.join(TMP_DIR, 'composite.py'), compositeScript);
    execSync(`python3 "${path.join(TMP_DIR, 'composite.py')}" 2>/dev/null`);
  }

  // Cleanup
  try { fs.unlinkSync(tmpScaled); } catch {}
  return outputFile;
}

// ── Simplified iPad screenshot: use sips to scale + pad ─────────────────────

function generateIPadSimple(iPhoneFile, outputFile, iPadWidth, iPadHeight) {
  // Scale iPhone to iPad height first
  const tmpScaled = path.join(TMP_DIR, `scaled_${Date.now()}_${path.basename(iPhoneFile)}`);
  const scaledW = Math.round(1242 * iPadHeight / 2688);

  execSync(`sips -z ${iPadHeight} ${scaledW} "${iPhoneFile}" --out "${tmpScaled}" 2>/dev/null`);

  // Python composite onto white canvas
  const script = `
import struct, zlib

def read_png(path):
    with open(path,'rb') as f: d=f.read()
    pos=8; chunks={}
    while pos<len(d):
        l=struct.unpack('>I',d[pos:pos+4])[0]; t=d[pos+4:pos+8]
        chunks[t]=chunks.get(t,b'')+d[pos+8:pos+8+l]; pos+=12+l
    w,h=struct.unpack('>II',chunks[b'IHDR'][:8])
    ct=chunks[b'IHDR'][9]; raw=zlib.decompress(chunks[b'IDAT'])
    return w,h,raw,ct

def write_png(path,w,h,pix):
    sig=bytes([137,80,78,71,13,10,26,10])
    def chunk(n,d):
        c=struct.pack('>I',len(d))+n+d
        return c+struct.pack('>I',zlib.crc32(n+d)&0xffffffff)
    ihdr=struct.pack('>IIBBBBB',w,h,8,2,0,0,0)
    rows=b''.join(bytes([0])+pix[y*w*3:(y+1)*w*3] for y in range(h))
    with open(path,'wb') as f:
        f.write(sig+chunk(b'IHDR',ihdr)+chunk(b'IDAT',zlib.compress(rows,6))+chunk(b'IEND',b''))

IW,IH=${iPadWidth},${iPadHeight}
canvas=bytearray([255]*(IW*IH*3))
sw,sh,raw,ct=read_png('${tmpScaled}')
bpp=4 if ct==6 else 3
ox=(IW-sw)//2
for y in range(min(sh,IH)):
    rs=y*(sw*bpp+1)+1
    for x in range(min(sw,IW-ox)):
        r=raw[rs+x*bpp]; g=raw[rs+x*bpp+1]; b=raw[rs+x*bpp+2]
        di=((y)*IW+(ox+x))*3
        canvas[di]=r; canvas[di+1]=g; canvas[di+2]=b
write_png('${outputFile}',IW,IH,bytes(canvas))
print('OK: ${outputFile}')
`;
  fs.writeFileSync(path.join(TMP_DIR, 'ipad_gen.py'), script);
  execSync(`python3 "${path.join(TMP_DIR, 'ipad_gen.py')}"`, { stdio: 'inherit' });
  try { fs.unlinkSync(tmpScaled); } catch {}
}

// ── Upload screenshot to ASC ──────────────────────────────────────────────────

async function uploadScreenshot(setId, filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  // 1. Reserve upload slot
  const res = await apiCall('POST', '/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });

  if (res.status !== 201) {
    console.error(`   Reserve failed (${res.status}):`, JSON.stringify(res.body).substring(0, 300));
    return null;
  }

  const screenshotId = res.body.data.id;
  const uploadOps = res.body.data.attributes?.uploadOperations || [];

  // 2. Upload each part
  for (const op of uploadOps) {
    const chunk = fileBuffer.slice(op.offset, op.offset + op.length);
    const tmpChunk = path.join(TMP_DIR, `chunk_${screenshotId}_${op.offset}`);
    fs.writeFileSync(tmpChunk, chunk);
    await uploadFile(op.url, tmpChunk, 'image/png');
    fs.unlinkSync(tmpChunk);
  }

  // 3. Commit
  const commitRes = await apiCall('PATCH', `/appScreenshots/${screenshotId}`, {
    data: {
      type: 'appScreenshots',
      id: screenshotId,
      attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(fileBuffer).digest('hex') },
    },
  });

  if (commitRes.status !== 200) {
    console.error(`   Commit failed (${commitRes.status}):`, JSON.stringify(commitRes.body).substring(0, 300));
    return null;
  }

  return screenshotId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  TAGcontrol Build 14 — Full Submission');
  console.log('═══════════════════════════════════════════\n');

  // ── STEP 1: Delete existing login screenshot and re-upload updated one ──
  console.log('1. Checking existing iPhone screenshots...');
  const setInfo = await apiCall('GET', `/appScreenshotSets/${IPHONE_SET_ID}/appScreenshots`);
  const existing = setInfo.body.data || [];
  console.log(`   Found ${existing.length} screenshots`);

  const loginScreenshot = existing.find(s => s.attributes?.fileName === '01_login.png');
  if (loginScreenshot) {
    console.log('   Deleting old login screenshot (had 3 fields, now has 2)...');
    const del = await apiCall('DELETE', `/appScreenshots/${loginScreenshot.id}`);
    console.log(`   Deleted: ${del.status === 204 ? '✓' : 'failed (' + del.status + ')'}`);

    console.log('   Uploading new login screenshot...');
    const loginPath = path.join(SCREENSHOTS_DIR, '01_login.png');
    const loginId = await uploadScreenshot(IPHONE_SET_ID, loginPath, '01_login.png');
    console.log(`   ${loginId ? '✓ Uploaded' : '✗ Failed'}`);
  } else {
    console.log('   Login screenshot not found in ASC — skipping replacement');
  }

  // ── STEP 2: Generate and upload iPad screenshots ──
  console.log('\n2. Generating iPad screenshots...');

  for (const config of IPAD_CONFIGS) {
    console.log(`\n   [${config.label}] ${config.width}×${config.height}`);

    // Generate iPad screenshots from iPhone originals
    const iPadFiles = [];
    for (const screen of IPHONE_SCREENS) {
      const iPhonePath = path.join(SCREENSHOTS_DIR, screen);
      if (!fs.existsSync(iPhonePath)) { console.log(`   ⚠ Missing: ${screen}`); continue; }
      const outPath = path.join(TMP_DIR, `ipad_${config.type}_${screen}`);
      process.stdout.write(`   Generating ${screen}...`);
      generateIPadSimple(iPhonePath, outPath, config.width, config.height);
      console.log(' ✓');
      iPadFiles.push({ name: screen, path: outPath });
    }

    // Create screenshot set for this iPad type
    console.log(`   Creating screenshot set in ASC...`);
    const setRes = await apiCall('POST', '/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: config.type },
        relationships: {
          appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: LOC_ID } },
        },
      },
    });

    if (setRes.status !== 201) {
      // Might already exist
      if (setRes.body?.errors?.[0]?.code === 'ENTITY_EXISTS') {
        console.log('   Set already exists, finding it...');
        const allSets = await apiCall('GET', `/appStoreVersionLocalizations/${LOC_ID}/appScreenshotSets`);
        const found = allSets.body.data?.find(s => s.attributes?.screenshotDisplayType === config.type);
        if (!found) { console.log('   ✗ Could not find existing set'); continue; }
        setRes.body = { data: found };
        setRes.status = 201;
      } else {
        console.error(`   ✗ Create set failed (${setRes.status}):`, JSON.stringify(setRes.body).substring(0, 200));
        continue;
      }
    }

    const iPadSetId = setRes.body.data.id;
    console.log(`   Set ID: ${iPadSetId}`);

    // Upload each screenshot
    for (const { name, path: filePath } of iPadFiles) {
      process.stdout.write(`   Uploading ${name}...`);
      const id = await uploadScreenshot(iPadSetId, filePath, name);
      console.log(id ? ' ✓' : ' ✗ failed');
    }

    // Cleanup temp files
    for (const { path: p } of iPadFiles) { try { fs.unlinkSync(p); } catch {} }
  }

  // ── STEP 3: Swap build to 14 ──
  console.log('\n3. Finding Build 14 in EAS processed builds...');
  const buildsRes = await apiCall('GET', `/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=10`);
  const builds = buildsRes.body.data || [];
  console.log('   Available builds:', builds.map(b => `${b.attributes.version} (${b.id.substring(0,8)}...)`));

  const build14 = builds.find(b => b.attributes.version === '14');
  if (!build14) {
    console.error('   ✗ Build 14 not found in processed builds. May still be processing — wait a few minutes and retry.');
    process.exit(1);
  }
  console.log(`   ✓ Build 14 ID: ${build14.id}`);

  console.log('   Assigning Build 14 to version 1.0...');
  const assignRes = await apiCall('PATCH', `/appStoreVersions/${VERSION_ID}/relationships/build`, {
    data: { type: 'builds', id: build14.id },
  });
  console.log(`   ${assignRes.status === 204 || assignRes.status === 200 ? '✓ Build assigned' : '✗ Failed (' + assignRes.status + ')'}`);
  if (assignRes.status !== 204 && assignRes.status !== 200) {
    console.error(JSON.stringify(assignRes.body).substring(0, 300));
  }

  // ── STEP 4: Create fresh review submission ──
  console.log('\n4. Creating review submission...');

  // Try to reuse existing submission first
  const OLD_SUB = '41ba5a13-94fe-4fcb-92cb-2871c9c4282f';
  const oldSub = await apiCall('GET', `/reviewSubmissions/${OLD_SUB}`);
  const oldState = oldSub.body.data?.attributes?.state;
  console.log(`   Existing submission state: ${oldState}`);

  let subId;

  if (oldState === 'UNRESOLVED_ISSUES' || oldState === 'REJECTED') {
    // Patch to resubmit
    const resubRes = await apiCall('PATCH', `/reviewSubmissions/${OLD_SUB}`, {
      data: { type: 'reviewSubmissions', id: OLD_SUB, attributes: { submitted: true } },
    });
    if (resubRes.status === 200) {
      console.log('   ✓ Resubmitted via existing submission!');
      subId = OLD_SUB;
    } else {
      console.log(`   Resubmit failed (${resubRes.status}), creating fresh submission...`);
    }
  }

  if (!subId) {
    // Delete old items and create fresh submission
    const itemsRes = await apiCall('GET', `/reviewSubmissions/${OLD_SUB}/items`);
    for (const item of itemsRes.body.data || []) {
      await apiCall('DELETE', `/reviewSubmissionItems/${item.id}`);
    }

    const freshRes = await apiCall('POST', '/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    });

    if (freshRes.status !== 201) {
      console.error(`   ✗ Create submission failed (${freshRes.status}):`, JSON.stringify(freshRes.body).substring(0, 300));
      process.exit(1);
    }
    subId = freshRes.body.data.id;
    console.log(`   New submission: ${subId}`);

    const addRes = await apiCall('POST', '/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
        },
      },
    });
    if (addRes.status !== 201) {
      console.error(`   ✗ Add version failed (${addRes.status}):`, JSON.stringify(addRes.body).substring(0, 300));
      process.exit(1);
    }
    console.log('   ✓ Version added to submission');

    const submitRes = await apiCall('PATCH', `/reviewSubmissions/${subId}`, {
      data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } },
    });

    if (submitRes.status === 200) {
      console.log('\n   ✅ APP SUBMITTED FOR REVIEW!');
      console.log('   Submission ID:', subId);
    } else {
      console.error(`\n   ✗ Submit failed (${submitRes.status}):`, JSON.stringify(submitRes.body).substring(0, 500));
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Done. Check App Store Connect for status.');
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error(e); process.exit(1); });
