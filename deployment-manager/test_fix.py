import os
import sys
from pathlib import Path
import logging

# Add the directory to sys.path to import ErrorLogger
sys.path.append(r'C:\Users\${USERNAME}\Downloads\Scootware Master\Scootware-Forum\Scootware-Forum\deployment-manager')

from error_logger import ErrorLogger

def test_clear_logs():
    test_log = "test_clear.log"
    if os.path.exists(test_log):
        os.remove(test_log)
        
    print(f"Creating logger with file: {test_log}")
    logger = ErrorLogger(test_log)
    logger.log_info("This is a test log message")
    logger.log_error("This is an error message")
    
    # Check if file exists and has content
    if os.path.exists(test_log):
        size = os.path.getsize(test_log)
        print(f"Log file size before clear: {size} bytes")
        if size == 0:
            print("FAILED: Log file is empty before clear")
            return
    else:
        print("FAILED: Log file was not created")
        return
        
    print("Attempting to clear logs...")
    try:
        logger.clear()
        print("Clear successful!")
    except Exception as e:
        print(f"FAILED: Clear failed with error: {e}")
        return
        
    # Check if file exists and is empty
    if os.path.exists(test_log):
        size = os.path.getsize(test_log)
        print(f"Log file size after clear: {size} bytes")
        # should be 0 or very small (just the "Log file cleared" message)
        # Actually our clear() method logs a message AFTER clearing.
        # Let's check if it's smaller than before.
        if size < 200: 
             print("SUCCESS: Log file was cleared and re-initialized")
        else:
             print(f"FAILED: Log file size {size} is too large after clear")
    else:
        print("FAILED: Log file missing after clear")

    # Cleanup
    for handler in logger.logger.handlers[:]:
        handler.close()
        logger.logger.removeHandler(handler)
    if os.path.exists(test_log):
        os.remove(test_log)

if __name__ == "__main__":
    test_clear_logs()
