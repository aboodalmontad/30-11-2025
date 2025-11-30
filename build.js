const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

const publicDir = 'public';

async function build() {
    try {
        console.log('Starting build for Vercel...');

        // 1. Clean and create public directory
        await fs.emptyDir(publicDir);

        // 2. Build and bundle TypeScript/TSX files
        await esbuild.build({
            entryPoints: ['index.tsx'],
            bundle: true,
            outfile: path.join(publicDir, 'index.js'),
            jsx: 'automatic',
            format: 'esm', // Output as an ES Module
            sourcemap: true,
            minify: true,
            target: 'es2020',
            // All packages from importmap are external to keep bundle size small
            external: [
                'react',
                'react-dom',
                'react-dom/client',
                '@supabase/supabase-js',
                '@google/genai',
                'recharts',
                'idb',
                'react-router-dom',
                'react/*', // To handle react/jsx-runtime and other react sub-modules
                'docx-preview',
                'pdfjs-dist',
                'pdfjs-dist/build/pdf.worker.mjs',
            ],
        });

        // 3. Copy static assets to public directory
        const staticAssets = ['index.html', 'manifest.json', 'icon.svg', 'sw.js'];
        await Promise.all(
            staticAssets.map(asset => {
                if (fs.existsSync(asset)) {
                    return fs.copy(asset, path.join(publicDir, asset));
                }
                console.warn(`Asset not found and will not be copied: ${asset}`);
                return Promise.resolve();
            })
        );
        
        console.log('Build finished successfully!');

    } catch (e) {
        console.error('Build process failed:', e);
        process.exit(1);
    }
}

build();