const fs = require('fs');
const path = require('path');

const providersDir = './providers';
const manifestFile = './manifest.json';

let manifest = {};
try {
    const data = fs.readFileSync(manifestFile, 'utf8');
    manifest = JSON.parse(data);
} catch (err) {
    console.error("Impossible de lire manifest.json:", err);
    process.exit(1);
}

const files = fs.readdirSync(providersDir).filter(file => file.endsWith('.js'));

let changesMade = false;

files.forEach(file => {
    const filename = `providers/${file}`;
    const id = file.replace('.js', '');
    const name = id
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const exists = manifest.scrapers.some(scraper => scraper.filename === filename);

    if (!exists) {
        console.log(`Menambahkan scraper baru: ${file}`);

        const newEntry = {
            id: id,
            name: name,
            description: `Auto-generated description for ${name}`,
            version: "1.0.0",
            author: "Madrador60",
            supportedTypes: ["movie", "tv"],
            filename: filename,
            enabled: true,
            formats: ["mp4", "m3u8"],
            logo: "https://via.placeholder.com/150",
            contentLanguage: ["fr"]
        };

        manifest.scrapers.push(newEntry);
        changesMade = true;
    }
});

if (changesMade) {
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log("manifest.json a ete mis a jour.");
} else {
    console.log("Aucun nouveau provider a ajouter.");
}
