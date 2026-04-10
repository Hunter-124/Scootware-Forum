/**
 * Simple PE Header Parser to extract SizeOfImage
 * Used for automatic allocationSize calculation on product upload.
 */
export function getPESizeOfImage(buffer: Buffer): number | null {
  try {
    // 1. Check MZ signature
    if (buffer.readUInt16LE(0) !== 0x5a4d) {
      return null;
    }

    // 2. Get NT header offset
    const ntHeaderOffset = buffer.readUInt32LE(0x3c);
    
    // 3. Check PE signature
    if (buffer.readUInt32LE(ntHeaderOffset) !== 0x00004550) {
      return null;
    }

    /**
     * Optional Header starts at ntHeaderOffset + 24 bytes 
     * (4 bytes signature + 20 bytes COFF File Header)
     * 
     * SizeOfImage is at offset 56 into the Optional Header for both PE32 and PE32+.
     * Total offset: ntHeaderOffset + 24 + 56 = ntHeaderOffset + 80
     */
    const sizeOfImageOffset = ntHeaderOffset + 80;
    
    if (buffer.length < sizeOfImageOffset + 4) {
      return null;
    }

    const sizeOfImage = buffer.readUInt32LE(sizeOfImageOffset);
    return sizeOfImage;
  } catch (err) {
    console.error("PE Parsing error:", err);
    return null;
  }
}
