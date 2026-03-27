import com.genbio.genBio.BioDesignMetadata.diff_match_patch;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class BioDesignMetadataLibrary {
    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("MM/dd/yyyy, HH:mm:ss");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public BioDesignMetadata createMetadata(
            String parentMetadataId,
            String designName,
            String author,
            String description,
            String design
    ) throws Exception {
        BioDesignMetadata metadata = new BioDesignMetadata();
        metadata.setId(UUID.randomUUID().toString());
        metadata.setParentMetadataId(parentMetadataId);
        metadata.setDesignName(designName);
        metadata.setDesignChecksum(calculateChecksum(design));
        metadata.setAuthor(author);
        metadata.setDescription(description);
        metadata.setLastUpdated(nowTimestamp());
        metadata.setChangelog(new ArrayList<>());

        Files.writeString(
                Path.of("library", "metadata_" + designName + ".json"),
                GSON.toJson(metadata),
                StandardCharsets.UTF_8
        );
        return metadata;
    }

    public BioDesignMetadata updateMetadataWithOperation(
            String metadataPath,
            String design,
            String operationCode,
            Map<String, Object> operationDetails,
            String change,
            List<Map<String, String>> comments,
            String status
    ) throws Exception {
        BioDesignMetadata metadata = GSON.fromJson(Files.readString(Path.of(metadataPath), StandardCharsets.UTF_8), BioDesignMetadata.class);
        if (metadata.getChangelog() != null) {
            for (BioDesignOperation operation : metadata.getChangelog()) {
                if (operation.getComments() == null) {
                    operation.setComments(new ArrayList<>());
                }
                if (operation.getStatus() == null) {
                    operation.setStatus("");
                }
            }
        }

        metadata.setLastUpdated(nowTimestamp());
        metadata.setDesignChecksum(calculateChecksum(design));

        BioDesignOperation operation = new BioDesignOperation();
        operation.setOperationCode(operationCode);
        operation.setOperationDetails(operationDetails);
        operation.setChange(change);
        operation.setTimestamp(metadata.getLastUpdated());
        operation.setTool("BioDesign tool");
        operation.setComments(comments != null ? comments : new ArrayList<>());
        operation.setStatus(status != null ? status : "");
        metadata.getChangelog().add(operation);

        Files.writeString(Path.of(metadataPath), GSON.toJson(metadata), StandardCharsets.UTF_8);
        return metadata;
    }

    public BioDesignMetadata updateMetadataWithOperation(
            String metadataPath,
            String design,
            String operationCode,
            Map<String, Object> operationDetails,
            String change
    ) throws Exception {
        return updateMetadataWithOperation(metadataPath, design, operationCode, operationDetails, change, new ArrayList<>(), "");
    }

    public static String calculateChecksum(String inputStr) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest((inputStr == null ? "" : inputStr.toLowerCase()).getBytes(StandardCharsets.UTF_8));
        StringBuilder hexString = new StringBuilder();
        for (byte b : hashBytes) {
            hexString.append(String.format("%02x", b));
        }
        return hexString.toString();
    }

    public static String computeDifference(String originalString, String newString) {
        diff_match_patch dmp = new diff_match_patch();
        LinkedList<diff_match_patch.Patch> patches = dmp.patch_make(newString, originalString);
        return dmp.patch_toText(patches);
    }

    public static List<Map<String, Object>> computeRevisions(String lastDesign, List<Map<String, Object>> changelog) {
        diff_match_patch dmp = new diff_match_patch();
        int currentRevision = changelog.size();
        List<Map<String, Object>> revisions = new ArrayList<>();
        List<Map<String, Object>> reversed = new ArrayList<>(changelog);
        Collections.reverse(reversed);
        String currentDesign = lastDesign;

        for (Map<String, Object> operation : reversed) {
            if (!operation.containsKey("comments")) {
                operation.put("comments", new ArrayList<>());
            }
            if (!operation.containsKey("status")) {
                operation.put("status", "");
            }

            Map<String, Object> revision = new LinkedHashMap<>();
            revision.put("revision", currentRevision);
            revision.put("design", currentDesign);
            revision.putAll(operation);
            revisions.add(revision);

            Object changeObj = operation.get("change");
            String change = changeObj == null ? "" : changeObj.toString();
            if (!change.isEmpty()) {
                List<diff_match_patch.Patch> patches = dmp.patch_fromText(change);
                Object[] result = dmp.patch_apply(new LinkedList<>(patches), currentDesign);
                currentDesign = (String) result[0];
            }
            currentRevision -= 1;
        }
        return revisions;
    }

    public static String decryptString(String encryptedBase64String) {
        String encryptionKey = System.getenv("BMDE_ENCRYPTION_KEY");
        if (encryptionKey == null || encryptionKey.isEmpty()) {
            throw new RuntimeException(
                    "BMDE_ENCRYPTION_KEY environment variable is not set. Please set it to decrypt metadata files."
            );
        }
        try {
            byte[] key = encryptionKey.getBytes(StandardCharsets.UTF_8);
            byte[] encryptedDataWithIv = Base64.getDecoder().decode(encryptedBase64String);
            byte[] iv = Arrays.copyOfRange(encryptedDataWithIv, 0, 16);
            byte[] encryptedData = Arrays.copyOfRange(encryptedDataWithIv, 16, encryptedDataWithIv.length);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
            byte[] originalData = cipher.doFinal(encryptedData);
            return new String(originalData, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to decrypt metadata. The encryption key may be incorrect or the data may be corrupted. " + e,
                    e
            );
        }
    }

    public static String encryptString(String stringToEncrypt) {
        String encryptionKey = System.getenv("BMDE_ENCRYPTION_KEY");
        if (encryptionKey == null || encryptionKey.isEmpty()) {
            throw new RuntimeException("BMDE_ENCRYPTION_KEY environment variable is not set.");
        }
        try {
            byte[] key = encryptionKey.getBytes(StandardCharsets.UTF_8);
            byte[] iv = new byte[16];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
            byte[] encryptedData = cipher.doFinal(stringToEncrypt.getBytes(StandardCharsets.UTF_8));
            byte[] encryptedDataWithIv = new byte[iv.length + encryptedData.length];
            System.arraycopy(iv, 0, encryptedDataWithIv, 0, iv.length);
            System.arraycopy(encryptedData, 0, encryptedDataWithIv, iv.length, encryptedData.length);
            return Base64.getEncoder().encodeToString(encryptedDataWithIv);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> parseChangelogFromMetadataJson(String metadataJson) {
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        Map<String, Object> parsed = GSON.fromJson(metadataJson, mapType);
        Object changelogObj = parsed.get("changelog");
        if (!(changelogObj instanceof List)) return new ArrayList<>();
        return (List<Map<String, Object>>) changelogObj;
    }

    private static String nowTimestamp() {
        return LocalDateTime.now().format(TS_FORMAT);
    }
}