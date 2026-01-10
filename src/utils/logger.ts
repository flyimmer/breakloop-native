/**
 * Logger Utility
 * 
 * Adds timestamps to all console logs for better debugging.
 * Format: [HH:MM:SS.mmm] original message
 */

/**
 * Format timestamp as [HH:MM:SS.mmm]
 */
function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `[${hours}:${minutes}:${seconds}.${milliseconds}]`;
}

/**
 * Wrap console method to add timestamp prefix
 */
function wrapConsoleMethod(
  originalMethod: (...args: any[]) => void,
  methodName: 'log' | 'error' | 'warn' | 'info' | 'debug'
): (...args: any[]) => void {
  return (...args: any[]) => {
    const timestamp = formatTimestamp();
    
    // If first argument is a string that already starts with a bracket pattern [Component],
    // insert timestamp before it (e.g., "[System Brain]" becomes "[HH:MM:SS.mmm] [System Brain]")
    if (args.length > 0 && typeof args[0] === 'string' && args[0].match(/^\[[^\]]+\]/)) {
      // Insert timestamp before the component label
      args[0] = `${timestamp} ${args[0]}`;
    } else {
      // Prepend timestamp as first argument (preserves objects, numbers, etc. as-is)
      args.unshift(timestamp);
    }
    
    originalMethod.apply(console, args);
  };
}

/**
 * Initialize logger by wrapping console methods
 * 
 * This should be called once at app startup to enable timestamped logging.
 */
export function initializeLogger(): void {
  // Store original methods
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalInfo = console.info?.bind(console) || console.log.bind(console);
  const originalDebug = console.debug?.bind(console) || console.log.bind(console);
  
  // Wrap methods to add timestamps
  console.log = wrapConsoleMethod(originalLog, 'log');
  console.error = wrapConsoleMethod(originalError, 'error');
  console.warn = wrapConsoleMethod(originalWarn, 'warn');
  console.info = wrapConsoleMethod(originalInfo, 'info');
  console.debug = wrapConsoleMethod(originalDebug, 'debug');
  
  // Log initialization message (using original log to avoid recursion)
  originalLog(`${formatTimestamp()} [Logger] Timestamped logging enabled`);
}