import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const ALL_SECTION_AND_POPUP_ROUTES = [
  'book-a-call',
  'book-a-call/popup-1',
  'book-a-call/popup-2',
  'book-a-call/popup-3',
  'book-a-call/popup-4',
  'my-bookings',
  'my-bookings/popup-1',
  'track-booking',
  'help-center',
  'about-us',
  'about-us/popup-1',
  'contact-us',
  'pay',
  'pay/popup-1',
  'referral',
  'referral/popup-1',
  'menu',
  'admin',
  'admin/popup-1',
  'admin/popup-2',
  'promo',
  'shortcuts',
  'tech-store',
  'my-apps',
  'my-links',
  'ask-ai',
];

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

  // 2. Prepare static pages for every section & popup
  // This guarantees direct URL access & refresh works without 404 on GitHub Pages
  for (const route of ALL_SECTION_AND_POPUP_ROUTES) {
    const distRouteDir = path.join(distDir, route);
    const rootRouteDir = path.join(rootDir, route);
    fs.mkdirSync(distRouteDir, { recursive: true });
    fs.mkdirSync(rootRouteDir, { recursive: true });

    fs.writeFileSync(path.join(distRouteDir, 'index.html'), indexHtmlContent);
    fs.writeFileSync(path.join(rootRouteDir, 'index.html'), indexHtmlContent);

    // If top-level route (no slashes), also create .html file for clean URL servers
    if (!route.includes('/')) {
      fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtmlContent);
      fs.writeFileSync(path.join(rootDir, `${route}.html`), indexHtmlContent);
    }
  }

  // 3. Create intelligent SPA 404 handler for deep links and query param preservation
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

        // Normalize repository prefix (/1-1)
        var cleanPath = pathname;
        if (cleanPath.indexOf('/1-1') === 0) {
          cleanPath = cleanPath.slice(4);
        }
        cleanPath = cleanPath.replace(/^\\/+/, '');

        // Redirect back to repo root preserving route via query param 'route'
        var delim = search ? '&' : '?';
        var redirectUrl = '/1-1/' + search + (cleanPath ? delim + 'route=' + encodeURIComponent(cleanPath) : '') + hash;
        window.location.replace(redirectUrl);
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

  // 4. Ensure assets directory is synced to root and dist subdirectories
  const distAssetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    const rootAssetsDir = path.join(rootDir, 'assets');
    fs.mkdirSync(rootAssetsDir, { recursive: true });
    copyRecursiveSync(distAssetsDir, rootAssetsDir);
  }

  // 5. Copy social preview images if present in dist to root
  const previewImages = ['whatsapp-preview.jpg', 'whatsapp-preview.png', 'og-image-1200x630.jpg', 'og-image.png'];
  for (const img of previewImages) {
    const srcDist = path.join(distDir, img);
    if (fs.existsSync(srcDist)) {
      fs.copyFileSync(srcDist, path.join(rootDir, img));
    }
  }

  console.log('GitHub Pages post-build preparation completed successfully:');
  console.log(`- Generated static routes for ${ALL_SECTION_AND_POPUP_ROUTES.length} sections and popups`);
  console.log('- dist/404.html & 404.html updated');
  console.log('- .nojekyll generated');
  console.log('- assets mirrored for all deployment targets');
}

runPostBuild().catch((err) => {
  console.error('Post-build error:', err);
  process.exit(1);
});
