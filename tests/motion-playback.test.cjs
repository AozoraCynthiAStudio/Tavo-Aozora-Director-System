'use strict';

const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = ['stage.css', 'viewer.css'].map(name => fs.readFileSync(require('node:path').join(__dirname, '../src/ui', name), 'utf8')).join('\n');
const controller = fs.readFileSync(require('node:path').join(__dirname, '../src/ui/controller.js'), 'utf8');
test('motion preview uses a 2-second A/B loop with 0.65-second fades', () => {
  assert.match(css, /animation:adirector-motion-pair var\(--ad-motion-duration,2s\) ease-in-out infinite/);
  assert.match(css, /@keyframes adirector-motion-pair\{0%,17\.5%\{opacity:0\}50%,67\.5%\{opacity:1\}100%\{opacity:0\}\}/);
  assert.doesNotMatch(controller, /motionBadge|addock-motion-badge|3秒循环/);
  assert.match(controller, /生成一个目标定格并与原图交替播放/);
  assert.match(controller, /motionPlaying&&hasMotion\?item\.motion\.sourcePointer:''/);
  assert.match(controller, /viewerMotionPlaying&&hasMotion\?item\.motion\.sourcePointer:''/);
  assert.match(controller, /app\.animate\(/);
  assert.match(controller, /addock-fullview-motion-play/);
  assert.match(css, /#addock-fullview #addock-fullview-motion-image/);
  assert.match(css, /#adirector-cg-dock #addock-motion-play/);
});

