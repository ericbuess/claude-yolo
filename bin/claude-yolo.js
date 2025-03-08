#!/usr/bin/env node


import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

// ANSI color codes
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Debug logging function that only logs if DEBUG env var is set
const debug = (message) => {
  if (process.env.DEBUG) {
    console.log(message);
  }
};

// Function to ask for user consent
function askForConsent() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(`\n${BOLD}${YELLOW}🔥 CLAUDE-YOLO INSTALLATION CONSENT REQUIRED 🔥${RESET}\n`);
    console.log(`${CYAN}----------------------------------------${RESET}`);
    console.log(`${BOLD}What is claude-yolo?${RESET}`);
    console.log(`This package creates a wrapper around the official Claude CLI tool that:`);
    console.log(`  1. ${RED}BYPASSES safety checks${RESET} by automatically adding the --dangerously-skip-permissions flag`);
    console.log(`  2. Automatically updates to the latest Claude CLI version`);
    console.log(`  3. Adds colorful YOLO-themed loading messages\n`);

    console.log(`${BOLD}${RED}⚠️ IMPORTANT SECURITY WARNING ⚠️${RESET}`);
    console.log(`The ${BOLD}--dangerously-skip-permissions${RESET} flag was designed for use in containers`);
    console.log(`and bypasses important safety checks. This includes ignoring file access`);
    console.log(`permissions that protect your system and privacy.\n`);

    console.log(`${BOLD}By using claude-yolo:${RESET}`);
    console.log(`  • You acknowledge these safety checks are being bypassed`);
    console.log(`  • You understand this may allow Claude CLI to access sensitive files`);
    console.log(`  • You accept full responsibility for any security implications\n`);

    console.log(`${CYAN}----------------------------------------${RESET}\n`);

    rl.question(`${YELLOW}Do you consent to using claude-yolo with these modifications? (yes/no): ${RESET}`, (answer) => {
      rl.close();
      const lowerAnswer = answer.toLowerCase().trim();
      if (lowerAnswer === 'yes' || lowerAnswer === 'y') {
        console.log(`\n${YELLOW}🔥 YOLO MODE APPROVED 🔥${RESET}`);
        resolve(true);
      } else {
        console.log(`\n${CYAN}Aborted. YOLO mode not activated.${RESET}`);
        console.log(`If you want the official Claude CLI with normal safety features, run:`);
        console.log(`claude`);
        resolve(false);
      }
    });
  });
}

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Find node_modules directory by walking up from current file
let nodeModulesDir = path.resolve(__dirname, '..');
while (!fs.existsSync(path.join(nodeModulesDir, 'node_modules')) && nodeModulesDir !== '/') {
  nodeModulesDir = path.resolve(nodeModulesDir, '..');
}

// Path to check package info
const packageJsonPath = path.join(nodeModulesDir, 'package.json');

// Check for updates to Claude package
async function checkForUpdates() {
  try {
    debug("Checking for Claude package updates...");
    
    // Get the latest version available on npm
    const latestVersionCmd = "npm view @anthropic-ai/claude-code version";
    const latestVersion = execSync(latestVersionCmd).toString().trim();
    debug(`Latest Claude version on npm: ${latestVersion}`);
    
    // Get the global Claude version if available
    let globalVersion;
    if (globalClaudeDir) {
      try {
        const globalPackageJsonPath = path.join(globalClaudeDir, 'package.json');
        if (fs.existsSync(globalPackageJsonPath)) {
          const globalPackageJson = JSON.parse(fs.readFileSync(globalPackageJsonPath, 'utf8'));
          globalVersion = globalPackageJson.version;
          debug(`Global Claude version: ${globalVersion}`);
          
          // If using global version and it's already the latest, we're good
          if (globalVersion === latestVersion) {
            debug('Global Claude installation is already the latest version');
            return;
          }
        }
      } catch (error) {
        debug(`Error reading global Claude package.json: ${error.message}`);
      }
    }
    
    // Get our current installed version from local package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const currentVersion = dependencies['@anthropic-ai/claude-code'];
    
    debug(`Current dependency in package.json: ${currentVersion}`);
    
    // If using a specific version (not "latest"), and it's out of date, update
    if (currentVersion !== "latest" && currentVersion !== latestVersion) {
      console.log(`Updating Claude package from ${currentVersion || 'unknown'} to ${latestVersion}...`);
      
      // Update package.json
      packageJson.dependencies['@anthropic-ai/claude-code'] = latestVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      
      // Run npm install
      console.log("Running npm install to update dependencies...");
      execSync("npm install", { stdio: 'inherit', cwd: nodeModulesDir });
      console.log("Update complete!");
    } else if (currentVersion === "latest") {
      // If using "latest", just make sure we have the latest version installed
      debug("Using 'latest' tag in package.json, running npm install to ensure we have the newest version");
      execSync("npm install", { stdio: 'inherit', cwd: nodeModulesDir });
    }
  } catch (error) {
    console.error("Error checking for updates:", error.message);
    debug(error.stack);
  }
}

// Look for globally installed Claude CLI first, then fall back to local
let globalClaudeDir, localClaudeDir, originalCliPath, yoloCliPath, consentFlagPath;

// Try to find global installation using 'which claude' or 'npm -g root'
try {
  // Find global node_modules
  const globalNodeModules = execSync('npm -g root').toString().trim();
  debug(`Global node_modules: ${globalNodeModules}`);
  
  // Check if Claude is installed globally
  const potentialGlobalDir = path.join(globalNodeModules, '@anthropic-ai', 'claude-code');
  if (fs.existsSync(potentialGlobalDir)) {
    globalClaudeDir = potentialGlobalDir;
    debug(`Found global Claude installation at: ${globalClaudeDir}`);
  }
} catch (error) {
  debug(`Error finding global Claude installation: ${error.message}`);
}

// Set up local fallback paths
localClaudeDir = path.join(nodeModulesDir, 'node_modules', '@anthropic-ai', 'claude-code');

// Use global if available, otherwise use local
const claudeDir = globalClaudeDir || localClaudeDir;
debug(`Using Claude installation from: ${claudeDir}`);

// Set up CLI paths - check for both cli.mjs and cli.js
let mjs = path.join(claudeDir, 'cli.mjs');
let js = path.join(claudeDir, 'cli.js');

// Determine which file exists
if (fs.existsSync(js)) {
  originalCliPath = js;
  yoloCliPath = path.join(claudeDir, 'cli-yolo.js');
  debug(`Found Claude CLI at ${originalCliPath} (js version)`);
} else if (fs.existsSync(mjs)) {
  originalCliPath = mjs;
  yoloCliPath = path.join(claudeDir, 'cli-yolo.mjs');
  debug(`Found Claude CLI at ${originalCliPath} (mjs version)`);
} else {
  // Default to mjs if neither exists (will fail later with clear error)
  originalCliPath = mjs;
  yoloCliPath = path.join(claudeDir, 'cli-yolo.mjs');
  debug(`Could not find Claude CLI file, defaulting to ${originalCliPath}`);
}

consentFlagPath = path.join(claudeDir, '.claude-yolo-consent');

// Main function to run the application
async function run() {
  // Display which Claude installation we're using
  console.log(`${CYAN}Using Claude installation from: ${claudeDir}${RESET}`);
  
  // If in DEBUG mode, show more detailed information
  if (process.env.DEBUG) {
    try {
      // Get the package.json from the Claude directory
      const claudePackageJsonPath = path.join(claudeDir, 'package.json');
      if (fs.existsSync(claudePackageJsonPath)) {
        const claudePackageJson = JSON.parse(fs.readFileSync(claudePackageJsonPath, 'utf8'));
        console.log(`${CYAN}Claude version from package.json: ${claudePackageJson.version}${RESET}`);
      }
    } catch (error) {
      debug(`Error reading Claude package.json: ${error.message}`);
    }
  }
  
  // Check and update Claude package first
  await checkForUpdates();

  if (!fs.existsSync(originalCliPath)) {
    console.error(`Error: ${originalCliPath} not found. Make sure @anthropic-ai/claude-code is installed.`);
    process.exit(1);
  }

  // Check if consent is needed
  const consentNeeded = !fs.existsSync(yoloCliPath) || !fs.existsSync(consentFlagPath);
  
  // If consent is needed and not already given, ask for it
  if (consentNeeded) {
    const consent = await askForConsent();
    if (!consent) {
      // User didn't consent, exit
      process.exit(1);
    }
    
    // Create a flag file to remember that consent was given
    try {
      fs.writeFileSync(consentFlagPath, 'consent-given');
      debug("Created consent flag file");
    } catch (err) {
      debug(`Error creating consent flag file: ${err.message}`);
      // Continue anyway
    }
  }

  // Read the original CLI file content
  let cliContent = fs.readFileSync(originalCliPath, 'utf8');

  // Replace all instances of "punycode" with "punycode/"
  cliContent = cliContent.replace(/"punycode"/g, '"punycode/"');
  debug('Replaced all instances of "punycode" with "punycode/"');

  // Replace getIsDocker() calls with true
  cliContent = cliContent.replace(/[a-zA-Z0-9_]*\.getIsDocker\(\)/g, 'true');
  debug("Replaced all instances of *.getIsDocker() with true");

  // Replace hasInternetAccess() calls with false
  cliContent = cliContent.replace(/[a-zA-Z0-9_]*\.hasInternetAccess\(\)/g, 'false');
  debug("Replaced all instances of *.hasInternetAccess() with false");

  // Add warning message
  console.log(`${YELLOW}🔥 YOLO MODE ACTIVATED 🔥${RESET}`);

  // Replace the loading messages array with YOLO versions
  const originalArray = '["Accomplishing","Actioning","Actualizing","Baking","Brewing","Calculating","Cerebrating","Churning","Clauding","Coalescing","Cogitating","Computing","Conjuring","Considering","Cooking","Crafting","Creating","Crunching","Deliberating","Determining","Doing","Effecting","Finagling","Forging","Forming","Generating","Hatching","Herding","Honking","Hustling","Ideating","Inferring","Manifesting","Marinating","Moseying","Mulling","Mustering","Musing","Noodling","Percolating","Pondering","Processing","Puttering","Reticulating","Ruminating","Schlepping","Shucking","Simmering","Smooshing","Spinning","Stewing","Synthesizing","Thinking","Transmuting","Vibing","Working"]';
  const yoloSuffixes = [
    ` ${RED}(safety's off, hold on tight)${RESET}`,
    ` ${YELLOW}(all gas, no brakes, lfg)${RESET}`,
    ` ${BOLD}\x1b[35m(yolo mode engaged)${RESET}`,
    ` ${CYAN}(dangerous mode! I guess you can just do things)${RESET}`
  ];

  // Function to add a random YOLO suffix to each word in the array
  const addYoloSuffixes = (arrayStr) => {
    try {
      const array = JSON.parse(arrayStr);
      const yoloArray = array.map(word => {
        const randomSuffix = yoloSuffixes[Math.floor(Math.random() * yoloSuffixes.length)];
        return word + randomSuffix;
      });
      return JSON.stringify(yoloArray);
    } catch (e) {
      debug(`Error modifying loading messages array: ${e.message}`);
      return arrayStr;
    }
  };

  cliContent = cliContent.replace(originalArray, addYoloSuffixes(originalArray));
  debug("Replaced loading messages with YOLO versions");

  // Write the modified content to a new file, leaving the original untouched
  fs.writeFileSync(yoloCliPath, cliContent);
  debug(`Created modified CLI at ${yoloCliPath}`);
  debug("Modifications complete. The --dangerously-skip-permissions flag should now work everywhere.");

  // Add the --dangerously-skip-permissions flag to the command line arguments
  // This will ensure it's passed to the CLI even if the user didn't specify it
  process.argv.splice(2, 0, '--dangerously-skip-permissions');
  debug("Added --dangerously-skip-permissions flag to command line arguments");

  // Now import the modified CLI - handling both .js and .mjs files
  try {
    await import(yoloCliPath);
  } catch (error) {
    console.error(`Error importing Claude CLI: ${error.message}`);
    debug(error.stack);
    process.exit(1);
  }
}

// Run the main function
run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});