/**
 * BioDesign Metadata Library - Java Implementation
 * 
 * This class provides functionality for managing metadata associated with biological designs.
 * It includes operations for calculating checksums, tracking differences between versions,
 * and handling encryption of sensitive data.
 * 
 * Key Features:
 * - Checksum calculation for sequence verification
 * - Difference tracking between versions
 * - Cryptographic operations (encryption/decryption)
 */

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedList;
import lombok.Data;
import java.util.List;

/**
 * Represents the metadata associated with a biological design.
 * Uses Lombok's @Data annotation to automatically generate getters, setters,
 * equals, hashCode, and toString methods.
 */
@Data
public class BioDesignMetadata {
    /** Unique identifier for the design */
    private String id;
    /** ID of the parent design if derived */
    private String parentMetadataId;
    /** Name of the design */
    private String designName;
    /** SHA-256 hash of the design sequence */
    private String designChecksum;
    /** Creator of the design */
    private String author;
    /** Description of the design */
    private String description;
    /** Timestamp of last modification */
    private String lastUpdated;
    /** History of operations performed */
    private List<BioDesignOperation> changelog;

    /**
     * Get the encryption key from environment variables.
     * 
     * @return The encryption key as a string
     * @throws IllegalStateException if ENCRYPTION_KEY is not set
     */
    private static String getEncryptionKey() {
        String key = System.getenv("ENCRYPTION_KEY");
        if (key == null || key.isEmpty()) {
            throw new IllegalStateException("ENCRYPTION_KEY environment variable is not set");
        }
        return key;
    }

    /**
     * Compute the difference between two strings.
     * 
     * @param originalString Original version
     * @param newString New version
     * @return Text representation of the differences
     * 
     * @note Uses diff_match_patch algorithm for difference computation
     */
    public static String computeDifference(String originalString, String newString) {
        // Create an instance of diff_match_patch
        diff_match_patch dmp = new diff_match_patch();

        // Generate patches comparing the newString and the originalString
        LinkedList<diff_match_patch.Patch> patches = dmp.patch_make(newString, originalString);

        // Convert patches to text format
        return dmp.patch_toText(patches);
    }

    /**
     * Calculate SHA-256 checksum of a string.
     * 
     * @param input String to calculate checksum for
     * @return Hexadecimal representation of the SHA-256 hash
     * @throws Exception if hashing fails
     * 
     * @note Input is converted to lowercase before hashing
     */
    public static String calculateChecksum(String input) throws Exception {
        // Make it case-insensitive
        input = input.toLowerCase();

        // Create a SHA-256 hash function
        MessageDigest digest = MessageDigest.getInstance("SHA-256");

        // Update the hash with the input string's bytes
        byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));

        // Convert the hash's bytes to hexadecimal format
        StringBuilder hexString = new StringBuilder(2 * hashBytes.length);
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }

        // Return the SHA-256 checksum as a hex string
        return hexString.toString();
    }

    /**
     * Decrypt an encrypted string using AES-CBC.
     * 
     * @param encryptedBase64String Base64-encoded encrypted string
     * @return Decrypted string
     * @throws Exception if decryption fails or key is invalid
     * 
     * @note Uses AES-CBC with PKCS5Padding
     * @note Requires ENCRYPTION_KEY environment variable
     */
    public static String decryptString(String encryptedBase64String) throws Exception {
        // Get encryption key from environment variable
        String encryptionKey = getEncryptionKey();
        // Convert the encryption key to bytes (assuming it's 32 characters long, 32 bytes)
        byte[] key = encryptionKey.getBytes(StandardCharsets.UTF_8);

        // Decode the base64 string
        byte[] encryptedDataWithIv = Base64.getDecoder().decode(encryptedBase64String);

        // Extract the first 16 bytes for the IV
        byte[] iv = new byte[16];
        System.arraycopy(encryptedDataWithIv, 0, iv, 0, iv.length);

        // Extract the rest of the bytes for the encrypted message
        byte[] encryptedData = new byte[encryptedDataWithIv.length - iv.length];
        System.arraycopy(encryptedDataWithIv, iv.length, encryptedData, 0, encryptedData.length);

        // Initialize the cipher for decryption
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec secretKeySpec = new SecretKeySpec(key, "AES");
        IvParameterSpec ivParameterSpec = new IvParameterSpec(iv);
        cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, ivParameterSpec);

        // Decrypt the data
        byte[] originalData = cipher.doFinal(encryptedData);

        // Return the decrypted string
        return new String(originalData, StandardCharsets.UTF_8);
    }

    /**
     * Encrypt a string using AES-CBC.
     * 
     * @param plainText String to encrypt
     * @return Base64-encoded encrypted string
     * @throws Exception if encryption fails or key is invalid
     * 
     * @note Uses AES-CBC with PKCS5Padding
     * @note Requires ENCRYPTION_KEY environment variable
     */
    public static String encryptString(String plainText) throws Exception {
        // Get encryption key from environment variable
        String encryptionKey = getEncryptionKey();
        // Convert the encryption key to bytes (assuming it's 32 characters long, 32 bytes)
        byte[] key = encryptionKey.getBytes(StandardCharsets.UTF_8);

        // Generate a random 16-byte IV
        byte[] iv = new byte[16];
        SecureRandom random = new SecureRandom();
        random.nextBytes(iv);

        // Initialize the cipher for encryption
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec secretKeySpec = new SecretKeySpec(key, "AES");
        IvParameterSpec ivParameterSpec = new IvParameterSpec(iv);
        cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, ivParameterSpec);

        // Encrypt the plain text
        byte[] encryptedData = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

        // Combine the IV and the encrypted data
        byte[] encryptedDataWithIv = new byte[iv.length + encryptedData.length];
        System.arraycopy(iv, 0, encryptedDataWithIv, 0, iv.length);
        System.arraycopy(encryptedData, 0, encryptedDataWithIv, iv.length, encryptedData.length);

        // Return the combined IV and encrypted data as a base64-encoded string
        return Base64.getEncoder().encodeToString(encryptedDataWithIv);
    }
}