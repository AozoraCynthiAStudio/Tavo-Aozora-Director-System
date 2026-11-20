'use strict';

const fs = require('node:fs');
const path = require('node:path');

const baseUrl = (process.env.AOZORA_IMAGE_BASE_URL || 'https://api.790053500.com/v1').replace(/\/+$/, '');
const apiKey = process.env.AOZORA_IMAGE_API_KEY;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const [, , manifestPath, outputDir, model = 'gpt-image-2.5-sunburst'] = process.argv;
  if (!manifestPath || !outputDir) {
    return fail('Usage: node scripts/oneoff-image-client.cjs <jobs.json> <output-dir> [model]');
  }
  if (!apiKey) return fail('Set AOZORA_IMAGE_API_KEY in the local environment first.');

  const jobs = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(jobs) || jobs.length === 0) return fail('Job manifest must be a non-empty JSON array.');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const job of jobs) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(job.name || '') || !job.prompt) {
      throw new Error('Each job needs a simple filename in name and a prompt.');
    }
    const request = {
      model,
      prompt: job.prompt,
      size: job.size || '1536x1024',
      quality: job.quality || 'high',
      output_format: 'png',
      ...(job.background ? { background: job.background } : {})
    };
    const headers = { Authorization: `Bearer ${apiKey}` };
    let endpoint = 'generations';
    let body;
    if (job.reference) {
      endpoint = 'edits';
      const referencePath = path.resolve(path.dirname(manifestPath), job.reference);
      const form = new FormData();
      for (const [key, value] of Object.entries(request)) form.append(key, String(value));
      form.append('image', new Blob([fs.readFileSync(referencePath)], { type: 'image/png' }), path.basename(referencePath));
      body = form;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request);
    }
    const response = await fetch(`${baseUrl}/images/${endpoint}`, { method: 'POST', headers, body });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200);
      throw new Error(`${job.name}: HTTP ${response.status}: ${detail}`);
    }

    const payload = await response.json();
    const image = payload.data?.[0];
    let bytes;
    if (image?.b64_json) {
      bytes = Buffer.from(image.b64_json, 'base64');
    } else if (image?.url) {
      const download = await fetch(image.url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!download.ok) throw new Error(`${job.name}: image download returned HTTP ${download.status}`);
      bytes = Buffer.from(await download.arrayBuffer());
    } else {
      throw new Error(`${job.name}: response did not include data[0].b64_json or data[0].url`);
    }

    if (bytes.length < 8 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(`${job.name}: response is not a PNG`);
    }
    const target = path.join(outputDir, `${job.name}.png`);
    fs.writeFileSync(target, bytes, { flag: 'wx' });
    console.log(`${job.name}: saved ${bytes.length} bytes`);
  }
}

main().catch(error => fail(error.message));
