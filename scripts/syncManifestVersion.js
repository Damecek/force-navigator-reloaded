const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
);
const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.version = pkg.version;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
