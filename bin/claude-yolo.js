#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
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

// Function to display consent information
function displayConsentInfo() {
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
}

// Function to ask for user consent
function askForConsent() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    displayConsentInfo();

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
let projectDir = nodeModulesDir; // Store the project directory as fallback

while (!fs.existsSync(path.join(nodeModulesDir, 'node_modules')) && nodeModulesDir !== '/') {
  nodeModulesDir = path.resolve(nodeModulesDir, '..');
}

// Path to check package info - fallback to project directory if we reached root
const packageJsonPath = nodeModulesDir === '/' ? 
  path.join(projectDir, 'package.json') : 
  path.join(nodeModulesDir, 'package.json');

// Check for updates to Claude package
async function checkForUpdates() {
  try {
    debug("Checking for Claude package updates...");
    
    // Check if the package.json exists before trying to read it
    if (!fs.existsSync(packageJsonPath)) {
      debug(`Package.json not found at ${packageJsonPath}. Skipping update check.`);
      return;
    }

    // Get the latest version available on npm
    const latestVersionCmd = "npm view @anthropic-ai/claude-code version";
    const latestVersion = execSync(latestVersionCmd).toString().trim();
    debug(`Latest Claude version on npm: ${latestVersion}`);

    // Get our current installed version
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const currentVersion = dependencies['@anthropic-ai/claude-code'];

    debug(`Claude version from package.json: ${currentVersion}`);

    // Get the global Claude version if available
    let globalVersion;
    if (globalClaudeDir) {
      try {
        const globalPackageJsonPath = path.join(globalClaudeDir, 'package.json');
        if (fs.existsSync(globalPackageJsonPath)) {
          const globalPackageJson = JSON.parse(fs.readFileSync(globalPackageJsonPath, 'utf8'));
          globalVersion = globalPackageJson.version;
          debug(`Global Claude version: ${globalVersion}`);

          // If global version is latest, inform user
          if (globalVersion === latestVersion) {
            debug(`Global Claude installation is already the latest version`);
          } else if (globalVersion && latestVersion) {
            debug(`Global Claude installation (${globalVersion}) differs from latest (${latestVersion})`);
          }
        }
      } catch (err) {
        debug(`Error getting global Claude version: ${err.message}`);
      }
    }

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

// Try to find global installation of Claude CLI first
let globalClaudeDir;
try {
  const globalNodeModules = execSync('npm -g root').toString().trim();
  debug(`Global node_modules: ${globalNodeModules}`);
  const potentialGlobalDir = path.join(globalNodeModules, '@anthropic-ai', 'claude-code');

  if (fs.existsSync(potentialGlobalDir)) {
    globalClaudeDir = potentialGlobalDir;
    debug(`Found global Claude installation at: ${globalClaudeDir}`);
  }
} catch (error) {
  debug(`Error finding global Claude installation: ${error.message}`);
}

// Path to the local Claude CLI installation
const localClaudeDir = path.join(nodeModulesDir, 'node_modules', '@anthropic-ai', 'claude-code');

// Prioritize global installation, fall back to local
const claudeDir = globalClaudeDir || localClaudeDir;
debug(`Using Claude installation from: ${claudeDir}`);
debug(`Using ${claudeDir === globalClaudeDir ? 'GLOBAL' : 'LOCAL'} Claude installation`);

// Check for both .js and .mjs versions of the CLI
let mjs = path.join(claudeDir, 'cli.mjs');
let js = path.join(claudeDir, 'cli.js');
let originalCliPath;
let yoloCliPath;

if (fs.existsSync(js)) {
  originalCliPath = js;
  yoloCliPath = path.join(claudeDir, 'cli-yolo.js');
  debug(`Found Claude CLI at ${originalCliPath} (js version)`);
} else if (fs.existsSync(mjs)) {
  originalCliPath = mjs;
  yoloCliPath = path.join(claudeDir, 'cli-yolo.mjs');
  debug(`Found Claude CLI at ${originalCliPath} (mjs version)`);
} else {
  console.error(`Error: Claude CLI not found in ${claudeDir}. Make sure @anthropic-ai/claude-code is installed.`);
  process.exit(1);
}
const consentFlagPath = path.join(claudeDir, '.claude-yolo-consent');

// Parse command line arguments
const args = process.argv.slice(2);

// Check for .vibeautorun.md file in current directory
const autorunFilePath = path.join(process.cwd(), '.vibeautorun.md');
const shouldAutorun = fs.existsSync(autorunFilePath);

debug(`Checking for autorun file at: ${autorunFilePath} - exists: ${shouldAutorun}`);

// Main function to run the application
async function run() {
  debug("Starting claude-yolo script");
  // Check and update Claude package first
  await checkForUpdates();
  debug("Update check complete");

  debug("Checking if original CLI path exists");
  if (!fs.existsSync(originalCliPath)) {
    console.error(`Error: ${originalCliPath} not found. Make sure @anthropic-ai/claude-code is installed.`);
    debug(`Original CLI path ${originalCliPath} not found!`);
    process.exit(1);
  }
  debug(`Original CLI path found at ${originalCliPath}`);

  // Check if consent is needed
  debug(`Checking if consent is needed - yoloCliPath exists: ${fs.existsSync(yoloCliPath)}, consentFlagPath exists: ${fs.existsSync(consentFlagPath)}`);
  const consentNeeded = !fs.existsSync(yoloCliPath) || !fs.existsSync(consentFlagPath);
  debug(`Consent needed: ${consentNeeded}`);

  // If consent is needed and not already given, ask for it or auto-consent with --autorun
  if (consentNeeded) {
    if (shouldAutorun) {
      // Auto-accept for --autorun mode
      displayConsentInfo();

      console.log(`${YELLOW}Do you consent to using claude-yolo with these modifications? (yes/no): ${RESET}yes`);
      console.log(`\n${YELLOW}🔥 YOLO MODE APPROVED 🔥${RESET}`);

      // Store consent for future runs
      fs.writeFileSync(consentFlagPath, 'consent-given');
    } else {
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

    if (claudeDir === localClaudeDir) {
      cliContent = cliContent.replace(/"punycode"/g, '"punycode/"');
      debug('Replaced all instances of "punycode" with "punycode/"');
    }

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

    // If all is good, run the Claude CLI with YOLO mode enabled
    debug("Running Claude CLI with YOLO mode");
    debug(`YOLO CLI path: ${yoloCliPath}, exists: ${fs.existsSync(yoloCliPath)}`);

    // Different execution based on whether we have autorun
    if (shouldAutorun) {
      debug(`Executing in autorun mode with file at: ${autorunFilePath}`);

      // Read the autorun file contents
      const autorunContent = fs.readFileSync(autorunFilePath, 'utf8');
      debug(`Found autorun file with content length: ${autorunContent.length} chars`);

      // A simpler approach using a shell script and input redirection
      console.log(`${YELLOW}Running in autorun mode with instructions from .vibeautorun.md${RESET}`);

      // Initialize tempScriptPath in the outer scope so it's available in the finally block
      let tempScriptPath;

      try {
        // First, create a temporary shell script to handle the interaction
        tempScriptPath = path.join(os.tmpdir(), `claude-yolo-autorun-${Date.now()}.sh`);
        const scriptContent = `#!/bin/bash

# Automatically answer yes to any consent prompts
echo 'y' > /tmp/consent

# Write the command content to a temp file
cat > /tmp/command << 'EOL'
${autorunContent}
EOL

# Run Claude CLI with input first from consent file and then from command file
(cat /tmp/consent && sleep 3 && cat /tmp/command && echo && sleep 1 && echo) | node "${yoloCliPath}" --dangerously-skip-permissions ${args.join(' ')}

# Clean up
rm /tmp/consent /tmp/command
`;

        fs.writeFileSync(tempScriptPath, scriptContent);
        fs.chmodSync(tempScriptPath, '755'); // Make executable
        debug(`Created autorun script at: ${tempScriptPath}
${scriptContent}`);

        // Execute the script
        console.log(`${CYAN}Executing autorun script with commands from .vibeautorun.md${RESET}`);
        execSync(`bash "${tempScriptPath}"`, { stdio: 'inherit' });
        console.log(`${YELLOW}Autorun completed successfully${RESET}`);

      } catch (err) {
        console.error(`Error running autorun: ${err.message}`);
      } finally {
        // Clean up any temporary files
        try {
          if (tempScriptPath) {
            fs.unlinkSync(tempScriptPath);
            debug(`Removed temporary script file: ${tempScriptPath}`);
          }
        } catch (err) {
          debug(`Error removing temporary script file: ${err.message}`);
        }
      }
    } else {
      // Original behavior - just run Claude CLI with execSync
      const cmd = `node "${yoloCliPath}" --dangerously-skip-permissions ${args.join(' ')}`;
      debug(`Executing: ${cmd}`);
      try {
        debug("Starting Claude CLI execution");
        console.log(`${YELLOW}Executing Claude CLI...${RESET}`);
        execSync(cmd, { stdio: 'inherit' });
        debug("Claude CLI execution completed");
        console.log(`${YELLOW}Claude CLI execution complete${RESET}`);
      } catch (err) {
        console.error(`Error executing Claude CLI: ${err.message}`);
        debug(`Error stack: ${err.stack}`);
        process.exit(1);
      }
    }
  } else {
    // Consent already given, just run the Claude CLI
    debug("Consent already given, proceeding to run Claude CLI");
    
    // Add the --dangerously-skip-permissions flag to the command line arguments if not already there
    if (!args.includes('--dangerously-skip-permissions')) {
      debug("Adding --dangerously-skip-permissions flag");
      args.unshift('--dangerously-skip-permissions');
    } else {
      debug("--dangerously-skip-permissions flag already present");
    }
    
    // Handle autorun mode if needed
    if (shouldAutorun) {
      debug("Autorun mode detected, checking for .vibeautorun.md file");
      const autorunFilePath = path.join(process.cwd(), '.vibeautorun.md');
      debug(`Checking for autorun file at: ${autorunFilePath}`);
      
      if (!fs.existsSync(autorunFilePath)) {
        console.log(`${YELLOW}Warning: --autorun flag provided but .vibeautorun.md not found in current directory.${RESET}`);
        console.log(`Looking for file at: ${autorunFilePath}`);
        console.log(`Running Claude CLI without autorun input.${RESET}`);
        
        // Fall back to normal execution without autorun
        debug(`Running Claude CLI with args: ${args.join(' ')}`);
        const cmd = `node "${yoloCliPath}" ${args.join(' ')}`;
      } else {
        // Found autorun file, use it
        const autorunContent = fs.readFileSync(autorunFilePath, 'utf8');
        debug(`Found autorun file with content length: ${autorunContent.length} chars`);
        
        // Use a modified shell script with file monitoring for autorun
        console.log(`${YELLOW}Running in autorun mode with instructions from .vibeautorun.md${RESET}`);
        
        // Initialize tempScriptPath for the finally block
        let tempScriptPath;
        
        try {
          // Path to monitor for the done.txt signal file
          const doneFilePath = path.join(process.cwd(), 'done.txt');
          
          // Remove any existing done.txt file to avoid false positives
          if (fs.existsSync(doneFilePath)) {
            fs.unlinkSync(doneFilePath);
            debug(`Removed existing done.txt file`);
          }
          
          // Create a simpler file watcher shell script that sends /exit
          const watchScriptPath = path.join(os.tmpdir(), `claude-yolo-watch-${Date.now()}.sh`);
          const watchScriptContent = `#!/bin/bash

# Watch for done.txt and send /exit when it appears
echo "Watching for ${doneFilePath}"

while true; do
  if [ -f "${doneFilePath}" ]; then
    echo "Found done.txt, sending /exit command"
    rm "${doneFilePath}" 2>/dev/null
    # Send /exit to Claude
    echo "/exit" > /dev/tty
    # Give it time to exit
    sleep 1
    # Force kill this and all parent processes
    echo "FORCE KILLING ALL PROCESSES..."
    # The most aggressive approach possible for Mac
    pkill -15 -P $$
    pkill -15 -P $PPID
    pkill -15 Claude
    pkill -15 claude-yolo
    # If all else fails, hard kill
    pkill -9 -P $$
    pkill -9 -P $PPID
    pkill -9 Claude
    pkill -9 claude-yolo
    exit 0
  fi
  sleep 1
done
`;

          
          fs.writeFileSync(watchScriptPath, watchScriptContent);
          fs.chmodSync(watchScriptPath, '755'); // Make executable
          debug(`Created watch script at: ${watchScriptPath}`);
          
          // Create a shell script that runs Claude and starts the watcher
          tempScriptPath = path.join(os.tmpdir(), `claude-yolo-autorun-${Date.now()}.sh`);
          const scriptContent = `#!/bin/bash

# Automatically answer yes to any consent prompts
echo 'y' > /tmp/consent

# Write the command content to a temp file
cat > /tmp/command << 'EOL'
${autorunContent}
EOL

# Start the watcher in the same terminal
"${watchScriptPath}" & 
WATCHER_PID=$!

# Run Claude CLI with input
(cat /tmp/consent && sleep 3 && cat /tmp/command && echo) | node "${yoloCliPath}" ${args.join(' ')}

# Clean up
kill $WATCHER_PID 2>/dev/null
rm /tmp/consent /tmp/command
`;
          
          fs.writeFileSync(tempScriptPath, scriptContent);
          fs.chmodSync(tempScriptPath, '755'); // Make executable
          debug(`Created autorun script at: ${tempScriptPath}\n${scriptContent}`);
          
          // Execute the script
          console.log(`${CYAN}Executing autorun script with commands from .vibeautorun.md${RESET}`);
          execSync(`bash "${tempScriptPath}"`, { stdio: 'inherit' });
          console.log(`${YELLOW}Autorun completed successfully${RESET}`);
          
          // Clean up scripts
          try {
            fs.unlinkSync(watchScriptPath);
            debug(`Removed watch script: ${watchScriptPath}`);
          } catch (err) {
            debug(`Error removing watch script: ${err.message}`);
          }
          
          // Force exit the process
          process.exit(0);
          
          return; // Exit after autorun completes
          
        } catch (err) {
          console.error(`Error running autorun: ${err.message}`);
          debug(`Error stack: ${err.stack}`);
        } finally {
          // Clean up temporary files
          try {
            if (tempScriptPath) {
              fs.unlinkSync(tempScriptPath);
              debug(`Removed temporary script file: ${tempScriptPath}`);
            }
          } catch (err) {
            debug(`Error removing temporary script file: ${err.message}`);
          }
        }
      }
    }
    
    // Normal execution without autorun
    debug(`Running Claude CLI with args: ${args.join(' ')}`);
    const cmd = `node "${yoloCliPath}" ${args.join(' ')}`;

    debug(`Executing: ${cmd}`);
    try {
      debug("Starting Claude CLI execution");
      console.log(`${YELLOW}🔥 YOLO MODE ACTIVATED 🔥${RESET}`);
      console.log(`${YELLOW}Executing Claude CLI...${RESET}`);
      execSync(cmd, { stdio: 'inherit' });
      debug("Claude CLI execution completed");
    } catch (err) {
      console.error(`Error executing Claude CLI: ${err.message}`);
      debug(`Error stack: ${err.stack}`);
      process.exit(1);
    }
  }
}

// Run the main function
run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});