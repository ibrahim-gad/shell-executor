#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const https = require('https');
const http = require('http');

function downloadScript(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download script: HTTP ${response.statusCode}`));
        return;
      }
      
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
      });
      
    }).on('error', (error) => {
      reject(new Error(`Failed to download script: ${error.message}`));
    });
  });
}

function isUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx shell-executor <script|url> [args...]');
    console.error('');
    console.error('Options:');
    console.error('  <script>  Shell script as a string');
    console.error('  <url>     URL to download bash script from');
    console.error('');
    console.error('Examples:');
    console.error('  npx shell-executor "echo Hello $1 $2" world user');
    console.error('  npx shell-executor https://example.com/script.sh arg1 arg2');
    process.exit(1);
  }

  const scriptOrUrl = args[0];
  const scriptArgs = args.slice(1);

  if (!scriptOrUrl || typeof scriptOrUrl !== 'string') {
    console.error('Error: First argument must be a shell script string or URL');
    process.exit(1);
  }

  let shellScript;
  
  try {
    if (isUrl(scriptOrUrl)) {
      console.log(`Downloading script from: ${scriptOrUrl}`);
      shellScript = await downloadScript(scriptOrUrl);
    } else {
      shellScript = scriptOrUrl;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // Create temporary script file
  const tempDir = os.tmpdir();
  const scriptPath = path.join(tempDir, `shell-executor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sh`);

  try {
    // Write shell script to temporary file
    fs.writeFileSync(scriptPath, shellScript, { mode: 0o755 });

    // Build command with arguments
    const command = `bash "${scriptPath}" ${scriptArgs.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`;

    // Execute the script
    exec(command, (error, stdout, stderr) => {
      // Clean up temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up temporary file: ${scriptPath}`);
      }

      if (error) {
        console.error(stderr);
        process.exit(error.code || 1);
      }

      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.error(stderr);
      }
    });

  } catch (err) {
    console.error(`Error: ${err.message}`);
    
    // Attempt to clean up if file was created
    try {
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Handle process termination to clean up temp files
process.on('SIGINT', () => {
  console.log('\nInterrupted. Exiting...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };