import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function runPostBuild() {
  console.log('Running GitHub Pages routing & static asset preparation...');

  if (!fs.existsSync(distDir)) {
    console.error('dist directory does not exist! Run vite build first.');
    process.exit(1);
  }

  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('dist/index.html not found!');
    process.exit(1);
  }

  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');

  // 1. Create .nojekyll in both dist and root
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(rootDir, '.nojekyll'), '');

  // 2. Prepare Pay section static pages
  // This guarantees https://funzytech.github.io/1-1/pay serves HTTP 200 without 404
  const distPayDir = path.join(distDir, 'pay');
  const rootPayDir = path.join(rootDir, 'pay');
  fs.mkdirSync(distPayDir, { recursive: true });
  fs.mkdirSync(rootPayDir, { recursive: true });

  fs.writeFileSync(path.join(distPayDir, 'index.html'), indexHtmlContent);
  fs.writeFileSync(path.join(distDir, 'pay.html'), indexHtmlContent);
  fs.writeFileSync(path.join(rootPayDir, 'index.html'), indexHtmlContent);
  fs.writeFileSync(path.join(rootDir, 'pay.html'), indexHtmlContent);

  // 3. Create SPA 404 handler for deep links and query param preservation
  const spa404Content = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Funzy Tech | Book a Call</title>
    <meta name="description" content="Your One-to-One Tech Consultation Starts Here." />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (function() {
        var pathname = window.location.pathname || '';
        var search = window.location.search || '';
        var hash = window.location.hash || '';

        // If user navigated to /pay or /1-1/pay
        if (pathname.toLowerCase().indexOf('pay') !== -1) {
          var delim = search ? '&' : '?';
          var redirectPay = '/1-1/' + search + (search.indexOf('route=pay') === -1 ? delim + 'route=pay' : '') + hash;
          window.location.replace(redirectPay);
          return;
        }

        // If user accessed /1-1 without trailing slash
        if (pathname === '/1-1') {
          window.location.replace('/1-1/' + search + hash);
          return;
        }

        // Universal SPA redirection back to repo base preserving query parameters
        window.location.replace('/1-1/' + search + hash);
      })();
    </script>
    <meta http-equiv="refresh" content="0; url=/1-1/">
  </head>
  <body style="background-color: #d9c4a2; margin: 0; padding: 0;">
    <div id="root"></div>
  </body>
</html>`;

  fs.writeFileSync(path.join(distDir, '404.html'), spa404Content);
  fs.writeFileSync(path.join(rootDir, '404.html'), spa404Content);

  // 4. Ensure assets directory is synced to root and subdirectories
  const distAssetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    const rootAssetsDir = path.join(rootDir, 'assets');
    fs.mkdirSync(rootAssetsDir, { recursive: true });
    copyRecursiveSync(distAssetsDir, rootAssetsDir);

    // Also mirror to pay/assets in case relative resolution without base is used
    const distPayAssetsDir = path.join(distPayDir, 'assets');
    copyRecursiveSync(distAssetsDir, distPayAssetsDir);

    const rootPayAssetsDir = path.join(rootPayDir, 'assets');
    copyRecursiveSync(distAssetsDir, rootPayAssetsDir);
  }

  // 5. Copy social preview images if present in public or dist
  const previewImages = ['whatsapp-preview.jpg', 'whatsapp-preview.png', 'og-image-1200x630.jpg', 'og-image.png'];
  for (const img of previewImages) {
    const srcDist = path.join(distDir, img);
    if (fs.existsSync(srcDist)) {
      fs.copyFileSync(srcDist, path.join(rootDir, img));
      fs.copyFileSync(srcDist, path.join(distPayDir, img));
    }
  }

  console.log('GitHub Pages post-build preparation completed successfully:');
  console.log('- dist/pay/index.html & pay/index.html created');
  console.log('- dist/404.html & 404.html created');
  console.log('- .nojekyll generated');
  console.log('- assets mirrored for all deployment targets');
}

runPostBuild().catch((err) => {
  console.error('Post-build error:', err);
  process.exit(1);
});
