const { readFile, writeFile } = require("node:fs/promises");

async function updateVersionFile(version) {
  if (!version || !version.trim()) {
    console.error("ERROR: VERSION env var is required");
    process.exit(1);
  }

  const path = 'release.json';

  const raw = await readFile(path, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: ${path} is not valid JSON`);
    process.exit(1);
  }

  json.version = version.trim();

  await writeFile(path, JSON.stringify(json, null, 2) + "\n", "utf8");

  console.log(`Updated ${path} version -> ${json.version}`)
}

async function main() {
  updateVersionFile(version);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

