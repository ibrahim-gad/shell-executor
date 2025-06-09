#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx shell-executor "shell script" [args...]');
    console.error('Example: npx shell-executor "echo Hello $1 $2" world user');
    process.exit(1);
  }

  const shellScript = args[0];
  const scriptArgs = args.slice(1);

  if (!shellScript || typeof shellScript !== 'string') {
    console.error('Error: First argument must be a shell script string');
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

      console.log(stdout);
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
  main();
}

module.exports = { main }; 