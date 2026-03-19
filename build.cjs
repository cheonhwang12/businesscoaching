const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(__dirname, 'dist');
const OUTPUT_DIR = path.join(__dirname, '.vercel', 'output');
const STATIC_DIR = path.join(OUTPUT_DIR, 'static');

// dist 폴더 생성
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 루트의 HTML 파일들을 그대로 dist로 복사
const htmlFiles = ['index.html', 'about.html', 'process.html', 'fund.html', 'service.html', 'marketing.html', 'board.html', 'post.html', 'policy.html', 'privacy.html'];

htmlFiles.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`copied: ${file}`);
    }
});

console.log('\nbuild complete!');

// sitemap.xml, robots.txt 복사 (vercel.json은 제외)
['sitemap.xml', 'robots.txt'].forEach(file => {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(DIST_DIR, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`copied: ${file}`);
    }
});

// 이미지 파일들 (png, jpg, svg 등) 복사
const rootFiles = fs.readdirSync(ROOT_DIR);
rootFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico'].includes(ext)) {
        const src = path.join(ROOT_DIR, file);
        const dest = path.join(DIST_DIR, file);
        fs.copyFileSync(src, dest);
        console.log(`copied: ${file}`);
    }
});

// css, js, images, posts 폴더 복사
const filesToCopy = ['css', 'js', 'images', 'admin', 'posts'];
filesToCopy.forEach(folder => {
    const srcFolder = path.join(ROOT_DIR, folder);
    const destFolder = path.join(DIST_DIR, folder);

    if (fs.existsSync(srcFolder)) {
        copyFolderSync(srcFolder, destFolder);
        console.log(`copied folder: ${folder}/`);
    }
});

// --- Build Output API ---
// .vercel/output/static/ 에 dist 내용 복사
console.log('\nBuild Output API setup...');
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(STATIC_DIR, { recursive: true });
copyFolderSync(DIST_DIR, STATIC_DIR);
console.log('copied dist -> .vercel/output/static/');

// .vercel/output/config.json 생성
const config = {
    version: 3,
    routes: [
        // 1. www -> apex domain redirect
        {
            src: "/(.*)",
            has: [{ type: "host", value: "www.bizcoaching.co.kr.co.kr" }],
            headers: { Location: "https://bizcoaching.co.kr.co.kr/$1" },
            status: 301
        },
        // 2. Admin subdomain: /admin -> / redirect
        {
            src: "^/admin$",
            has: [{ type: "host", value: "admin.bizcoaching.co.kr.co.kr" }],
            headers: { Location: "/" },
            status: 301
        },
        // 3. Admin subdomain: /admin/* -> /* redirect
        {
            src: "^/admin/(.*)",
            has: [{ type: "host", value: "admin.bizcoaching.co.kr.co.kr" }],
            headers: { Location: "/$1" },
            status: 301
        },
        // 4. Remove trailing slash (except root)
        {
            src: "(.+)/",
            headers: { Location: "$1" },
            status: 308
        },
        // 5. Redirect .html URLs to clean URLs
        {
            src: "/(.*)\\.html",
            headers: { Location: "/$1" },
            status: 301
        },
        // 6. Admin subdomain: root -> /admin/index.html
        {
            src: "^/$",
            has: [{ type: "host", value: "admin.bizcoaching.co.kr.co.kr" }],
            dest: "/admin/index.html"
        },
        // 7. Admin subdomain: sub-pages -> /admin/*.html
        {
            src: "/([^.]+)",
            has: [{ type: "host", value: "admin.bizcoaching.co.kr.co.kr" }],
            dest: "/admin/$1.html"
        },
        // 7. Filesystem check
        { handle: "filesystem" },
        // 6. Clean URLs: serve .html files without extension
        {
            src: "/(.*)",
            dest: "/$1.html",
            check: true
        },
        // 7. posts -> marketing-news redirect
        {
            src: "/posts/(.*)",
            headers: { Location: "/marketing-news/$1" },
            status: 301
        },
        // 8. marketing-news -> posts rewrite
        {
            src: "/marketing-news/(.*)",
            dest: "/posts/$1",
            check: true
        }
    ]
};

fs.writeFileSync(
    path.join(OUTPUT_DIR, 'config.json'),
    JSON.stringify(config, null, 2)
);
console.log('generated .vercel/output/config.json');

console.log('\nproduction ready!');

function copyFolderSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);

        if (fs.statSync(srcPath).isDirectory()) {
            copyFolderSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}
